#!/usr/bin/env node

/**
 * Quantitative Pixel Difference Analysis
 * 
 * Computes percentage pixel difference between consecutive animation frames.
 * Target: ≥1% difference (M003 baseline for visible motion).
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, '..', 'src', 'assets', 'sprites');

async function computePixelDiff(buffer1, buffer2) {
  const [raw1, raw2] = await Promise.all([
    sharp(buffer1).raw().toBuffer(),
    sharp(buffer2).raw().toBuffer()
  ]);

  if (raw1.length !== raw2.length) {
    throw new Error('Image dimensions mismatch');
  }

  let totalDiff = 0;
  for (let i = 0; i < raw1.length; i++) {
    totalDiff += Math.abs(raw1[i] - raw2[i]);
  }

  // Normalize: divide by buffer length and max value (255), multiply by 100 for percentage
  const percentDiff = (totalDiff / raw1.length / 255) * 100;
  return percentDiff;
}

async function analyzeAnimation(species, animationState, frameCount) {
  console.log(`\n${animationState.toUpperCase()} Animation (${frameCount} frames):`);
  console.log('─'.repeat(60));

  const speciesDir = path.join(SPRITES_DIR, species);
  const frames = [];

  for (let i = 1; i <= frameCount; i++) {
    const framePath = path.join(speciesDir, `${animationState}-${i}.png`);
    if (!fs.existsSync(framePath)) {
      console.error(`❌ Frame ${i} not found: ${framePath}`);
      return false;
    }
    frames.push(fs.readFileSync(framePath));
  }

  let allPairsVisible = true;

  for (let i = 0; i < frames.length - 1; i++) {
    const diff = await computePixelDiff(frames[i], frames[i + 1]);
    const visible = diff >= 1.0;
    const status = visible ? '✅' : '❌';
    
    console.log(`  Frame ${i + 1}→${i + 2}: ${diff.toFixed(2)}% ${status}${visible ? '' : ' (below 1% threshold)'}`);
    
    if (!visible) {
      allPairsVisible = false;
    }
  }

  return allPairsVisible;
}

async function main() {
  const species = process.argv[2];
  const animationState = process.argv[3];

  if (!species || !animationState) {
    console.error('Usage: node scripts/pixelDiffAnalysis.js <species> <animation-state>');
    console.error('Example: node scripts/pixelDiffAnalysis.js charmander eat');
    process.exit(1);
  }

  const frameCount = {
    'idle': 2,
    'drag': 2,
    'eat': 36,
    'play': 36
  }[animationState];

  if (!frameCount) {
    console.error(`❌ Unknown animation state: ${animationState}`);
    console.error('Valid states: idle, drag, eat, play');
    process.exit(1);
  }

  console.log(`Pixel Difference Analysis for ${species}/${animationState}`);
  console.log('='.repeat(60));
  console.log('Target: ≥1% pixel difference for visible motion (M003 baseline)');

  try {
    const allVisible = await analyzeAnimation(species, animationState, frameCount);

    console.log('\n' + '='.repeat(60));
    if (allVisible) {
      console.log('✅ All frame transitions meet visibility threshold');
      process.exit(0);
    } else {
      console.log('❌ Some transitions below visibility threshold - increase transformations');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

main();
