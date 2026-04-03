const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Send methods - wrapping ipcRenderer.send() calls
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },
  
  startDrag: (startX, startY) => {
    ipcRenderer.send('start-drag', { startX, startY });
  },
  
  dragMove: (screenX, screenY) => {
    ipcRenderer.send('drag-move', { screenX, screenY });
  },
  
  stopDrag: () => {
    ipcRenderer.send('stop-drag');
  },
  
  showContextMenu: () => {
    ipcRenderer.send('show-context-menu');
  },
  
  feedPokemon: () => {
    ipcRenderer.send('feed-pokemon');
  },
  
  playPokemon: () => {
    ipcRenderer.send('play-pokemon');
  },
  
  switchPokemon: (species) => {
    ipcRenderer.send('switch-pokemon', species);
  },
  
  // Auth lifecycle events
  loginSuccess: () => {
    ipcRenderer.send('login-success');
  },
  
  logout: () => {
    ipcRenderer.send('logout');
  },
  
  // Friends management
  updateFriendsCache: (friends) => {
    ipcRenderer.send('update-friends-cache', friends);
  },
  
  onShowAddFriendDialog: (callback) => {
    ipcRenderer.on('show-add-friend-dialog', callback);
  },
  
  onShowFriendRequestsDialog: (callback) => {
    ipcRenderer.on('show-friend-requests-dialog', callback);
  },
  
  // Get active Pokemon (returns Promise)
  getActivePokemon: () => {
    return ipcRenderer.invoke('get-active-pokemon');
  },
  
  // Get current window position (returns Promise)
  getPosition: () => {
    return ipcRenderer.invoke('get-position');
  },
  
  // Receive method - wrapping both menu-feed and menu-play into single callback interface
  onMenuAction: (callback) => {
    // Remove any existing listeners to prevent duplicates
    ipcRenderer.removeAllListeners('menu-feed');
    ipcRenderer.removeAllListeners('menu-play');
    ipcRenderer.removeAllListeners('menu-toggle-visitor');
    
    // Register listeners that call the callback with action type
    ipcRenderer.on('menu-feed', () => {
      callback('feed');
    });
    
    ipcRenderer.on('menu-play', () => {
      callback('play');
    });
    
    ipcRenderer.on('menu-toggle-visitor', () => {
      callback('toggle-visitor');
    });
  },
  
  onPokemonSwitch: (callback) => {
    // Remove any existing listeners to prevent duplicates
    ipcRenderer.removeAllListeners('pokemon-switched');
    
    // Register listener for pokemon-switched event
    ipcRenderer.on('pokemon-switched', (event, species) => {
      callback(species);
    });
  },
  
  onSendVisit: (callback) => {
    // Remove any existing listeners to prevent duplicates
    ipcRenderer.removeAllListeners('send-visit');
    
    // Register listener for send-visit event
    ipcRenderer.on('send-visit', (event, data) => {
      callback(data);
    });
  },
  
  showVisitorContextMenu: (visitId) => {
    ipcRenderer.send('show-visitor-context-menu', visitId);
  },
  
  onSendHome: (callback) => {
    // Remove any existing listeners to prevent duplicates
    ipcRenderer.removeAllListeners('send-home');
    
    // Register listener for send-home event (receives visitId)
    ipcRenderer.on('send-home', (event, visitId) => {
      callback(visitId);
    });
  },
  
  showNotification: (options) => {
    ipcRenderer.send('show-notification', options);
  }
});
