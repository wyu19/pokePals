#!/usr/bin/env node

/**
 * Animation Frame Processing Script
 * 
 * Batch-processes 36-frame source sprites from subdirectories:
 * - Resizes from source dimensions to 96×96px using nearest-neighbor scaling
 * - Renames from frame_NNN.png to eat-N.png/play-N.png (1-indexed)
 * - Writes to parent sprite directories
 * - Preserves alpha transparency and pixel-art aesthetic
 * 
 * Source directories:
 *   src/assets/sprites/{species}/{species}_eating/frame_000.png through frame_035.png
 *   src/assets/sprites/{species}/{species}_playing/frame_000.png through frame_035.png
 * 
 * Output:
 *   src/assets/sprites/{species}/eat-1.png through eat-36.png
 *   src/assets/sprites/{species}/play-1.png through play-36.png
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SPRITES_DIR = path.join(__dirname, '..', 'src', 'assets', 'sprites');
const SPECIES = ['bulbasaur', 'charmander', 'squirtle'];
const ACTIONS = [
  { dir: 'eating', prefix: 'eat' },
  { dir: 'playing', prefix: 'play' }
];
const FRAME_COUNT = 36;
const OUTPUT_SIZE = 96;

async function processFrames(species, action) {
  const sourceDir = path.join(SPRITES_DIR, species, `${species}_${action.dir}`);
  const outputDir = path.join(SPRITES_DIR, species);

  console.log(`\nProcessing ${species} ${action.dir}...`);

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  let processedCount = 0;

  for (let i = 0; i < FRAME_COUNT; i++) {
    const sourceFile = path.join(sourceDir, `frame_${String(i).padStart(3, '0')}.png`);
    const outputFile = path.join(outputDir, `${action.prefix}-${i + 1}.png`);

    if (!fs.existsSync(sourceFile)) {
      throw new Error(`Missing source frame: ${sourceFile}`);
    }

    try {
      await sharp(sourceFile)
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
          kernel: 'nearest',
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputFile);

      processedCount++;
      
      // Log progress every 9 frames (for visual feedback without spam)
      if ((i + 1) % 9 === 0 || (i + 1) === FRAME_COUNT) {
        console.log(`  ${species} ${action.dir}: ${processedCount}/${FRAME_COUNT} frames processed`);
      }
    } catch (error) {
      throw new Error(`Failed to process ${sourceFile}: ${error.message}`);
    }
  }

  console.log(`  ✅ ${species} ${action.dir}: Complete (${processedCount} frames written)`);
  return processedCount;
}

async function main() {
  console.log('Animation Frame Processing');
  console.log('==========================');
  console.log(`Source: ${FRAME_COUNT} frames per action (frame_000.png through frame_035.png)`);
  console.log(`Output: 96×96px nearest-neighbor scaled (1-indexed: eat-1.png, play-1.png, etc.)`);
  console.log(`Target: ${SPECIES.length} species × ${ACTIONS.length} actions = ${SPECIES.length * ACTIONS.length * FRAME_COUNT} total frames`);

  let totalProcessed = 0;

  try {
    for (const species of SPECIES) {
      for (const action of ACTIONS) {
        const count = await processFrames(species, action);
        totalProcessed += count;
      }
    }

    console.log('\n==========================');
    console.log(`✅ All processing complete: ${totalProcessed} frames written`);
    process.exit(0);
  } catch (error) {
    console.error('\n==========================');
    console.error(`❌ Processing failed: ${error.message}`);
    process.exit(1);
  }
}

main();
