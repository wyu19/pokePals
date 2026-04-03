#!/usr/bin/env node

/**
 * Generate a 16x16px food sprite (berry) in Red/Blue pixel art style
 * with alpha transparency.
 * 
 * Uses Charmander color palette: oranges, reds, yellows for the berry.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create a simple berry sprite using pixel data
// 16x16 grid, 4 channels (RGBA)
const width = 16;
const height = 16;

// Define colors in Charmander palette style
const TRANSPARENT = [0, 0, 0, 0];
const BERRY_RED = [231, 74, 57, 255];      // Red/Blue game red
const BERRY_DARK = [165, 41, 33, 255];     // Darker red for shading
const BERRY_LIGHT = [247, 148, 49, 255];   // Orange highlight

// Create pixel array (row-major order)
const pixels = new Uint8Array(width * height * 4);

// Helper to set pixel
function setPixel(x, y, color) {
  const index = (y * width + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

// Initialize all pixels as transparent
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    setPixel(x, y, TRANSPARENT);
  }
}

// Draw a simple berry shape (roughly circular, chunky pixel style)
// Center at (8, 8), radius ~4-5 pixels
const berryPixels = [
  // Row 5
  [7, 5, BERRY_DARK], [8, 5, BERRY_DARK], [9, 5, BERRY_DARK],
  // Row 6
  [6, 6, BERRY_DARK], [7, 6, BERRY_RED], [8, 6, BERRY_LIGHT], [9, 6, BERRY_RED], [10, 6, BERRY_DARK],
  // Row 7
  [5, 7, BERRY_DARK], [6, 7, BERRY_RED], [7, 7, BERRY_RED], [8, 7, BERRY_LIGHT], [9, 7, BERRY_RED], [10, 7, BERRY_RED], [11, 7, BERRY_DARK],
  // Row 8 (middle)
  [5, 8, BERRY_DARK], [6, 8, BERRY_RED], [7, 8, BERRY_RED], [8, 8, BERRY_RED], [9, 8, BERRY_RED], [10, 8, BERRY_RED], [11, 8, BERRY_DARK],
  // Row 9
  [5, 9, BERRY_DARK], [6, 9, BERRY_RED], [7, 9, BERRY_RED], [8, 9, BERRY_RED], [9, 9, BERRY_RED], [10, 9, BERRY_RED], [11, 9, BERRY_DARK],
  // Row 10
  [6, 10, BERRY_DARK], [7, 10, BERRY_DARK], [8, 10, BERRY_RED], [9, 10, BERRY_DARK], [10, 10, BERRY_DARK],
  // Row 11
  [7, 11, BERRY_DARK], [8, 11, BERRY_DARK], [9, 11, BERRY_DARK],
];

// Apply berry pixels
for (const [x, y, color] of berryPixels) {
  setPixel(x, y, color);
}

// Convert to PNG using sharp
async function generateSprite() {
  const outputPath = path.join(__dirname, '..', 'src', 'assets', 'sprites', 'charmander', 'food.png');
  
  await sharp(Buffer.from(pixels.buffer), {
    raw: {
      width,
      height,
      channels: 4
    }
  })
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

  console.log(`✅ Created food sprite: ${outputPath}`);
  console.log(`   Dimensions: ${width}x${height}px`);
  console.log(`   Alpha transparency: yes`);
}

generateSprite().catch(err => {
  console.error('❌ Failed to create food sprite:', err);
  process.exit(1);
});
