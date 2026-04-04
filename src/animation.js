// Animation State Machine for Pokemon sprites
// Manages 4 states: idle (loop), drag (on mousedown), eat (one-shot), play (one-shot)

// Frame counts per state (species-specific for eat/play culled animations)
const FRAME_COUNTS = {
  bulbasaur: { idle: 2, drag: 2, eat: 21, play: 35 },
  charmander: { idle: 2, drag: 2, eat: 28, play: 21 },
  squirtle: { idle: 2, drag: 2, eat: 15, play: 36 }
};

class AnimationStateMachine {
  constructor(species, spriteElement) {
    this.species = species;
    this.spriteElement = spriteElement;
    this.state = 'idle';
    this.frame = 0;
    this.lastFrameTime = 0;
    this.isRunning = false;
    this.animationFrameId = null;
    
    // Load species-specific frame counts
    this.frameCounts = FRAME_COUNTS[species] || FRAME_COUNTS.bulbasaur;
    
    // FPS per state
    this.stateFPS = {
      idle: 3,     // 3 FPS for subtle idle loop
      drag: 6,     // 6 FPS for drag (faster for responsiveness)
      eat: 6,      // 6 FPS for eating animation (~6s total)
      play: 8      // 8 FPS for play animation (~4.5s total)
    };
    
    console.log(`Animation state machine initialized for ${species}`);
  }
  
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastFrameTime = Date.now();
    this.animate();
    console.log('Animation started');
  }
  
  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    console.log('Animation stopped');
  }
  
  animate() {
    if (!this.isRunning) return;
    
    const now = Date.now();
    const fps = this.stateFPS[this.state];
    const frameDuration = 1000 / fps;
    
    if (now - this.lastFrameTime >= frameDuration) {
      this.advanceFrame();
      this.lastFrameTime = now;
    }
    
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }
  
  advanceFrame() {
    const frameCount = this.frameCounts[this.state];
    
    // Advance to next frame
    this.frame++;
    
    // Handle state-specific loop behavior
    if (this.state === 'idle') {
      // Idle loops forever
      if (this.frame >= frameCount) {
        this.frame = 0;
      }
    } else if (this.state === 'drag') {
      // Drag loops while dragging
      if (this.frame >= frameCount) {
        this.frame = 0;
      }
    } else {
      // Eat and play are one-shot - return to idle after playing
      if (this.frame >= frameCount) {
        this.setState('idle');
        return;
      }
    }
    
    this.updateSprite();
  }
  
  updateSprite() {
    const frameNumber = this.frame + 1; // Frame files are 1-indexed
    const spritePath = `assets/sprites/${this.species}/${this.state}-${frameNumber}.png`;
    this.spriteElement.src = spritePath;
  }
  
  setState(newState) {
    if (this.state === newState) return;
    
    console.log(`Animation state: ${this.state} → ${newState}`);
    this.state = newState;
    this.frame = 0;
    this.updateSprite();
  }
  
  setSpecies(newSpecies) {
    console.log(`Animation species: ${this.species} → ${newSpecies}`);
    this.species = newSpecies;
    this.frameCounts = FRAME_COUNTS[newSpecies] || FRAME_COUNTS.bulbasaur;
    this.frame = 0;
    this.updateSprite();
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnimationStateMachine;
}
