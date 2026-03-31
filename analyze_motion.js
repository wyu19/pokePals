const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Analyze motion visibility by comparing frames
async function analyzeMotion(species, state) {
  const spritesDir = path.join(process.cwd(), 'src/assets/sprites');
  const frame1 = path.join(spritesDir, species, `${state}-1.png`);
  const frame2 = path.join(spritesDir, species, `${state}-2.png`);
  
  // Load both frames
  const img1 = await sharp(frame1).raw().toBuffer({ resolveWithObject: true });
  const img2 = await sharp(frame2).raw().toBuffer({ resolveWithObject: true });
  
  const { width, height } = img1.info;
  const data1 = img1.data;
  const data2 = img2.data;
  
  // Count different pixels
  let diffPixels = 0;
  let totalPixels = width * height;
  
  for (let i = 0; i < data1.length; i += 4) {
    const r1 = data1[i], g1 = data1[i+1], b1 = data1[i+2], a1 = data1[i+3];
    const r2 = data2[i], g2 = data2[i+1], b2 = data2[i+2], a2 = data2[i+3];
    
    // Check if pixel differs (any channel difference > 5)
    if (Math.abs(r1-r2) > 5 || Math.abs(g1-g2) > 5 || Math.abs(b1-b2) > 5 || Math.abs(a1-a2) > 5) {
      diffPixels++;
    }
  }
  
  const diffPercent = (diffPixels / totalPixels * 100).toFixed(2);
  return {
    species,
    state,
    diffPixels,
    totalPixels,
    diffPercent: parseFloat(diffPercent),
    visible: diffPercent >= 1.0 // Threshold: at least 1% pixels different
  };
}

async function main() {
  const species = ['bulbasaur', 'charmander', 'squirtle'];
  const states = ['idle', 'drag', 'eat', 'play'];
  
  console.log('Motion Visibility Analysis');
  console.log('='.repeat(70));
  console.log('Species      | State | Diff Pixels | Total Pixels | Diff % | Visible');
  console.log('-'.repeat(70));
  
  const results = [];
  for (const sp of species) {
    for (const st of states) {
      const result = await analyzeMotion(sp, st);
      results.push(result);
      const visibleMark = result.visible ? '✓ YES' : '✗ NO';
      console.log(`${sp.padEnd(12)} | ${st.padEnd(5)} | ${result.diffPixels.toString().padStart(11)} | ${result.totalPixels.toString().padStart(12)} | ${result.diffPercent.toString().padStart(6)}% | ${visibleMark}`);
    }
  }
  
  console.log('='.repeat(70));
  console.log('\nVisibility Summary:');
  const invisible = results.filter(r => !r.visible);
  if (invisible.length === 0) {
    console.log('✅ All 12 animation combinations show visible motion (≥1% pixel difference)');
  } else {
    console.log(`❌ ${invisible.length} animation(s) below visibility threshold:`);
    invisible.forEach(r => console.log(`   - ${r.species} ${r.state}: ${r.diffPercent}%`));
  }
}

main().catch(console.error);
