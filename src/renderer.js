const { ipcRenderer } = require('electron');

const sprite = document.getElementById('sprite');

let isDragging = false;

// Disable click-through on the sprite element itself
sprite.addEventListener('mouseenter', () => {
  ipcRenderer.send('set-ignore-mouse-events', false);
});

sprite.addEventListener('mouseleave', () => {
  ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
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
  
  ipcRenderer.send('start-drag', { startX, startY });
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    ipcRenderer.send('stop-drag');
  }
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    ipcRenderer.send('drag-move', { screenX: e.screenX, screenY: e.screenY });
  }
});

// Right-click context menu
sprite.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  ipcRenderer.send('show-context-menu');
});

// Handle menu actions
ipcRenderer.on('menu-feed', () => {
  ipcRenderer.send('feed-pokemon');
});

ipcRenderer.on('menu-play', () => {
  ipcRenderer.send('play-pokemon');
});
