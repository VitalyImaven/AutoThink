#!/usr/bin/env node

/**
 * Create placeholder icon files for the Chrome extension
 * This script creates simple colored PNG files as placeholders
 */

const fs = require('fs');
const path = require('path');

// Simple PNG data for solid color images (blue #4285f4)
const createPngData = (size) => {
  // Minimal PNG header + IHDR chunk for solid color
  // This is a simplified approach - creates a tiny blue square
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // For simplicity, we'll create a single-pixel PNG and let the browser scale it
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // Length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(size, 8); // Width
  ihdr.writeUInt32BE(size, 12); // Height
  ihdr.writeUInt8(8, 16); // Bit depth
  ihdr.writeUInt8(2, 17); // Color type (RGB)
  ihdr.writeUInt8(0, 18); // Compression
  ihdr.writeUInt8(0, 19); // Filter
  ihdr.writeUInt8(0, 20); // Interlace
  
  // Create a simple blue square image data
  const pixels = Buffer.alloc(size * size * 3); // RGB
  for (let i = 0; i < size * size; i++) {
    pixels[i * 3] = 66;     // R
    pixels[i * 3 + 1] = 133; // G
    pixels[i * 3 + 2] = 244; // B (#4285f4)
  }
  
  // Note: This is a simplified version. For production, use a proper PNG library.
  // For now, let's just create a simple SVG and save as PNG manually
  return null; // Will use SVG fallback below
};

// Create SVG icons instead (more reliable without dependencies)
const createSvgIcon = (size) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#4285f4"/>
  <text x="50%" y="50%" font-family="Arial" font-size="${size * 0.6}" fill="white" text-anchor="middle" dominant-baseline="central">AI</text>
</svg>`;
};

const publicDir = path.join(__dirname, 'public');

// Create public directory if it doesn't exist
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Icon sizes
const sizes = [16, 48, 128];

console.log('Creating placeholder icon files...\n');

sizes.forEach(size => {
  const svgPath = path.join(publicDir, `icon${size}.svg`);
  const svgContent = createSvgIcon(size);
  
  fs.writeFileSync(svgPath, svgContent);
  console.log(`✓ Created ${svgPath}`);
});

console.log('\n⚠️  Note: Chrome extensions require PNG icons, not SVG.');
console.log('Please convert these SVG files to PNG using an online tool or image editor:');
console.log('  - https://cloudconvert.com/svg-to-png');
console.log('  - Or use ImageMagick: convert icon16.svg icon16.png');
console.log('\nAlternatively, install sharp and run:');
console.log('  npm install sharp');
console.log('  node convert-icons.js');

