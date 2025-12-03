#!/usr/bin/env node

/**
 * Creates modern gradient placeholder PNG icons for the AI Smart Autofill extension
 * Uses pure JavaScript to generate valid PNG files with gradient backgrounds
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');
const distDir = path.join(__dirname, '..', 'dist');

// Create directories if they don't exist
[publicDir, distDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// CRC32 lookup table
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

// Color palette for our modern gradient (cyan to purple)
const COLOR_START = { r: 0, g: 212, b: 255 };    // #00D4FF
const COLOR_END = { r: 139, g: 92, b: 246 };     // #8B5CF6
const LIGHTNING_COLOR = { r: 255, g: 255, b: 255, a: 255 };

// Interpolate between two colors
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Get gradient color at position (0-1)
function getGradientColor(t) {
  return {
    r: lerp(COLOR_START.r, COLOR_END.r, t),
    g: lerp(COLOR_START.g, COLOR_END.g, t),
    b: lerp(COLOR_START.b, COLOR_END.b, t),
    a: 255
  };
}

// Create a PNG chunk
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

// Create IHDR chunk
function createIHDR(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.writeUInt8(8, 8);    // bit depth
  data.writeUInt8(6, 9);    // color type (RGBA)
  data.writeUInt8(0, 10);   // compression
  data.writeUInt8(0, 11);   // filter
  data.writeUInt8(0, 12);   // interlace
  return createChunk('IHDR', data);
}

// Create IEND chunk
function createIEND() {
  return createChunk('IEND', Buffer.alloc(0));
}

// Check if point is inside rounded rectangle
function isInsideRoundedRect(x, y, size, radius) {
  // Check corners
  if (x < radius && y < radius) {
    return Math.pow(x - radius, 2) + Math.pow(y - radius, 2) <= Math.pow(radius, 2);
  }
  if (x >= size - radius && y < radius) {
    return Math.pow(x - (size - radius), 2) + Math.pow(y - radius, 2) <= Math.pow(radius, 2);
  }
  if (x < radius && y >= size - radius) {
    return Math.pow(x - radius, 2) + Math.pow(y - (size - radius), 2) <= Math.pow(radius, 2);
  }
  if (x >= size - radius && y >= size - radius) {
    return Math.pow(x - (size - radius), 2) + Math.pow(y - (size - radius), 2) <= Math.pow(radius, 2);
  }
  return true;
}

// Check if point is on lightning bolt (simplified)
function isOnLightningBolt(x, y, size) {
  // Scale coordinates to 0-1 range
  const nx = x / size;
  const ny = y / size;
  
  // Lightning bolt shape (simplified polygon)
  // Top part of bolt
  if (ny < 0.55) {
    const leftEdge = 0.25 + (ny / 0.55) * 0.2;
    const rightEdge = 0.55 - (ny / 0.55) * 0.15;
    if (nx >= leftEdge && nx <= rightEdge) return true;
  }
  
  // Bottom part of bolt  
  if (ny >= 0.45 && ny < 0.88) {
    const progress = (ny - 0.45) / 0.43;
    const leftEdge = 0.35 + progress * 0.15;
    const rightEdge = 0.65 - progress * 0.25;
    if (nx >= leftEdge && nx <= rightEdge) return true;
  }
  
  // Middle section (wider part)
  if (ny >= 0.40 && ny <= 0.60) {
    if (nx >= 0.30 && nx <= 0.70) return true;
  }
  
  return false;
}

// Create pixel data for icon
function createPixelData(size) {
  const radius = Math.floor(size * 0.2);
  const pixels = [];
  
  for (let y = 0; y < size; y++) {
    pixels.push(0); // Filter byte for each row
    for (let x = 0; x < size; x++) {
      const insideRect = isInsideRoundedRect(x, y, size, radius);
      
      if (insideRect) {
        // Diagonal gradient from top-left to bottom-right
        const t = (x + y) / (size * 2);
        
        // Check if on lightning bolt
        if (isOnLightningBolt(x, y, size)) {
          // White lightning
          pixels.push(255, 255, 255, 255);
        } else {
          const color = getGradientColor(t);
          pixels.push(color.r, color.g, color.b, color.a);
        }
      } else {
        // Transparent outside rounded rect
        pixels.push(0, 0, 0, 0);
      }
    }
  }
  
  return Buffer.from(pixels);
}

// Create PNG file
function createPNG(size) {
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  const ihdr = createIHDR(size, size);
  const pixelData = createPixelData(size);
  const compressedData = zlib.deflateSync(pixelData, { level: 9 });
  const idat = createChunk('IDAT', compressedData);
  const iend = createIEND();
  
  return Buffer.concat([PNG_SIGNATURE, ihdr, idat, iend]);
}

console.log('🎨 Creating modern gradient icons...\n');

const sizes = [16, 48, 128];
let createdCount = 0;

sizes.forEach(size => {
  const iconData = createPNG(size);
  
  // Save to public directory
  const publicPath = path.join(publicDir, `icon${size}.png`);
  fs.writeFileSync(publicPath, iconData);
  console.log(`✓ Created ${publicPath}`);
  
  // Also save to dist directory
  const distPath = path.join(distDir, `icon${size}.png`);
  fs.writeFileSync(distPath, iconData);
  console.log(`✓ Created ${distPath}`);
  
  createdCount++;
});

console.log(`\n✅ Created ${createdCount * 2} modern gradient icons!`);
console.log('\nIcon features:');
console.log('  • Cyan (#00D4FF) to Purple (#8B5CF6) gradient');
console.log('  • Rounded corners');
console.log('  • Lightning bolt symbol');
console.log('  • Transparent background\n');
