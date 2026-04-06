#!/usr/bin/env node

/**
 * Restore original eat/play sprites and upscale idle/drag to match
 * 
 * Approach: Restore eat/play from backup, then upscale idle/drag to match their size
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPECIES = ['bulbasaur', 'charmander', 'squirtle'];

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

async function upscaleAndCenter(inputPath, outputPath, targetWidth, targetHeight) {
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
  
  // Calculate scale to match target size
  const scaleX = targetWidth / bounds.width;
  const scaleY = targetHeight / bounds.height;
  const scale = Math.min(scaleX, scaleY);
  
  const resizeWidth = Math.round(bounds.width * scale);
  const resizeHeight = Math.round(bounds.height * scale);
  
  // Upscale with nearest-neighbor to preserve chunky pixels
  const resized = await sharp(cropped)
    .resize(resizeWidth, resizeHeight, {
      kernel: 'nearest',
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();
  
  // Center in 96×96 canvas
  const offsetX = Math.round((96 - resizeWidth) / 2);
  const offsetY = Math.round((96 - resizeHeight) / 2);
  
  await sharp({
    create: {
      width: 96,
      height: 96,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([{ input: resized, top: offsetY, left: offsetX }])
  .png()
  .toFile(outputPath);
}

async function main() {
  console.log('Restoring original eat/play sizes and upscaling idle/drag to match\n');
  
  for (const species of SPECIES) {
    console.log(`Processing ${species}...`);
    
    // Restore eat/play from backup
    const backupDir = path.join(__dirname, '../.gsd/milestones/M005/slices/S06/backup-original-scale');
    const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith(`${species}-`));
    
    for (const file of backupFiles) {
      const backupPath = path.join(backupDir, file);
      const action = file.includes('-eat-') ? 'eat' : 'play';
      const frameNum = file.match(/-(\d+)\.png$/)[1];
      const targetPath = path.join(__dirname, `../src/assets/sprites/${species}/${action}-${frameNum}.png`);
      
      fs.copyFileSync(backupPath, targetPath);
    }
    
    console.log(`  ✓ Restored original eat/play frames from backup`);
    
    // Get target size from eat-1.png
    const eatPath = path.join(__dirname, `../src/assets/sprites/${species}/eat-1.png`);
    const eatBounds = await getContentBounds(eatPath);
    const targetWidth = eatBounds.width;
    const targetHeight = eatBounds.height;
    
    console.log(`  Target size: ${targetWidth}×${targetHeight}`);
    
    // Upscale idle and drag frames
    for (const action of ['idle', 'drag']) {
      for (let i = 1; i <= 2; i++) {
        const inputPath = path.join(__dirname, `../src/assets/sprites/${species}/${action}-${i}.png`);
        const tempPath = inputPath + '.backup';
        
        // Backup original
        if (i === 1 && action === 'idle') {
          const idleBackupDir = path.join(__dirname, '../.gsd/milestones/M005/slices/S06/backup-original-idle-drag');
          if (!fs.existsSync(idleBackupDir)) {
            fs.mkdirSync(idleBackupDir, { recursive: true });
          }
          
          for (let j = 1; j <= 2; j++) {
            ['idle', 'drag'].forEach(act => {
              const src = path.join(__dirname, `../src/assets/sprites/${species}/${act}-${j}.png`);
              const dst = path.join(idleBackupDir, `${species}-${act}-${j}.png`);
              fs.copyFileSync(src, dst);
            });
          }
        }
        
        await upscaleAndCenter(inputPath, inputPath, targetWidth, targetHeight);
      }
    }
    
    console.log(`  ✓ Upscaled idle/drag to ${targetWidth}×${targetHeight}\n`);
  }
  
  console.log('✓ All sprites normalized to eat/play size');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
