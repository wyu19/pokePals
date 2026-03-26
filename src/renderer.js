const sprite = document.getElementById('sprite');

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
  
  window.electronAPI.startDrag(startX, startY);
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
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
    window.electronAPI.feedPokemon();
  } else if (action === 'play') {
    window.electronAPI.playPokemon();
  }
});
