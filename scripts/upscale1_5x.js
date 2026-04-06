#!/usr/bin/env node

/**
 * Upscale all sprites by 1.5x from current ~35×33 size
 * 
 * Target: ~52×49 pixels (35×1.5 ≈ 52, 33×1.5 ≈ 49)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPECIES = ['bulbasaur', 'charmander', 'squirtle'];
const SCALE_FACTOR = 1.5;
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

async function upscaleBy1_5x(inputPath, outputPath) {
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
  
  // Upscale by 1.5x
  const newWidth = Math.round(bounds.width * SCALE_FACTOR);
  const newHeight = Math.round(bounds.height * SCALE_FACTOR);
  
  // Resize with nearest-neighbor to preserve chunky pixels
  const resized = await sharp(cropped)
    .resize(newWidth, newHeight, {
      kernel: 'nearest',
      fit: 'fill',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();
  
  // Center in 96×96 canvas
  const offsetX = Math.round((CANVAS_SIZE - newWidth) / 2);
  const offsetY = Math.round((CANVAS_SIZE - newHeight) / 2);
  
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
  
  return { originalWidth: bounds.width, originalHeight: bounds.height, newWidth, newHeight };
}

async function main() {
  console.log(`Upscaling all sprites by ${SCALE_FACTOR}x\n`);
  
  // Create backup directory
  const backupDir = path.join(__dirname, '../.gsd/milestones/M005/slices/S06/backup-before-1.5x-upscale');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  for (const species of SPECIES) {
    console.log(`Processing ${species}...`);
    
    const actions = ['idle', 'drag', 'eat', 'play'];
    
    for (const action of actions) {
      const frameCount = FRAME_COUNTS[species][action];
      
      console.log(`  ${action} (${frameCount} frames)...`);
      
      let sampleSize = null;
      
      for (let i = 1; i <= frameCount; i++) {
        const spritePath = path.join(__dirname, `../src/assets/sprites/${species}/${action}-${i}.png`);
        const backupPath = path.join(backupDir, `${species}-${action}-${i}.png`);
        
        // Backup original
        fs.copyFileSync(spritePath, backupPath);
        
        // Upscale by 1.5x
        const { originalWidth, originalHeight, newWidth, newHeight } = await upscaleBy1_5x(spritePath, spritePath);
        
        if (i === 1) {
          sampleSize = { originalWidth, originalHeight, newWidth, newHeight };
        }
      }
      
      console.log(`    ✓ Upscaled from ${sampleSize.originalWidth}×${sampleSize.originalHeight} to ${sampleSize.newWidth}×${sampleSize.newHeight}`);
    }
    
    console.log('');
  }
  
  console.log(`✓ All sprites upscaled by ${SCALE_FACTOR}x`);
  console.log(`✓ Backups saved to .gsd/milestones/M005/slices/S06/backup-before-1.5x-upscale/`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
