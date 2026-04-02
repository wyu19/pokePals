const { app, BrowserWindow, ipcMain, Menu, Notification } = require('electron');
const path = require('path');
const { initDB, closeDB, savePosition, loadPosition, saveStats, loadStats, getStats, getActivePokemon, setActivePokemon, getAllPokemon } = require('./database');

let mainWindow;
let savePositionTimeout;
let decayInterval;
let dragStartPosition = null;
let windowStartPosition = null;
let cachedFriends = [];

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
    width: 400,  // Increased to accommodate visitor sprite at offset
    height: 350, // Increased to accommodate visitor sprite at offset
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    backgroundColor: '#00000000', // Explicit transparent background
    hasShadow: false, // Disable shadow to prevent compositor artifacts
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      offscreen: false // Ensure on-screen rendering
    }
  };
  
  // Apply saved position if valid
  if (savedPosition) {
    windowOptions.x = savedPosition.x;
    windowOptions.y = savedPosition.y;
  }
  
  mainWindow = new BrowserWindow(windowOptions);

  // Always start with login screen - it will auto-validate token and transition if valid
  console.log('[Main] Loading login screen...');
  mainWindow.loadFile(path.join(__dirname, 'login.html'));

  // DevTools disabled - S02 verified and complete
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  // Enable click-through for the window, except when clicking on the sprite
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Handle IPC from renderer to toggle mouse events
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });

  // Handle login success - transition from login screen to overlay
  ipcMain.on('login-success', () => {
    console.log('[Main] Login successful, loading overlay...');
    mainWindow.loadFile(path.join(__dirname, 'renderer.html'));
  });

  // Handle logout - return to login screen
  ipcMain.on('logout', () => {
    console.log('[Main] Logout requested, loading login screen...');
    mainWindow.loadFile(path.join(__dirname, 'login.html'));
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

  // Handle friends cache updates from renderer
  ipcMain.on('update-friends-cache', (event, friends) => {
    cachedFriends = friends;
    console.log(`[Main] Friends cache updated: ${friends.length} friends`);
  });
  
  // Handle system notification requests
  ipcMain.on('show-notification', (event, { title, body }) => {
    console.log(`[Main] Showing notification: ${title} - ${body}`);
    const notification = new Notification({ title, body });
    notification.show();
  });

  // Handle context menu request
  ipcMain.on('show-context-menu', (event) => {
    // Get all Pokemon to build submenu
    const allPokemon = getAllPokemon();
    const activePokemon = getActivePokemon();
    
    // Helper function to capitalize species name
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    
    // Build Switch Pokémon submenu
    const switchSubmenu = allPokemon.map(pokemon => ({
      label: capitalize(pokemon.species),
      type: 'checkbox',
      checked: pokemon.active_pokemon === 1,
      click: () => {
        // Call setActivePokemon and send the result back
        setActivePokemon(pokemon.species);
        const active = getActivePokemon();
        event.sender.send('pokemon-switched', active.species);
        console.log(`Switched to ${active.species}`);
      }
    }));
    
    // Build Friends submenu with dynamic friend list
    const friendsSubmenu = [
      {
        label: 'Add Friend...',
        click: () => {
          event.sender.send('show-add-friend-dialog');
        }
      },
      {
        label: 'Friend Requests',
        click: () => {
          event.sender.send('show-friend-requests-dialog');
        }
      },
      { type: 'separator' },
      ...cachedFriends.map(friend => ({
        label: friend.username,
        submenu: [
          {
            label: 'Send Visit',
            enabled: true,
            click: async () => {
              const activePokemon = getActivePokemon();
              event.sender.send('send-visit', {
                hostUserId: friend.id,
                hostUsername: friend.username,
                pokemonSpecies: activePokemon.species
              });
            }
          }
        ]
      }))
    ];
    
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
      },
      {
        label: 'Switch Pokémon',
        submenu: switchSubmenu
      },
      {
        label: 'Friends',
        submenu: friendsSubmenu
      },
      { type: 'separator' },
      {
        label: '[Debug] Toggle Test Visitor',
        click: () => {
          event.sender.send('menu-toggle-visitor');
        }
      }
    ]);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });

  // Handle visitor context menu request
  ipcMain.on('show-visitor-context-menu', (event) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Send Home',
        click: () => {
          event.sender.send('send-home');
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
  
  // Handle Pokemon switch
  ipcMain.on('switch-pokemon', (event, species) => {
    setActivePokemon(species);
    const active = getActivePokemon();
    event.sender.send('pokemon-switched', active.species);
    console.log(`Switched to ${active.species}`);
  });
  
  // Get active Pokemon for animation system
  ipcMain.handle('get-active-pokemon', async () => {
    const { getActivePokemon } = require('./database');
    return getActivePokemon();
  });
  
  // Get current window position
  ipcMain.handle('get-position', async () => {
    const bounds = mainWindow.getBounds();
    return { x: bounds.x, y: bounds.y };
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
