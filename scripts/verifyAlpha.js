#!/usr/bin/env node

/**
 * Alpha Transparency Verification Utility
 * 
 * Runs `sips -g hasAlpha` on sprite frames and reports pass/fail status.
 * Exits 0 if all frames pass, exits 1 if any frame fails.
 * 
 * Usage:
 *   node scripts/verifyAlpha.js                    # Verify all species
 *   node scripts/verifyAlpha.js bulbasaur          # Verify specific species
 *   node scripts/verifyAlpha.js bulbasaur charmander  # Verify multiple species
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, '..', 'src', 'assets', 'sprites');

function verifySpecies(species) {
  const speciesDir = path.join(SPRITES_DIR, species);
  
  if (!fs.existsSync(speciesDir)) {
    console.error(`❌ Species directory not found: ${speciesDir}`);
    return false;
  }

  const pngFiles = fs.readdirSync(speciesDir)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (pngFiles.length === 0) {
    console.error(`❌ No PNG files found in ${speciesDir}`);
    return false;
  }

  let allPassed = true;
  console.log(`\nVerifying ${species} (${pngFiles.length} frames):`);

  for (const file of pngFiles) {
    const filePath = path.join(speciesDir, file);
    try {
      const output = execSync(`sips -g hasAlpha "${filePath}"`, { encoding: 'utf8' });
      const hasAlpha = output.includes('hasAlpha: yes');
      
      if (hasAlpha) {
        console.log(`  ✅ ${file} - hasAlpha: yes`);
      } else {
        console.log(`  ❌ ${file} - hasAlpha: no`);
        allPassed = false;
      }
    } catch (error) {
      console.error(`  ❌ ${file} - Error running sips: ${error.message}`);
      allPassed = false;
    }
  }

  return allPassed;
}

function main() {
  const args = process.argv.slice(2);
  
  let speciesToVerify;
  if (args.length === 0) {
    // Verify all species in sprites directory
    speciesToVerify = fs.readdirSync(SPRITES_DIR)
      .filter(name => fs.statSync(path.join(SPRITES_DIR, name)).isDirectory());
  } else {
    speciesToVerify = args;
  }

  console.log('Alpha Transparency Verification');
  console.log('================================');

  let allSpeciesPassed = true;
  for (const species of speciesToVerify) {
    const passed = verifySpecies(species);
    if (!passed) {
      allSpeciesPassed = false;
    }
  }

  console.log('\n================================');
  if (allSpeciesPassed) {
    console.log('✅ All frames passed alpha verification');
    process.exit(0);
  } else {
    console.log('❌ Some frames failed alpha verification');
    process.exit(1);
  }
}

main();
