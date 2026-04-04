#!/usr/bin/env node

/**
 * Frame Culling Script - M005/S06/T02
 * 
 * Filters 36-frame eat/play animations to keep only frames with ≥1% motion visibility.
 * Reads pixel-diff analysis results from T01, removes frames below threshold.
 * 
 * Input: .gsd/milestones/M005/slices/S06/verification/pixel-diff-{species}-{action}.txt
 * Output: src/assets/sprites/{species}/culled-{action}-{N}.png (sequential numbering)
 */

const fs = require('fs');
const path = require('path');

const SPECIES = ['bulbasaur', 'charmander', 'squirtle'];
const ACTIONS = ['eat', 'play'];
const THRESHOLD = 1.0; // 1% minimum motion visibility
const TOTAL_FRAMES = 36;

/**
 * Parse pixel-diff analysis file to extract frame-to-frame percentages.
 * Returns array of length 35 (transitions 1→2, 2→3, ..., 35→36).
 */
function parsePixelDiffFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const diffs = [];

  for (const line of lines) {
    // Match lines like "  Frame 1→2: 0.89% ❌ (below 1% threshold)"
    const match = line.match(/Frame (\d+)→(\d+):\s+([\d.]+)%/);
    if (match) {
      const fromFrame = parseInt(match[1], 10);
      const toFrame = parseInt(match[2], 10);
      const diffPct = parseFloat(match[3]);
      
      // Verify sequence is contiguous
      if (toFrame !== fromFrame + 1) {
        throw new Error(`Non-contiguous transition: ${fromFrame}→${toFrame} in ${filePath}`);
      }
      
      diffs.push(diffPct);
    }
  }

  if (diffs.length !== TOTAL_FRAMES - 1) {
    throw new Error(`Expected ${TOTAL_FRAMES - 1} transitions, got ${diffs.length} in ${filePath}`);
  }

  return diffs;
}

/**
 * Determine which frames to keep based on motion visibility threshold.
 * Returns array of frame numbers (1-indexed) to keep.
 */
function selectFramesToKeep(diffs) {
  const keep = [1]; // Always keep frame 1

  for (let i = 0; i < diffs.length; i++) {
    const frameNum = i + 2; // Frame 2 corresponds to diffs[0] (1→2), etc.
    const diffPct = diffs[i];
    
    if (diffPct >= THRESHOLD) {
      keep.push(frameNum);
    }
  }

  return keep;
}

/**
 * Copy kept frames to culled-{action}-{N}.png with sequential numbering.
 */
function cullFrames(species, action, framesToKeep) {
  const spriteDir = path.join(__dirname, '..', 'src', 'assets', 'sprites', species);
  
  // Remove old culled frames for this action if they exist
  const oldCulledFiles = fs.readdirSync(spriteDir).filter(f => f.startsWith(`culled-${action}-`));
  for (const oldFile of oldCulledFiles) {
    fs.unlinkSync(path.join(spriteDir, oldFile));
  }

  // Copy kept frames with sequential numbering
  for (let i = 0; i < framesToKeep.length; i++) {
    const srcFrame = framesToKeep[i];
    const srcPath = path.join(spriteDir, `${action}-${srcFrame}.png`);
    const destPath = path.join(spriteDir, `culled-${action}-${i + 1}.png`);
    
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Source frame missing: ${srcPath}`);
    }
    
    fs.copyFileSync(srcPath, destPath);
  }

  return framesToKeep.length;
}

/**
 * Main execution
 */
function main() {
  console.log('Frame Culling Script - M005/S06/T02');
  console.log('Threshold: ≥1% pixel difference for motion visibility\n');

  const results = [];
  let totalOriginal = 0;
  let totalCulled = 0;

  for (const species of SPECIES) {
    for (const action of ACTIONS) {
      const analysisPath = path.join(
        __dirname,
        '..',
        '.gsd',
        'milestones',
        'M005',
        'slices',
        'S06',
        'verification',
        `pixel-diff-${species}-${action}.txt`
      );

      if (!fs.existsSync(analysisPath)) {
        console.error(`❌ Missing analysis file: ${analysisPath}`);
        process.exit(1);
      }

      // Parse pixel-diff results
      const diffs = parsePixelDiffFile(analysisPath);
      
      // Determine frames to keep
      const framesToKeep = selectFramesToKeep(diffs);
      const droppedCount = TOTAL_FRAMES - framesToKeep.length;
      
      // Copy culled frames
      const culledCount = cullFrames(species, action, framesToKeep);
      
      // Log results
      console.log(`${species}/${action}:`);
      console.log(`  Original: ${TOTAL_FRAMES} frames`);
      console.log(`  Kept: ${framesToKeep.length} frames (${framesToKeep.join(', ')})`);
      console.log(`  Dropped: ${droppedCount} frames`);
      console.log('');

      results.push({
        species,
        action,
        original: TOTAL_FRAMES,
        kept: framesToKeep.length,
        dropped: droppedCount,
        frames: framesToKeep
      });

      totalOriginal += TOTAL_FRAMES;
      totalCulled += culledCount;
    }
  }

  // Write summary report
  const reportPath = path.join(
    __dirname,
    '..',
    '.gsd',
    'milestones',
    'M005',
    'slices',
    'S06',
    'verification',
    'culled-frame-counts.txt'
  );

  let report = 'Frame Culling Summary - M005/S06/T02\n';
  report += '=' .repeat(60) + '\n';
  report += `Threshold: ≥${THRESHOLD}% pixel difference\n\n`;

  for (const r of results) {
    report += `${r.species}/${r.action}:\n`;
    report += `  Original frames: ${r.original}\n`;
    report += `  Culled frames: ${r.kept}\n`;
    report += `  Dropped frames: ${r.dropped}\n`;
    report += `  Kept frame numbers: ${r.frames.join(', ')}\n`;
    report += '\n';
  }

  report += '=' .repeat(60) + '\n';
  report += `Total: ${totalOriginal} → ${totalCulled} frames (${((totalCulled / totalOriginal) * 100).toFixed(1)}% retention)\n`;

  fs.writeFileSync(reportPath, report);
  console.log(`✅ Summary written to ${reportPath}`);
  console.log(`\nTotal: ${totalOriginal} original frames → ${totalCulled} culled frames (${((totalCulled / totalOriginal) * 100).toFixed(1)}% retention)`);
}

main();
