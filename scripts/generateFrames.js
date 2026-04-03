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
    // Frame 1: Idle/base pose - no transformation
    { name: 'eat-1', verticalShift: 0, description: 'idle base pose (no shift)' },
    // Frame 2: Notice food - head tilts forward slightly
    { name: 'eat-2', verticalShift: 2, description: 'notice food (+2px forward tilt)' },
    // Frame 3: Grab food - slight lift, hands-raised simulation (food compositing added in T02)
    { name: 'eat-3', verticalShift: 1, description: 'grab food (+1px vertical lift)' },
    // Frame 4: Bite - mouth opens wider (3px taller vertical stretch in bite region)
    { name: 'eat-4', verticalShift: 0, mouthOpen: 3, description: 'bite (mouth open +3px, food overlaps)' },
    // Frame 5: Chew left - mouth closed, left cheek bulge
    { name: 'eat-5', verticalShift: 0, cheekBulge: 'left', bulgeAmount: 3, description: 'chew left (left cheek +3px horizontal bulge)' },
    // Frame 6: Chew right - right cheek bulge
    { name: 'eat-6', verticalShift: 0, cheekBulge: 'right', bulgeAmount: 3, description: 'chew right (right cheek +3px horizontal bulge)' },
    // Frame 7: Happy chew - slight bounce, content expression
    { name: 'eat-7', verticalShift: 1, description: 'happy chew (+1px bounce, satisfied)' },
    // Frame 8: Swallow - head tilts back, satisfied return to idle
    { name: 'eat-8', verticalShift: -2, description: 'swallow (head tilt back -2px, satisfied)' }
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
 * Apply mouth open transformation (vertical stretch in mouth region)
 */
async function applyMouthOpen(buffer, openAmount, width, height) {
  // Define mouth region: center horizontal strip at ~60% height
  const mouthCenterY = Math.round(height * 0.6);
  const mouthRegionHeight = Math.round(height * 0.3); // 30% of sprite height
  const mouthTop = Math.max(0, mouthCenterY - Math.round(mouthRegionHeight / 2));
  const mouthBottom = Math.min(height, mouthTop + mouthRegionHeight);
  const actualMouthHeight = mouthBottom - mouthTop;

  // Extract mouth region
  const mouthRegion = await sharp(buffer)
    .extract({ left: 0, top: mouthTop, width: width, height: actualMouthHeight })
    .resize(width, actualMouthHeight + openAmount, { kernel: 'nearest', fit: 'fill' })
    .toBuffer();

  // Create canvas and composite: top region + stretched mouth + bottom region
  const canvas = await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png().toBuffer();

  // Extract top region (above mouth)
  const topRegion = await sharp(buffer)
    .extract({ left: 0, top: 0, width: width, height: mouthTop })
    .toBuffer();

  // Extract bottom region (below mouth)
  const bottomHeight = height - mouthBottom;
  const bottomRegion = bottomHeight > 0 ? await sharp(buffer)
    .extract({ left: 0, top: mouthBottom, width: width, height: bottomHeight })
    .toBuffer() : null;

  // Composite all regions
  const compositeOps = [
    { input: topRegion, top: 0, left: 0 },
    { input: mouthRegion, top: mouthTop, left: 0 }
  ];
  if (bottomRegion) {
    compositeOps.push({ input: bottomRegion, top: mouthTop + actualMouthHeight + openAmount, left: 0 });
  }

  return sharp(canvas).composite(compositeOps).png({ compressionLevel: 9 }).toBuffer();
}

/**
 * Apply cheek bulge transformation (horizontal expansion in cheek region)
 */
async function applyCheekBulge(buffer, side, bulgeAmount, width, height) {
  // Define cheek region: side strip at ~50-70% height
  const cheekTop = Math.round(height * 0.5);
  const cheekHeight = Math.round(height * 0.25); // 25% of sprite height
  const cheekWidth = Math.round(width * 0.35); // 35% of sprite width
  
  // Extract full sprite regions
  const topRegion = await sharp(buffer)
    .extract({ left: 0, top: 0, width: width, height: cheekTop })
    .toBuffer();

  const bottomRegion = await sharp(buffer)
    .extract({ left: 0, top: cheekTop + cheekHeight, width: width, height: height - cheekTop - cheekHeight })
    .toBuffer();

  // Extract and expand the cheek region horizontally
  const middleRegion = await sharp(buffer)
    .extract({ left: 0, top: cheekTop, width: width, height: cheekHeight })
    .toBuffer();

  // Expand the middle region horizontally on the appropriate side
  let expandedMiddle;
  if (side === 'left') {
    // Shift middle region left by bulgeAmount
    expandedMiddle = await sharp({
      create: { width, height: cheekHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
    .composite([{ input: middleRegion, top: 0, left: -bulgeAmount }])
    .png()
    .toBuffer();
  } else {
    // Shift middle region right by bulgeAmount
    expandedMiddle = await sharp({
      create: { width, height: cheekHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
    .composite([{ input: middleRegion, top: 0, left: bulgeAmount }])
    .png()
    .toBuffer();
  }

  // Reassemble: top + expanded middle + bottom
  const canvas = await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png().toBuffer();

  return sharp(canvas)
    .composite([
      { input: topRegion, top: 0, left: 0 },
      { input: expandedMiddle, top: cheekTop, left: 0 },
      { input: bottomRegion, top: cheekTop + cheekHeight, left: 0 }
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Composite food sprite at mouth position
 */
async function compositeFoodSprite(buffer, foodBuffer, verticalShift, width, height) {
  // Mouth center approximation: (width/2, height*0.6)
  // Adjust for verticalShift applied to base sprite
  const mouthCenterX = Math.round(width / 2);
  const mouthCenterY = Math.round(height * 0.6) + Math.round(verticalShift);
  
  // Get food sprite dimensions
  const foodMeta = await sharp(foodBuffer).metadata();
  const foodLeft = mouthCenterX - Math.round(foodMeta.width / 2);
  const foodTop = mouthCenterY - Math.round(foodMeta.height / 2);

  return sharp(buffer)
    .composite([{ input: foodBuffer, top: foodTop, left: foodLeft }])
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

  // Load food sprite if this is an eat animation
  let foodBuffer = null;
  if (state === 'eat') {
    const foodPath = path.join(SPRITES_DIR, species, 'food.png');
    if (fs.existsSync(foodPath)) {
      foodBuffer = fs.readFileSync(foodPath);
    } else {
      console.warn(`⚠️  Food sprite not found: ${foodPath} - skipping food compositing`);
    }
  }

  console.log(`\nGenerating ${state} frames for ${species}:`);

  for (const transform of transformations) {
    let transformedBuffer;

    if (state === 'idle' || state === 'play') {
      // Simple vertical shift
      const shiftAmount = transform.verticalShift ?? transform.bounceDistance ?? 0;
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
    } else if (state === 'eat') {
      // Complex eat transformations
      const shiftAmount = transform.verticalShift ?? 0;
      
      // Start with base or shifted base
      if (shiftAmount !== 0) {
        transformedBuffer = await applyVerticalShift(baseBuffer, shiftAmount, width, height);
      } else {
        transformedBuffer = Buffer.from(baseBuffer);
      }

      // Apply mouth open if specified
      if (transform.mouthOpen) {
        transformedBuffer = await applyMouthOpen(transformedBuffer, transform.mouthOpen, width, height);
      }

      // Apply cheek bulge if specified
      if (transform.cheekBulge) {
        transformedBuffer = await applyCheekBulge(
          transformedBuffer,
          transform.cheekBulge,
          transform.bulgeAmount,
          width,
          height
        );
      }

      // Composite food sprite for frames 3-6 (grab, bite, chew-left, chew-right)
      const frameName = transform.name;
      const shouldCompositeFood = foodBuffer && ['eat-3', 'eat-4', 'eat-5', 'eat-6'].includes(frameName);
      if (shouldCompositeFood) {
        transformedBuffer = await compositeFoodSprite(transformedBuffer, foodBuffer, shiftAmount, width, height);
      }

      console.log(`  ✓ ${transform.name}.png - ${transform.description}${shouldCompositeFood ? ' + food sprite' : ''}`);
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
