// Multi-Sprite Renderer — M004/S02
console.log('🎮 Renderer.js loading...');

// Get sprite elements
const hostSprite = document.getElementById('host-sprite');
const visitorSprite = document.getElementById('visitor-sprite');
const hostContainer = document.getElementById('host-container');
const visitorContainer = document.getElementById('visitor-container');

console.log('Elements found:', {
  hostSprite: !!hostSprite,
  visitorSprite: !!visitorSprite,
  hostContainer: !!hostContainer,
  visitorContainer: !!visitorContainer
});

// Initialize animation state machines
let hostAnimation = null;
let visitorAnimation = null;

// Get active Pokemon from main process on load
window.electronAPI.getActivePokemon().then(pokemon => {
  const species = pokemon ? pokemon.species : 'bulbasaur';
  console.log(`Initializing animation for ${species}`);
  
  hostAnimation = new AnimationStateMachine(species, hostSprite);
  hostAnimation.start();
  
  // Host container should be at 0,0 since the window itself is positioned
  // The window position is already set by main.js using the saved position
  hostContainer.style.left = '0px';
  hostContainer.style.top = '0px';
  
  console.log('Host animation started');
}).catch(err => {
  console.error('Error loading active Pokemon:', err);
  // Fallback to bulbasaur
  hostAnimation = new AnimationStateMachine('bulbasaur', hostSprite);
  hostAnimation.start();
  
  hostContainer.style.left = '0px';
  hostContainer.style.top = '0px';
});

// Listen for Pokemon switch events
window.electronAPI.onPokemonSwitch((species) => {
  if (hostAnimation) {
    console.log(`Species changed to ${species}`);
    hostAnimation.setSpecies(species);
  }
});

// === Multi-Sprite Visitor Functions ===

function showVisitor(species, visitorUsername) {
  try {
    // If visitor already exists, hide it first
    if (visitorAnimation) {
      console.log('Replacing existing visitor');
      hideVisitor();
    }
    
    console.log(`Showing visitor: ${visitorUsername}'s ${species}`);
    
    // Validate species
    const validSpecies = ['bulbasaur', 'charmander', 'squirtle'];
    if (!validSpecies.includes(species)) {
      throw new Error(`Invalid species: ${species}`);
    }
    
    // Create visitor animation
    visitorAnimation = new AnimationStateMachine(species, visitorSprite);
    visitorAnimation.setState('play'); // Both Pokémon play together
    visitorAnimation.start();
    
    // Show visitor container
    visitorContainer.style.display = 'block';
    
    // Position visitor relative to host
    updateVisitorPosition();
    
    console.log(`Visitor sprite shown: ${visitorUsername}'s ${species}`);
  } catch (error) {
    console.error('Failed to show visitor sprite:', error);
    hideVisitor();
  }
}

function hideVisitor() {
  // Gracefully handle case where no visitor is present
  if (!visitorAnimation && visitorContainer.style.display === 'none') {
    console.log('No visitor to hide');
    return;
  }
  
  console.log('Hiding visitor sprite');
  
  if (visitorAnimation) {
    visitorAnimation.stop();
    visitorAnimation = null;
  }
  
  visitorContainer.style.display = 'none';
  visitorSprite.src = '';
}

function updateVisitorPosition() {
  if (!visitorAnimation) return;
  
  try {
    // Host is at 0,0 within the window
    // Visitor should be offset from host
    const visitorX = 100; // 100px to the right
    const visitorY = 50;  // 50px down
    
    visitorContainer.style.left = `${visitorX}px`;
    visitorContainer.style.top = `${visitorY}px`;
  } catch (error) {
    console.error('Failed to update visitor position:', error);
  }
}

// === Drag and Drop (Host Only) ===

let isDragging = false;

// Disable click-through on the host sprite element itself
hostSprite.addEventListener('mouseenter', () => {
  window.electronAPI.setIgnoreMouseEvents(false);
});

hostSprite.addEventListener('mouseleave', () => {
  window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
});

// Manual drag implementation (avoiding -webkit-app-region which blocks context menu)
hostSprite.addEventListener('mousedown', (e) => {
  // Right-click should not start drag
  if (e.button === 2) {
    return;
  }
  
  isDragging = true;
  const startX = e.screenX;
  const startY = e.screenY;
  
  // Trigger drag animation
  if (hostAnimation) {
    hostAnimation.setState('drag');
  }
  
  window.electronAPI.startDrag(startX, startY);
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    
    // Return to idle animation
    if (hostAnimation) {
      hostAnimation.setState('idle');
    }
    
    window.electronAPI.stopDrag();
  }
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    window.electronAPI.dragMove(e.screenX, e.screenY);
    // Visitor position is fixed relative to host container, no update needed during drag
  }
});

// Right-click context menu
hostSprite.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.electronAPI.showContextMenu();
});

// Double-click also shows context menu (more intuitive)
hostSprite.addEventListener('dblclick', (e) => {
  e.preventDefault();
  window.electronAPI.showContextMenu();
});

// Handle menu actions
window.electronAPI.onMenuAction((action) => {
  if (action === 'feed') {
    // Trigger eat animation on host only
    if (hostAnimation) {
      hostAnimation.setState('eat');
    }
    window.electronAPI.feedPokemon();
  } else if (action === 'play') {
    // Trigger play animation on both host and visitor
    if (hostAnimation) {
      hostAnimation.setState('play');
    }
    if (visitorAnimation) {
      visitorAnimation.setState('play');
    }
    window.electronAPI.playPokemon();
  } else if (action === 'toggle-visitor') {
    // Toggle test visitor (temporary debug feature)
    if (visitorAnimation) {
      console.log('Menu: Hiding visitor');
      hideVisitor();
    } else {
      const testSpecies = ['charmander', 'squirtle', 'bulbasaur'];
      const randomSpecies = testSpecies[Math.floor(Math.random() * testSpecies.length)];
      console.log('Menu: Showing visitor:', randomSpecies);
      showVisitor(randomSpecies, 'TestVisitor');
    }
  }
});

// === Testing Shortcut (Temporary - Remove before production) ===
document.addEventListener('keydown', (e) => {
  console.log('Key pressed:', e.key, 'Meta:', e.metaKey, 'Visitor active:', !!visitorAnimation);
  
  if (e.key === 'v' && e.metaKey) { // Cmd+V on macOS
    e.preventDefault(); // Prevent any default paste behavior
    
    if (visitorAnimation) {
      console.log('Hiding visitor...');
      hideVisitor();
    } else {
      // Toggle between different species for testing
      const testSpecies = ['charmander', 'squirtle', 'bulbasaur'];
      const randomSpecies = testSpecies[Math.floor(Math.random() * testSpecies.length)];
      console.log('Showing visitor:', randomSpecies);
      showVisitor(randomSpecies, 'TestVisitor');
    }
    console.log('⌨️  Visitor toggle (Cmd+V) - this is a temporary testing shortcut');
  }
});

console.log('Multi-sprite renderer initialized. Press Cmd+V to toggle test visitor.');
