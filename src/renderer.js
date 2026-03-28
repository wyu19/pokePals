const sprite = document.getElementById('sprite');

// Initialize animation state machine
let animationMachine = null;

// Get active Pokemon from main process on load
window.electronAPI.getActivePokemon().then(pokemon => {
  const species = pokemon ? pokemon.species : 'bulbasaur';
  console.log(`Initializing animation for ${species}`);
  
  animationMachine = new AnimationStateMachine(species, sprite);
  animationMachine.start();
}).catch(err => {
  console.error('Error loading active Pokemon:', err);
  // Fallback to bulbasaur
  animationMachine = new AnimationStateMachine('bulbasaur', sprite);
  animationMachine.start();
});

// Listen for Pokemon switch events
window.electronAPI.onPokemonSwitch((species) => {
  if (animationMachine) {
    console.log(`Species changed to ${species}`);
    animationMachine.setSpecies(species);
  }
});

let isDragging = false;

// Disable click-through on the sprite element itself
sprite.addEventListener('mouseenter', () => {
  window.electronAPI.setIgnoreMouseEvents(false);
});

sprite.addEventListener('mouseleave', () => {
  window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
});

// Manual drag implementation (avoiding -webkit-app-region which blocks context menu)
sprite.addEventListener('mousedown', (e) => {
  // Right-click should not start drag
  if (e.button === 2) {
    return;
  }
  
  isDragging = true;
  const startX = e.screenX;
  const startY = e.screenY;
  
  // Trigger drag animation
  if (animationMachine) {
    animationMachine.setState('drag');
  }
  
  window.electronAPI.startDrag(startX, startY);
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    
    // Return to idle animation
    if (animationMachine) {
      animationMachine.setState('idle');
    }
    
    window.electronAPI.stopDrag();
  }
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    window.electronAPI.dragMove(e.screenX, e.screenY);
  }
});

// Right-click context menu
sprite.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.electronAPI.showContextMenu();
});

// Handle menu actions
window.electronAPI.onMenuAction((action) => {
  if (action === 'feed') {
    // Trigger eat animation
    if (animationMachine) {
      animationMachine.setState('eat');
    }
    window.electronAPI.feedPokemon();
  } else if (action === 'play') {
    // Trigger play animation
    if (animationMachine) {
      animationMachine.setState('play');
    }
    window.electronAPI.playPokemon();
  }
});
