#!/usr/bin/env node
/**
 * Verify animation.js frame counts match actual sprite files on disk
 */

const fs = require('fs');
const path = require('path');

// Expected frame counts from animation.js
const FRAME_COUNTS = {
  bulbasaur: { idle: 2, drag: 2, eat: 21, play: 35 },
  charmander: { idle: 2, drag: 2, eat: 28, play: 21 },
  squirtle: { idle: 2, drag: 2, eat: 15, play: 36 }
};

const SPRITES_DIR = path.join(__dirname, '../src/assets/sprites');

let allPass = true;

for (const species of Object.keys(FRAME_COUNTS)) {
  const speciesDir = path.join(SPRITES_DIR, species);
  
  for (const action of ['idle', 'drag', 'eat', 'play']) {
    const expectedCount = FRAME_COUNTS[species][action];
    
    // Count actual files
    const files = fs.readdirSync(speciesDir)
      .filter(f => f.startsWith(`${action}-`) && f.endsWith('.png'));
    
    const actualCount = files.length;
    
    const status = actualCount === expectedCount ? '✅' : '❌';
    console.log(`${status} ${species}/${action}: expected ${expectedCount}, found ${actualCount}`);
    
    if (actualCount !== expectedCount) {
      allPass = false;
    }
  }
}

if (allPass) {
  console.log('\n✅ All frame counts match!');
  process.exit(0);
} else {
  console.log('\n❌ Frame count mismatches detected!');
  process.exit(1);
}
