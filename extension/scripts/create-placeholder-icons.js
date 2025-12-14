#!/usr/bin/env node

/**
 * Creates minimal, clean hi-tech icons for AutoThink extension
 * Simple gradient with clean "A" letter
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');
const distDir = path.join(__dirname, '..', 'dist');

[publicDir, distDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Clean gradient colors
const COLOR_START = { r: 0, g: 200, b: 255 };   // Bright cyan
const COLOR_END = { r: 120, g: 80, b: 255 };    // Purple

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function getGradientColor(t) {
  return {
    r: lerp(COLOR_START.r, COLOR_END.r, t),
    g: lerp(COLOR_START.g, COLOR_END.g, t),
    b: lerp(COLOR_START.b, COLOR_END.b, t),
    a: 255
  };
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crcValue = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crcValue, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function createIHDR(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.writeUInt8(8, 8);
  data.writeUInt8(6, 9);
  data.writeUInt8(0, 10);
  data.writeUInt8(0, 11);
  data.writeUInt8(0, 12);
  return createChunk('IHDR', data);
}

function createIEND() {
  return createChunk('IEND', Buffer.alloc(0));
}

// Check if inside rounded rectangle
function isInsideRoundedRect(x, y, size, cornerRadius) {
  const r = cornerRadius;
  
  // Check if in corner regions
  if (x < r && y < r) {
    return (x - r) ** 2 + (y - r) ** 2 <= r ** 2;
  }
  if (x > size - r && y < r) {
    return (x - (size - r)) ** 2 + (y - r) ** 2 <= r ** 2;
  }
  if (x < r && y > size - r) {
    return (x - r) ** 2 + (y - (size - r)) ** 2 <= r ** 2;
  }
  if (x > size - r && y > size - r) {
    return (x - (size - r)) ** 2 + (y - (size - r)) ** 2 <= r ** 2;
  }
  
  return x >= 0 && x < size && y >= 0 && y < size;
}

// Simple, bold "A" letter
function isOnLetterA(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  
  // Scale factor
  const s = size / 100;
  
  // Relative position from center
  const rx = x - cx;
  const ry = y - cy;
  
  // A dimensions
  const thickness = 8 * s;
  const height = 50 * s;
  const width = 40 * s;
  const crossbarY = 5 * s;
  const crossbarHeight = 7 * s;
  
  // Top of the A (triangle peak)
  const top = -height / 2;
  const bottom = height / 2;
  
  // Calculate the slope of A legs
  const slope = width / height;
  
  // Left leg
  const leftEdgeOuter = (ry - top) * slope - width / 2;
  const leftEdgeInner = leftEdgeOuter + thickness;
  const onLeftLeg = rx >= leftEdgeOuter && rx <= leftEdgeInner && ry >= top && ry <= bottom;
  
  // Right leg  
  const rightEdgeOuter = -(ry - top) * slope + width / 2;
  const rightEdgeInner = rightEdgeOuter - thickness;
  const onRightLeg = rx <= rightEdgeOuter && rx >= rightEdgeInner && ry >= top && ry <= bottom;
  
  // Crossbar
  const crossbarLeft = (crossbarY - top) * slope - width / 2 + thickness;
  const crossbarRight = -crossbarLeft;
  const onCrossbar = ry >= crossbarY && ry <= crossbarY + crossbarHeight && 
                     rx >= crossbarLeft && rx <= crossbarRight;
  
  return onLeftLeg || onRightLeg || onCrossbar;
}

// Create pixel data
function createPixelData(size) {
  const pixels = [];
  const cornerRadius = Math.floor(size * 0.22);
  
  for (let y = 0; y < size; y++) {
    pixels.push(0);
    for (let x = 0; x < size; x++) {
      if (isInsideRoundedRect(x, y, size, cornerRadius)) {
        // Gradient from top-left to bottom-right
        const t = (x + y) / (size * 2);
        const color = getGradientColor(t);
        
        // Check if on letter A
        if (isOnLetterA(x, y, size)) {
          // White letter
          pixels.push(255, 255, 255, 255);
        } else {
          pixels.push(color.r, color.g, color.b, color.a);
        }
      } else {
        pixels.push(0, 0, 0, 0);
      }
    }
  }
  
  return Buffer.from(pixels);
}

function createPNG(size) {
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = createIHDR(size, size);
  const pixelData = createPixelData(size);
  const compressedData = zlib.deflateSync(pixelData, { level: 9 });
  const idat = createChunk('IDAT', compressedData);
  const iend = createIEND();
  return Buffer.concat([PNG_SIGNATURE, ihdr, idat, iend]);
}

console.log('✨ Creating clean AutoThink icons...\n');

const sizes = [16, 48, 128];

sizes.forEach(size => {
  const iconData = createPNG(size);
  
  const publicPath = path.join(publicDir, `icon${size}.png`);
  fs.writeFileSync(publicPath, iconData);
  console.log(`✓ ${publicPath}`);
  
  const distPath = path.join(distDir, `icon${size}.png`);
  fs.writeFileSync(distPath, iconData);
  console.log(`✓ ${distPath}`);
});

console.log('\n✅ Icons created!');
console.log('   • Rounded square');
console.log('   • Cyan → Purple gradient');
console.log('   • Clean white "A" letter\n');
