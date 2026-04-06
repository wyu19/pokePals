#!/usr/bin/env node

/**
 * Normalize ALL sprites to ~35×33 pixels
 * 
 * Resize all idle/drag/eat/play sprites to fit within 35×33, centered in 96×96 canvas
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPECIES = ['bulbasaur', 'charmander', 'squirtle'];
const TARGET_WIDTH = 35;
const TARGET_HEIGHT = 33;
const CANVAS_SIZE = 96;

// Frame counts
const FRAME_COUNTS = {
  bulbasaur: { idle: 2, drag: 2, eat: 21, play: 35 },
  charmander: { idle: 2, drag: 2, eat: 28, play: 21 },
  squirtle: { idle: 2, drag: 2, eat: 15, play: 36 }
};

async function getContentBounds(imagePath) {
  const img = sharp(imagePath);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  
  let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
  
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      const alpha = data[idx + 3];
      if (alpha > 10) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  return {
    minX, maxX, minY, maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

async function resizeToTarget(inputPath, outputPath) {
  const bounds = await getContentBounds(inputPath);
  
  // Crop to content
  const cropped = await sharp(inputPath)
    .extract({
      left: bounds.minX,
      top: bounds.minY,
      width: bounds.width,
      height: bounds.height
    })
    .toBuffer();
  
  // Calculate scale to fit target size while maintaining aspect ratio
  const scaleX = TARGET_WIDTH / bounds.width;
  const scaleY = TARGET_HEIGHT / bounds.height;
  const scale = Math.min(scaleX, scaleY);
  
  const resizeWidth = Math.round(bounds.width * scale);
  const resizeHeight = Math.round(bounds.height * scale);
  
  // Resize with nearest-neighbor to preserve chunky pixels
  const resized = await sharp(cropped)
    .resize(resizeWidth, resizeHeight, {
      kernel: 'nearest',
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();
  
  // Center in 96×96 canvas
  const offsetX = Math.round((CANVAS_SIZE - resizeWidth) / 2);
  const offsetY = Math.round((CANVAS_SIZE - resizeHeight) / 2);
  
  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([{ input: resized, top: offsetY, left: offsetX }])
  .png()
  .toFile(outputPath);
}

async function main() {
  console.log(`Normalizing ALL sprites to ~${TARGET_WIDTH}×${TARGET_HEIGHT} pixels\n`);
  
  // Create backup directory
  const backupDir = path.join(__dirname, '../.gsd/milestones/M005/slices/S06/backup-before-35x33');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  for (const species of SPECIES) {
    console.log(`Processing ${species}...`);
    
    const actions = ['idle', 'drag', 'eat', 'play'];
    
    for (const action of actions) {
      const frameCount = FRAME_COUNTS[species][action];
      
      console.log(`  ${action} (${frameCount} frames)...`);
      
      for (let i = 1; i <= frameCount; i++) {
        const spritePath = path.join(__dirname, `../src/assets/sprites/${species}/${action}-${i}.png`);
        const backupPath = path.join(backupDir, `${species}-${action}-${i}.png`);
        
        // Backup original
        fs.copyFileSync(spritePath, backupPath);
        
        // Resize to ~35×33
        await resizeToTarget(spritePath, spritePath);
      }
      
      console.log(`    ✓ Resized ${frameCount} frames to ~${TARGET_WIDTH}×${TARGET_HEIGHT}`);
    }
    
    console.log('');
  }
  
  console.log(`✓ All sprites normalized to ~${TARGET_WIDTH}×${TARGET_HEIGHT} pixels`);
  console.log(`✓ Backups saved to .gsd/milestones/M005/slices/S06/backup-before-35x33/`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
