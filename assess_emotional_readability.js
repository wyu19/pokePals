// Emotional Readability Assessment based on transformation parameters
// Evaluates if current parameters effectively communicate intended emotions

const TRANSFORMATIONS = {
  idle: {
    params: { verticalShift: 2 },
    fps: 3,
    intendedEmotion: 'calm presence / breathing',
    assessment: null
  },
  drag: {
    params: { tiltDegrees: 4, squashPercent: 8 },
    fps: 6,
    intendedEmotion: 'reluctance / struggle',
    assessment: null
  },
  eat: {
    params: { mouthShift: 3 },
    fps: 2,
    intendedEmotion: 'satisfaction / chewing',
    assessment: null
  },
  play: {
    params: { bounceDistance: 4 },
    fps: 4,
    intendedEmotion: 'joy / playfulness',
    assessment: null
  }
};

// Assessment criteria based on animation principles
function assessIdleReadability() {
  const { verticalShift, fps } = { ...TRANSFORMATIONS.idle.params, fps: TRANSFORMATIONS.idle.fps };
  const totalRange = verticalShift * 2; // 4px total bob range
  
  // Idle breathing should be subtle but visible
  // At 96px sprite height, 4px bob = ~4% vertical movement
  // 3 FPS = 333ms per frame, gentle pacing
  
  if (totalRange < 3) {
    return { readable: 'unclear', reason: 'Motion too subtle - breathing invisible' };
  } else if (totalRange > 8) {
    return { readable: 'ambiguous', reason: 'Motion too exaggerated - looks restless not calm' };
  } else if (fps > 5) {
    return { readable: 'ambiguous', reason: 'FPS too fast - breathing feels frantic' };
  } else if (fps < 2) {
    return { readable: 'ambiguous', reason: 'FPS too slow - breathing feels labored' };
  }
  
  return { readable: 'clear', reason: `${totalRange}px bob at ${fps} FPS creates visible, gentle breathing motion` };
}

function assessDragReadability() {
  const { tiltDegrees, squashPercent, fps } = { ...TRANSFORMATIONS.drag.params, fps: TRANSFORMATIONS.drag.fps };
  
  // Drag struggle needs visible tilt/squash to show resistance
  // 8° total tilt range + 8% squash should read as "fighting back"
  // 6 FPS = 167ms per frame, responsive to user input
  
  if (tiltDegrees < 3 || squashPercent < 5) {
    return { readable: 'unclear', reason: 'Tilt/squash too subtle - struggle not visible' };
  } else if (tiltDegrees > 10 || squashPercent > 15) {
    return { readable: 'ambiguous', reason: 'Motion too extreme - looks hurt not reluctant' };
  } else if (fps < 4) {
    return { readable: 'ambiguous', reason: 'FPS too slow - drag feels laggy/unresponsive' };
  } else if (fps > 8) {
    return { readable: 'ambiguous', reason: 'FPS too fast - motion blurs together' };
  }
  
  return { readable: 'clear', reason: `±${tiltDegrees}° tilt + ${squashPercent}% squash at ${fps} FPS shows responsive struggle` };
}

function assessEatReadability() {
  const { mouthShift, fps } = { ...TRANSFORMATIONS.eat.params, fps: TRANSFORMATIONS.eat.fps };
  const totalRange = mouthShift + 2; // 5px total mouth movement (down 3px, up 2px)
  
  // Eat chewing should show clear vertical mouth motion
  // 5px range on 96px sprite = ~5% movement
  // 2 FPS = 500ms per frame, deliberate chewing pace
  
  if (totalRange < 4) {
    return { readable: 'unclear', reason: 'Mouth motion too subtle - chewing invisible' };
  } else if (totalRange > 10) {
    return { readable: 'ambiguous', reason: 'Motion too exaggerated - looks painful not satisfied' };
  } else if (fps < 1.5) {
    return { readable: 'ambiguous', reason: 'FPS too slow - chewing feels labored' };
  } else if (fps > 4) {
    return { readable: 'ambiguous', reason: 'FPS too fast - looks frantic not satisfied' };
  }
  
  return { readable: 'clear', reason: `${totalRange}px mouth shift at ${fps} FPS creates deliberate chewing motion` };
}

function assessPlayReadability() {
  const { bounceDistance, fps } = { ...TRANSFORMATIONS.play.params, fps: TRANSFORMATIONS.play.fps };
  const totalRange = bounceDistance + 3; // 7px total bounce range (up 4px, down 3px)
  
  // Play bounce should be energetic and joyful
  // 7px bounce on 96px sprite = ~7% vertical movement
  // 4 FPS = 250ms per frame, lively pacing
  
  if (totalRange < 5) {
    return { readable: 'unclear', reason: 'Bounce too subtle - playfulness not visible' };
  } else if (totalRange > 12) {
    return { readable: 'ambiguous', reason: 'Bounce too extreme - looks hyperactive not playful' };
  } else if (fps < 3) {
    return { readable: 'ambiguous', reason: 'FPS too slow - bounce feels sluggish' };
  } else if (fps > 6) {
    return { readable: 'ambiguous', reason: 'FPS too fast - motion blurs, loses joy' };
  }
  
  return { readable: 'clear', reason: `${totalRange}px bounce at ${fps} FPS creates energetic, joyful motion` };
}

// Run assessments
TRANSFORMATIONS.idle.assessment = assessIdleReadability();
TRANSFORMATIONS.drag.assessment = assessDragReadability();
TRANSFORMATIONS.eat.assessment = assessEatReadability();
TRANSFORMATIONS.play.assessment = assessPlayReadability();

// Print report
console.log('Emotional Readability Assessment');
console.log('='.repeat(80));
console.log('State | Intended Emotion       | Readable? | Assessment Reasoning');
console.log('-'.repeat(80));

Object.entries(TRANSFORMATIONS).forEach(([state, config]) => {
  const { intendedEmotion, assessment } = config;
  const mark = assessment.readable === 'clear' ? '✅ CLEAR' : 
               assessment.readable === 'ambiguous' ? '⚠️  AMBIG' : '❌ UNCLEAR';
  console.log(`${state.padEnd(5)} | ${intendedEmotion.padEnd(22)} | ${mark.padEnd(9)} | ${assessment.reason}`);
});

console.log('='.repeat(80));

// Summary verdict
const allClear = Object.values(TRANSFORMATIONS).every(t => t.assessment.readable === 'clear');
const needsTuning = Object.values(TRANSFORMATIONS).filter(t => t.assessment.readable !== 'clear');

console.log('\nOverall Verdict:');
if (allClear) {
  console.log('✅ All states pass readability threshold (motion visible + emotion recognizable)');
  console.log('   Current FPS rates and transformation parameters are VALIDATED for production.');
} else {
  console.log(`❌ ${needsTuning.length} state(s) need tuning:`);
  needsTuning.forEach(t => {
    const state = Object.keys(TRANSFORMATIONS).find(k => TRANSFORMATIONS[k] === t);
    console.log(`   - ${state}: ${t.assessment.reason}`);
  });
}

// Export assessment results
const fs = require('fs');
fs.writeFileSync('assessment_results.json', JSON.stringify(TRANSFORMATIONS, null, 2));
console.log('\n✓ Assessment results saved to assessment_results.json');
