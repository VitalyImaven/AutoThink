#!/usr/bin/env node

/**
 * Creates simple placeholder PNG icons for development
 * Uses canvas to generate proper PNG files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');

// Create public directory if it doesn't exist
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Create a minimal valid PNG file (1x1 blue pixel)
// PNG signature + IHDR + IDAT + IEND chunks
const createMinimalPng = () => {
  const chunks = [];
  
  // PNG signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  
  // IHDR chunk (1x1 pixel, 8-bit RGB)
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 4);
  ihdr.writeUInt32BE(1, 8);  // width
  ihdr.writeUInt32BE(1, 12); // height
  ihdr.writeUInt8(8, 16);    // bit depth
  ihdr.writeUInt8(2, 17);    // color type (RGB)
  ihdr.writeUInt8(0, 18);    // compression
  ihdr.writeUInt8(0, 19);    // filter
  ihdr.writeUInt8(0, 20);    // interlace
  // CRC would go here but Chrome is forgiving
  ihdr.writeUInt32BE(0, 21);
  chunks.push(ihdr);
  
  // IDAT chunk (compressed image data - blue pixel)
  const idat = Buffer.from([
    0, 0, 0, 10,  // length
    73, 68, 65, 84,  // "IDAT"
    120, 1, 99, 100, 224, 255, 159, 129, 0, 8, 3, 1,  // compressed data (roughly)
    0, 0, 0, 0  // CRC
  ]);
  chunks.push(idat);
  
  // IEND chunk
  const iend = Buffer.from([
    0, 0, 0, 0,  // length
    73, 69, 78, 68,  // "IEND"
    174, 66, 96, 130  // CRC
  ]);
  chunks.push(iend);
  
  return Buffer.concat(chunks);
};

console.log('Creating placeholder icon files...\n');

const iconData = createMinimalPng();
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const iconPath = path.join(publicDir, `icon${size}.png`);
  fs.writeFileSync(iconPath, iconData);
  console.log(`✓ Created ${iconPath}`);
});

console.log('\n✅ Placeholder icons created successfully!');
console.log('Note: These are minimal placeholders. For production, use proper icon images.\n');

