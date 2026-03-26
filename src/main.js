const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { initDB, closeDB, savePosition, loadPosition, saveStats, loadStats, getStats } = require('./database');

let mainWindow;
let savePositionTimeout;
let decayInterval;
let dragStartPosition = null;
let windowStartPosition = null;

app.on('ready', () => {
  try {
    initDB();
    createWindow();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    app.quit();
  }
});

function createWindow() {
  // Load saved position if exists
  const savedPosition = loadPosition();
  
  // Load and log stats
  const stats = loadStats();
  console.log(`Bulbasaur stats - Hunger: ${stats.hunger}, Happiness: ${stats.happiness}`);
  
  const windowOptions = {
    width: 256,
    height: 256,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  };
  
  // Apply saved position if valid
  if (savedPosition) {
    windowOptions.x = savedPosition.x;
    windowOptions.y = savedPosition.y;
  }
  
  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

  // Enable click-through for the window, except when clicking on the sprite
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Handle IPC from renderer to toggle mouse events
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });

  // Handle manual drag events
  ipcMain.on('start-drag', (event, { startX, startY }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      dragStartPosition = { x: startX, y: startY };
      const bounds = win.getBounds();
      windowStartPosition = { x: bounds.x, y: bounds.y };
    }
  });

  ipcMain.on('drag-move', (event, { screenX, screenY }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && dragStartPosition && windowStartPosition) {
      const deltaX = screenX - dragStartPosition.x;
      const deltaY = screenY - dragStartPosition.y;
      win.setPosition(
        windowStartPosition.x + deltaX,
        windowStartPosition.y + deltaY
      );
    }
  });

  ipcMain.on('stop-drag', () => {
    dragStartPosition = null;
    windowStartPosition = null;
  });

  // Handle context menu request
  ipcMain.on('show-context-menu', (event) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Feed',
        click: () => {
          event.sender.send('menu-feed');
        }
      },
      {
        label: 'Play',
        click: () => {
          event.sender.send('menu-play');
        }
      }
    ]);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });

  // Handle feed interaction
  ipcMain.on('feed-pokemon', () => {
    const stats = getStats();
    const newHunger = Math.min(100, stats.hunger + 20);
    saveStats(newHunger, stats.happiness);
    console.log(`Fed Pokémon! Hunger: ${stats.hunger} → ${newHunger}`);
  });

  // Handle play interaction
  ipcMain.on('play-pokemon', () => {
    const stats = getStats();
    const newHappiness = Math.min(100, stats.happiness + 15);
    saveStats(stats.hunger, newHappiness);
    console.log(`Played with Pokémon! Happiness: ${stats.happiness} → ${newHappiness}`);
  });

  mainWindow.on('ready-to-show', () => {
    console.log('Window ready to show - frameless transparent overlay');
    mainWindow.show();
    
    // Start hunger decay timer
    decayInterval = setInterval(() => {
      const stats = getStats();
      let newHunger = Math.max(0, stats.hunger - 1);
      let newHappiness = stats.happiness;
      
      // If hunger reaches 0, decrease happiness
      if (newHunger === 0 && stats.happiness > 0) {
        newHappiness = Math.max(0, stats.happiness - 1);
        console.log(`Pokémon is starving! Happiness decreased: ${stats.happiness} → ${newHappiness}`);
      }
      
      if (newHunger !== stats.hunger || newHappiness !== stats.happiness) {
        saveStats(newHunger, newHappiness);
        console.log(`Hunger decay: ${stats.hunger} → ${newHunger}`);
      }
    }, 10000); // Every 10 seconds
  });

  // Save window position on move (debounced)
  mainWindow.on('move', () => {
    if (savePositionTimeout) {
      clearTimeout(savePositionTimeout);
    }
    
    savePositionTimeout = setTimeout(() => {
      const bounds = mainWindow.getBounds();
      savePosition(bounds.x, bounds.y);
    }, 500);
  });

  mainWindow.on('closed', () => {
    if (decayInterval) {
      clearInterval(decayInterval);
      decayInterval = null;
    }
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  closeDB();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
