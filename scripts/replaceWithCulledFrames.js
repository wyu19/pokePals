#!/usr/bin/env node
/**
 * Replace original 36-frame sprites with culled sequences.
 * 
 * For each species (bulbasaur, charmander, squirtle) and action (eat, play):
 * 1. Backup original {action}-1.png through {action}-36.png to .gsd/milestones/M005/slices/S06/backup/{species}-{action}-{N}.png
 * 2. Delete original sprites
 * 3. Rename culled-{action}-{N}.png to {action}-{N}.png with sequential numbering (1 through culled_count)
 * 4. Report final frame counts
 */

const fs = require('fs');
const path = require('path');

const SPECIES = ['bulbasaur', 'charmander', 'squirtle'];
const ACTIONS = ['eat', 'play'];
const BACKUP_DIR = '.gsd/milestones/M005/slices/S06/backup';
const SPRITES_BASE = 'src/assets/sprites';
const VERIFICATION_DIR = '.gsd/milestones/M005/slices/S06/verification';

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`Created backup directory: ${BACKUP_DIR}`);
}

const finalCounts = [];

for (const species of SPECIES) {
  for (const action of ACTIONS) {
    console.log(`\nProcessing ${species}/${action}...`);
    const spriteDir = path.join(SPRITES_BASE, species);
    
    // Step 1: Backup original 36 frames
    console.log(`  Backing up original 36 frames...`);
    let backedUp = 0;
    for (let i = 1; i <= 36; i++) {
      const originalPath = path.join(spriteDir, `${action}-${i}.png`);
      if (fs.existsSync(originalPath)) {
        const backupPath = path.join(BACKUP_DIR, `${species}-${action}-${i}.png`);
        fs.copyFileSync(originalPath, backupPath);
        backedUp++;
      }
    }
    console.log(`  ✓ Backed up ${backedUp} frames to ${BACKUP_DIR}/`);
    
    // Step 2: Delete original sprites
    console.log(`  Deleting original sprites...`);
    for (let i = 1; i <= 36; i++) {
      const originalPath = path.join(spriteDir, `${action}-${i}.png`);
      if (fs.existsSync(originalPath)) {
        fs.unlinkSync(originalPath);
      }
    }
    console.log(`  ✓ Deleted original sprites`);
    
    // Step 3: Count culled frames
    const culledFrames = [];
    for (let i = 1; i <= 36; i++) {
      const culledPath = path.join(spriteDir, `culled-${action}-${i}.png`);
      if (fs.existsSync(culledPath)) {
        culledFrames.push(i);
      }
    }
    const culledCount = culledFrames.length;
    console.log(`  Found ${culledCount} culled frames`);
    
    // Step 4: Rename culled frames to sequential numbering
    console.log(`  Renaming culled frames to sequential numbering...`);
    for (let newIndex = 1; newIndex <= culledCount; newIndex++) {
      const oldNumber = culledFrames[newIndex - 1];
      const culledPath = path.join(spriteDir, `culled-${action}-${oldNumber}.png`);
      const newPath = path.join(spriteDir, `${action}-${newIndex}.png`);
      fs.renameSync(culledPath, newPath);
    }
    console.log(`  ✓ Renamed ${culledCount} frames: ${action}-1.png through ${action}-${culledCount}.png`);
    
    finalCounts.push(`${species}/${action}: ${culledCount} frames`);
  }
}

// Write final frame counts report
const reportPath = path.join(VERIFICATION_DIR, 'final-frame-counts.txt');
const reportContent = `Final Frame Counts After Replacement - M005/S06/T03
============================================================

${finalCounts.join('\n')}

Total frames across all animations: ${finalCounts.reduce((sum, line) => {
  const count = parseInt(line.split(': ')[1]);
  return sum + count;
}, 0)}

Original 36-frame sprites backed up to:
  ${BACKUP_DIR}/

Replacement complete. All culled sequences now numbered sequentially starting at 1.
`;

fs.writeFileSync(reportPath, reportContent);
console.log(`\n✓ Final frame counts written to ${reportPath}`);
console.log('\n============================================================');
console.log('Replacement complete!');
console.log('============================================================\n');
console.log(reportContent);
