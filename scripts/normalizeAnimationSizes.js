#!/usr/bin/env node

/**
 * Normalize eat/play animation sprite sizes to match idle sprite scale
 * 
 * Problem: eat/play sprites from pokemondb.net use ~90×85px of the 96×96 canvas,
 * while idle sprites use only ~35×33px. When both are scaled to 256×256 via CSS,
 * eat/play appear much larger.
 * 
 * Solution: Analyze idle sprite bounds, resize eat/play to match scale, center in canvas.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPECIES = ['bulbasaur', 'charmander', 'squirtle'];
const ACTIONS = ['eat', 'play'];
const CANVAS_SIZE = 96;

// Frame counts from M005/S06 final culling results
const FRAME_COUNTS = {
  bulbasaur: { eat: 21, play: 35 },
  charmander: { eat: 28, play: 21 },
  squirtle: { eat: 15, play: 36 }
};

/**
 * Get bounding box of non-transparent pixels
 */
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
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

/**
 * Resize sprite to target size and center in 96×96 canvas
 */
async function resizeAndCenter(inputPath, outputPath, targetWidth, targetHeight) {
  const img = sharp(inputPath);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  
  // Extract content bounds
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
  
  // Resize cropped content to target size (maintain aspect ratio)
  const aspectRatio = bounds.width / bounds.height;
  const targetAspect = targetWidth / targetHeight;
  
  let resizeWidth, resizeHeight;
  if (aspectRatio > targetAspect) {
    // Wider - fit to width
    resizeWidth = targetWidth;
    resizeHeight = Math.round(targetWidth / aspectRatio);
  } else {
    // Taller - fit to height
    resizeHeight = targetHeight;
    resizeWidth = Math.round(targetHeight * aspectRatio);
  }
  
  const resized = await sharp(cropped)
    .resize(resizeWidth, resizeHeight, {
      kernel: 'nearest', // Preserve chunky pixel art
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
  console.log('Normalizing eat/play animation sprite sizes to match idle scale\n');
  
  for (const species of SPECIES) {
    // Get idle sprite bounds as reference
    const idlePath = path.join(__dirname, `../src/assets/sprites/${species}/idle-1.png`);
    const idleBounds = await getContentBounds(idlePath);
    
    console.log(`${species} idle bounds: ${idleBounds.width}×${idleBounds.height}`);
    
    const targetWidth = idleBounds.width;
    const targetHeight = idleBounds.height;
    
    for (const action of ACTIONS) {
      const frameCount = FRAME_COUNTS[species][action];
      
      console.log(`  Processing ${action} (${frameCount} frames)...`);
      
      for (let i = 1; i <= frameCount; i++) {
        const inputPath = path.join(__dirname, `../src/assets/sprites/${species}/${action}-${i}.png`);
        const outputPath = inputPath; // Overwrite in place
        
        // Create backup first time
        if (i === 1) {
          const backupDir = path.join(__dirname, `../.gsd/milestones/M005/slices/S06/backup-original-scale`);
          if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
          }
          
          // Backup all frames of this animation
          for (let j = 1; j <= frameCount; j++) {
            const srcPath = path.join(__dirname, `../src/assets/sprites/${species}/${action}-${j}.png`);
            const backupPath = path.join(backupDir, `${species}-${action}-${j}.png`);
            fs.copyFileSync(srcPath, backupPath);
          }
          
          console.log(`    Backed up original ${action} frames to .gsd/milestones/M005/slices/S06/backup-original-scale/`);
        }
        
        await resizeAndCenter(inputPath, outputPath, targetWidth, targetHeight);
      }
      
      console.log(`    ✓ Resized ${frameCount} frames to ${targetWidth}×${targetHeight} (centered in 96×96)`);
    }
    
    console.log('');
  }
  
  console.log('✓ All animations normalized to idle sprite scale');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
