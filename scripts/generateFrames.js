#!/usr/bin/env node

/**
 * Frame Generation Script for Animated Pokemon Sprites
 * 
 * Generates animated frames using pixel-perfect transformations on static base sprites.
 * Preserves Red/Blue chunky pixel art aesthetic with alpha transparency.
 * 
 * Usage:
 *   node scripts/generateFrames.js bulbasaur
 *   node scripts/generateFrames.js charmander
 *   node scripts/generateFrames.js squirtle
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, '..', 'src', 'assets', 'sprites');

/**
 * Animation transformation configurations
 */
const TRANSFORMATIONS = {
  idle: [
    { name: 'idle-1', verticalShift: 2, description: 'vertical bob up 2px' },
    { name: 'idle-2', verticalShift: -2, description: 'vertical bob down 2px' }
  ],
  drag: [
    { name: 'drag-1', tiltDegrees: -4, squashPercent: 8, description: 'tilt -4deg, squash 8%' },
    { name: 'drag-2', tiltDegrees: 4, squashPercent: 8, description: 'tilt +4deg, squash 8%' }
  ],
  eat: [
    { name: 'eat-1', mouthShift: 3, description: 'mouth shift down 3px' },
    { name: 'eat-2', mouthShift: -2, description: 'mouth shift up 2px' }
  ],
  play: [
    { name: 'play-1', bounceDistance: 4, description: 'bounce up 4px' },
    { name: 'play-2', bounceDistance: -3, description: 'bounce down 3px' }
  ]
};

/**
 * Apply vertical shift (for idle/eat/play animations)
 */
async function applyVerticalShift(buffer, shiftPixels, width, height) {
  // Create a transparent canvas
  const canvas = await sharp({
    create: {
      width: width,
      height: height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();

  // Composite the shifted sprite onto the canvas
  return sharp(canvas)
    .composite([{
      input: buffer,
      top: Math.round(shiftPixels),
      left: 0
    }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Apply tilt and squash (for drag animations)
 */
async function applyTiltAndSquash(buffer, tiltDegrees, squashPercent, width, height) {
  // Calculate new dimensions after squash
  const squashedHeight = Math.round(height * (1 - squashPercent / 100));
  const expandedWidth = Math.round(width * (1 + squashPercent / 200)); // Compensate width slightly

  // First, squash vertically using nearest-neighbor to preserve pixel art
  const squashed = await sharp(buffer)
    .resize(expandedWidth, squashedHeight, {
      kernel: 'nearest',
      fit: 'fill'
    })
    .toBuffer();

  // Rotate using nearest-neighbor interpolation on a larger canvas to avoid clipping
  const rotateCanvasSize = Math.ceil(Math.max(width, height) * 1.5);
  const rotateCanvas = await sharp({
    create: {
      width: rotateCanvasSize,
      height: rotateCanvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();

  // Center the squashed sprite on the rotation canvas
  const preCenterX = Math.round((rotateCanvasSize - expandedWidth) / 2);
  const preCenterY = Math.round((rotateCanvasSize - squashedHeight) / 2);

  const centered = await sharp(rotateCanvas)
    .composite([{
      input: squashed,
      top: preCenterY,
      left: preCenterX
    }])
    .png()
    .toBuffer();

  // Rotate the centered image
  const rotated = await sharp(centered)
    .rotate(tiltDegrees, {
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  // Crop back to original dimensions from center
  const rotatedMeta = await sharp(rotated).metadata();
  const cropLeft = Math.max(0, Math.round((rotatedMeta.width - width) / 2));
  const cropTop = Math.max(0, Math.round((rotatedMeta.height - height) / 2));

  return sharp(rotated)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: Math.min(width, rotatedMeta.width),
      height: Math.min(height, rotatedMeta.height)
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Generate frames for a specific animation state
 */
async function generateStateFrames(species, state, baseSpritePath) {
  const transformations = TRANSFORMATIONS[state];
  if (!transformations) {
    throw new Error(`Unknown animation state: ${state}`);
  }

  // Load base sprite
  const baseBuffer = fs.readFileSync(baseSpritePath);
  const metadata = await sharp(baseBuffer).metadata();
  const { width, height } = metadata;

  console.log(`\nGenerating ${state} frames for ${species}:`);

  for (const transform of transformations) {
    let transformedBuffer;

    if (state === 'idle' || state === 'eat' || state === 'play') {
      // Simple vertical shift
      const shiftAmount = transform.verticalShift || transform.mouthShift || transform.bounceDistance;
      transformedBuffer = await applyVerticalShift(baseBuffer, shiftAmount, width, height);
      console.log(`  ✓ ${transform.name}.png - ${transform.description}`);
    } else if (state === 'drag') {
      // Tilt and squash
      transformedBuffer = await applyTiltAndSquash(
        baseBuffer,
        transform.tiltDegrees,
        transform.squashPercent,
        width,
        height
      );
      console.log(`  ✓ ${transform.name}.png - ${transform.description}`);
    }

    // Write to disk
    const outputPath = path.join(SPRITES_DIR, species, `${transform.name}.png`);
    fs.writeFileSync(outputPath, transformedBuffer);
  }
}

/**
 * Main execution
 */
async function main() {
  const species = process.argv[2];

  if (!species) {
    console.error('Usage: node scripts/generateFrames.js <species>');
    console.error('Example: node scripts/generateFrames.js bulbasaur');
    process.exit(1);
  }

  const speciesDir = path.join(SPRITES_DIR, species);
  if (!fs.existsSync(speciesDir)) {
    console.error(`❌ Species directory not found: ${speciesDir}`);
    process.exit(1);
  }

  // Use idle-1.png as base sprite (assuming it exists as static placeholder)
  const baseSpritePath = path.join(speciesDir, 'idle-1.png');
  if (!fs.existsSync(baseSpritePath)) {
    console.error(`❌ Base sprite not found: ${baseSpritePath}`);
    console.error('Expected idle-1.png to exist as static base sprite');
    process.exit(1);
  }

  console.log(`Frame Generation for ${species}`);
  console.log('='.repeat(40));

  try {
    // Generate frames for each animation state
    await generateStateFrames(species, 'idle', baseSpritePath);
    await generateStateFrames(species, 'drag', baseSpritePath);
    await generateStateFrames(species, 'eat', baseSpritePath);
    await generateStateFrames(species, 'play', baseSpritePath);

    console.log('\n' + '='.repeat(40));
    console.log(`✅ Successfully generated all frames for ${species}`);
    console.log('Run verifyAlpha.js to confirm alpha transparency preserved');
  } catch (error) {
    console.error('\n❌ Frame generation failed:', error.message);
    process.exit(1);
  }
}

main();
