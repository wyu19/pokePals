// Multi-Sprite Renderer — M004/S02
console.log('🎮 Renderer.js loading...');

// Global flag to prevent sprite handlers from enabling click-through when dialogs are open
let dialogOpen = false;

// Disable click-through immediately when renderer loads
if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
  console.log('[Renderer] Disabling click-through on load');
  window.electronAPI.setIgnoreMouseEvents(false);
} else {
  console.error('[Renderer] electronAPI.setIgnoreMouseEvents NOT AVAILABLE!');
}

// Get sprite elements
const hostSprite = document.getElementById('host-sprite');
const hostContainer = document.getElementById('host-container');

console.log('Elements found:', {
  hostSprite: !!hostSprite,
  hostContainer: !!hostContainer
});

// Initialize animation state machines
let hostAnimation = null;

// Track active visitors (replaces singleton visitorAnimation/currentVisitId pattern)
const visitors = [];

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
  
  // Check for pending visits after animation system is ready
  checkPendingVisits();
}).catch(err => {
  console.error('Error loading active Pokemon:', err);
  // Fallback to bulbasaur
  hostAnimation = new AnimationStateMachine('bulbasaur', hostSprite);
  hostAnimation.start();
  
  hostContainer.style.left = '0px';
  hostContainer.style.top = '0px';
  
  // Still check for pending visits even on error
  checkPendingVisits();
});

// Check for pending visits from login screen handoff
function checkPendingVisits() {
  const pendingVisitsJSON = localStorage.getItem('pendingVisits');
  if (pendingVisitsJSON) {
    try {
      const visits = JSON.parse(pendingVisitsJSON);
      localStorage.removeItem('pendingVisits');
      
      if (visits.length > 0) {
        console.log(`[Visit] ${visits.length} active visit(s) detected`);
        
        // Iterate all visits and add each one
        visits.forEach(visit => {
          console.log(`[Visit] Processing visit: ${visit.visitorUsername}'s ${visit.pokemonSpecies}`);
          
          // Show system notification for each visit
          showVisitNotification(visit.visitorUsername, visit.pokemonSpecies);
          
          // Add visitor sprite
          addVisitor(visit);
        });
      }
    } catch (error) {
      console.error('[Visit] Failed to parse pending visits:', error);
    }
  }
}

// Show system notification for visit
function showVisitNotification(visitorUsername, pokemonSpecies) {
  const capitalizedSpecies = pokemonSpecies.charAt(0).toUpperCase() + pokemonSpecies.slice(1);
  window.electronAPI.showNotification({
    title: 'Pokémon Visit!',
    body: `${visitorUsername}'s ${capitalizedSpecies} is visiting!`
  });
}

// Listen for Pokemon switch events
window.electronAPI.onPokemonSwitch((species) => {
  if (hostAnimation) {
    console.log(`Species changed to ${species}`);
    hostAnimation.setSpecies(species);
  }
});

// === Multi-Sprite Visitor Functions ===

function addVisitor(visit) {
  const { id: visitId, visitorUsername, pokemonSpecies } = visit;
  
  console.log(`[Visit] Adding visitor ${visitId}: ${visitorUsername}'s ${pokemonSpecies}`);
  
  // Validate species
  const validSpecies = ['bulbasaur', 'charmander', 'squirtle'];
  if (!validSpecies.includes(pokemonSpecies)) {
    console.error(`[Visit] Invalid species: ${pokemonSpecies}`);
    return;
  }
  
  // Create visitor container
  const container = document.createElement('div');
  container.id = `visitor-container-${visitId}`;
  container.style.position = 'absolute';
  container.style.display = 'block';
  
  // Create visitor sprite
  const sprite = document.createElement('img');
  sprite.id = `visitor-sprite-${visitId}`;
  sprite.className = 'sprite';
  sprite.draggable = false;
  sprite.alt = `${visitorUsername}'s ${pokemonSpecies}`;
  sprite.dataset.visitId = visitId; // Attach visitId for context menu
  
  container.appendChild(sprite);
  document.body.appendChild(container);
  
  // Position visitor at progressive horizontal offset
  const visitorIndex = visitors.length;
  const xOffset = visitorIndex * 100; // 100px spacing (96px sprite + 4px gap)
  const yOffset = 50; // Fixed vertical offset
  
  container.style.left = `${xOffset}px`;
  container.style.top = `${yOffset}px`;
  
  // Create animation state machine
  const animation = new AnimationStateMachine(pokemonSpecies, sprite);
  animation.setState('play'); // Visitors play together
  animation.start();
  
  // Attach context menu handler
  sprite.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showVisitorContextMenu(visitId);
  });
  
  // Track visitor
  visitors.push({
    visitId,
    species: pokemonSpecies,
    username: visitorUsername,
    container,
    sprite,
    animation
  });
  
  console.log(`[Visit] Visitor ${visitId} added at position (${xOffset}, ${yOffset}). Total visitors: ${visitors.length}`);
}

function removeVisitor(visitId) {
  console.log(`[Visit] Removing visitor ${visitId}`);
  
  const index = visitors.findIndex(v => v.visitId === visitId);
  
  if (index === -1) {
    console.warn(`[Visit] Visitor ${visitId} not found`);
    return;
  }
  
  // Stop animation and remove DOM
  const visitor = visitors[index];
  visitor.animation.stop();
  visitor.container.remove();
  
  // Remove from array
  visitors.splice(index, 1);
  
  console.log(`[Visit] Visitor ${visitId} removed. Remaining visitors: ${visitors.length}`);
  
  // Close gaps by repositioning remaining visitors
  visitors.forEach((v, idx) => {
    const xOffset = idx * 100;
    v.container.style.left = `${xOffset}px`;
  });
}

function showVisitorContextMenu(visitId) {
  console.log(`[Visit] Showing context menu for visitor ${visitId}`);
  window.electronAPI.showVisitorContextMenu(visitId);
}

// === Drag and Drop (Host Only) ===

let isDragging = false;

// Disable click-through on the host sprite element itself
hostSprite.addEventListener('mouseenter', () => {
  if (!dialogOpen) {
    window.electronAPI.setIgnoreMouseEvents(false);
  }
});

hostSprite.addEventListener('mouseleave', () => {
  if (!dialogOpen) {
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  }
});

// Visitor sprites get event listeners dynamically in addVisitor()
// Each visitor container/sprite is created on-demand with its own handlers

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

// === Add Friend Dialog Logic ===

let searchTimeout = null;

// IPC listener for showing Add Friend dialog
window.electronAPI.onShowAddFriendDialog(() => {
  console.log('[Friends] Opening Add Friend dialog');
  openAddFriendDialog();
});

// IPC listener for showing Friend Requests dialog
window.electronAPI.onShowFriendRequestsDialog(() => {
  console.log('[Friends] Opening Friend Requests dialog');
  openFriendRequestsDialog();
});

function openAddFriendDialog() {
  // Set global flag to prevent sprite handlers from interfering
  dialogOpen = true;
  
  // Disable click-through while dialog is open
  window.electronAPI.setIgnoreMouseEvents(false);
  
  const dialog = document.getElementById('add-friend-dialog');
  const searchInput = document.getElementById('friend-search-input');
  const searchResults = document.getElementById('friend-search-results');
  
  // Show dialog
  dialog.style.display = 'flex';
  
  // Clear previous search
  searchInput.value = '';
  searchResults.innerHTML = '';
  
  // Focus search input
  setTimeout(() => searchInput.focus(), 100);
  
  console.log('[Friends] Add Friend dialog opened');
}

function closeAddFriendDialog() {
  const dialog = document.getElementById('add-friend-dialog');
  const searchInput = document.getElementById('friend-search-input');
  const searchResults = document.getElementById('friend-search-results');
  
  // Clear timeout if active
  if (searchTimeout) {
    clearTimeout(searchTimeout);
    searchTimeout = null;
  }
  
  // Hide dialog
  dialog.style.display = 'none';
  
  // Clear input and results
  searchInput.value = '';
  searchResults.innerHTML = '';
  
  // Clear global flag - allow sprite handlers to manage click-through again
  dialogOpen = false;
  
  console.log('[Friends] Add Friend dialog closed');
}

function handleSearchInput(e) {
  const query = e.target.value.trim();
  const searchResults = document.getElementById('friend-search-results');
  
  // Clear existing timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
    searchTimeout = null;
  }
  
  // Don't search if query is too short
  if (query.length < 2) {
    searchResults.innerHTML = '';
    return;
  }
  
  // Debounce: wait 300ms after last keystroke
  searchTimeout = setTimeout(() => {
    performSearch(query);
  }, 300);
}

async function performSearch(query) {
  const searchResults = document.getElementById('friend-search-results');
  
  try {
    console.log(`[Friends] Search: q="${query}"`);
    
    // Show loading state
    searchResults.innerHTML = '<div class="search-no-results">Searching...</div>';
    
    // Fetch search results
    const response = await window.auth.authenticatedFetch(`/users/search?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    // Backend returns array directly, not {users: [...]}
    const users = Array.isArray(data) ? data : [];
    
    console.log(`[Friends] Search: q="${query}", found ${users.length} results`);
    
    // Render results
    if (users.length === 0) {
      searchResults.innerHTML = '<div class="search-no-results">No users found.</div>';
    } else {
      renderSearchResults(users);
    }
  } catch (error) {
    console.error('[Friends] Search failed:', error);
    searchResults.innerHTML = '<div class="search-error">Search failed. Try again.</div>';
  }
}

function renderSearchResults(users) {
  const searchResults = document.getElementById('friend-search-results');
  
  // Clear previous results
  searchResults.innerHTML = '';
  
  // Render each user
  users.forEach(user => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';
    
    const username = document.createElement('span');
    username.textContent = user.username;
    
    const addButton = document.createElement('button');
    addButton.textContent = 'Add Friend';
    addButton.dataset.userId = user.id;
    addButton.addEventListener('click', () => sendFriendRequest(user.id, user.username));
    
    resultItem.appendChild(username);
    resultItem.appendChild(addButton);
    searchResults.appendChild(resultItem);
  });
}

async function sendFriendRequest(targetUserId, targetUsername) {
  try {
    console.log(`[Friends] Sending friend request to user ${targetUserId} (${targetUsername})`);
    
    const response = await window.auth.authenticatedFetch('/friends/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target_user_id: targetUserId }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 409) {
        alert('Request already sent or you\'re already friends.');
      } else if (response.status === 404) {
        alert('User not found.');
      } else {
        alert(data.error || 'Request failed. Try again.');
      }
      console.log(`[Friends] Send request failed: ${data.error}`);
      return;
    }
    
    console.log('[Friends] Friend request sent successfully');
    
    // Close dialog on success
    closeAddFriendDialog();
    
    // Optionally show success message
    alert(`Friend request sent to ${targetUsername}!`);
  } catch (error) {
    console.error('[Friends] Send request failed:', error);
    alert('Request failed. Try again.');
  }
}

// === Friend Requests Dialog Logic ===

function openFriendRequestsDialog() {
  // Set global flag to prevent sprite handlers from interfering
  dialogOpen = true;
  
  const dialog = document.getElementById('friend-requests-dialog');
  
  // Disable click-through while dialog is open
  window.electronAPI.setIgnoreMouseEvents(false);
  
  // Show dialog
  dialog.style.display = 'flex';
  
  // Load requests
  loadFriendRequests();
  
  console.log('[Friends] Friend Requests dialog opened');
}

function closeFriendRequestsDialog() {
  const dialog = document.getElementById('friend-requests-dialog');
  const requestsList = document.getElementById('friend-requests-list');
  
  // Hide dialog
  dialog.style.display = 'none';
  
  // Clear list
  requestsList.innerHTML = '';
  
  // Clear global flag - allow sprite handlers to manage click-through again
  dialogOpen = false;
  
  console.log('[Friends] Friend Requests dialog closed');
}

async function loadFriendRequests() {
  const requestsList = document.getElementById('friend-requests-list');
  
  try {
    // Show loading state
    requestsList.innerHTML = '<div class="search-no-results">Loading...</div>';
    
    const response = await window.auth.authenticatedFetch('/friends/requests');
    
    if (!response.ok) {
      throw new Error(`Failed to load requests: ${response.status} ${response.statusText}`);
    }
    
    const requests = await response.json();
    
    console.log(`[Friends] Loaded ${requests.length} pending requests`);
    
    // Render requests
    renderFriendRequests(requests);
  } catch (error) {
    console.error('[Friends] Failed to load requests:', error);
    requestsList.innerHTML = '<div class="search-error">Failed to load requests.</div>';
  }
}

function renderFriendRequests(requests) {
  const requestsList = document.getElementById('friend-requests-list');
  
  // Clear previous content
  requestsList.innerHTML = '';
  
  // Handle empty state
  if (requests.length === 0) {
    requestsList.innerHTML = '<div class="search-no-results">No pending requests.</div>';
    return;
  }
  
  // Render each request
  requests.forEach(req => {
    const requestItem = document.createElement('div');
    requestItem.className = 'request-item';
    
    const username = document.createElement('span');
    username.textContent = req.requesterUsername;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'request-actions';
    
    const acceptButton = document.createElement('button');
    acceptButton.className = 'btn-accept';
    acceptButton.textContent = 'Accept';
    acceptButton.dataset.friendshipId = req.friendshipId;
    acceptButton.addEventListener('click', () => acceptFriendRequest(req.friendshipId));
    
    const declineButton = document.createElement('button');
    declineButton.className = 'btn-decline';
    declineButton.textContent = 'Decline';
    declineButton.dataset.friendshipId = req.friendshipId;
    declineButton.addEventListener('click', () => declineFriendRequest(req.friendshipId));
    
    actionsDiv.appendChild(acceptButton);
    actionsDiv.appendChild(declineButton);
    
    requestItem.appendChild(username);
    requestItem.appendChild(actionsDiv);
    requestsList.appendChild(requestItem);
  });
}

async function acceptFriendRequest(friendshipId) {
  try {
    console.log(`[Friends] Accepting friend request ${friendshipId}`);
    
    const response = await window.auth.authenticatedFetch('/friends/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ friendship_id: friendshipId }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 403) {
        alert('You cannot accept this request.');
      } else if (response.status === 404) {
        alert('Request not found.');
      } else {
        alert(data.error || 'Accept failed. Try again.');
      }
      console.log(`[Friends] Accept failed: ${data.error}`);
      return;
    }
    
    console.log('[Friends] Request accepted');
    
    // Refresh friends cache
    await refreshFriendsCache();
    
    // Reload requests to update UI
    await loadFriendRequests();
  } catch (error) {
    console.error('[Friends] Accept failed:', error);
    alert('Accept failed. Try again.');
  }
}

async function declineFriendRequest(friendshipId) {
  try {
    console.log(`[Friends] Declining friend request ${friendshipId}`);
    
    const response = await window.auth.authenticatedFetch('/friends/decline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ friendship_id: friendshipId }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 404) {
        alert('Request not found.');
      } else {
        alert(data.error || 'Decline failed. Try again.');
      }
      console.log(`[Friends] Decline failed: ${data.error}`);
      return;
    }
    
    console.log('[Friends] Request declined');
    
    // Reload requests to update UI
    await loadFriendRequests();
  } catch (error) {
    console.error('[Friends] Decline failed:', error);
    alert('Decline failed. Try again.');
  }
}

async function refreshFriendsCache() {
  try {
    const response = await window.auth.authenticatedFetch('/friends');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch friends: ${response.status}`);
    }
    
    const friends = await response.json();
    
    console.log('[Friends] Cache refreshed');
    
    // Update main process cache
    window.electronAPI.updateFriendsCache(friends);
  } catch (error) {
    console.error('[Friends] Cache refresh failed:', error);
    // Don't block the accept workflow, cache stays stale
  }
}

// === Send Visit Flow ===

window.electronAPI.onSendVisit(async ({ hostUserId, hostUsername, pokemonSpecies }) => {
  try {
    console.log(`[Visit] Sending ${pokemonSpecies} to visit ${hostUsername}...`);
    
    const response = await window.auth.authenticatedFetch('/visits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host_user_id: hostUserId,
        pokemon_species: pokemonSpecies
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 409) {
        console.error('[Visit] Host already has a visitor');
        alert('Host already has a visitor');
      } else if (response.status === 403) {
        console.error('[Visit] Not friends with user');
        alert('Not friends with user');
      } else if (response.status === 400) {
        console.error(`[Visit] Bad request: ${data.error}`);
        alert(data.error || 'Invalid request');
      } else if (response.status === 404) {
        console.error('[Visit] Host user not found');
        alert('Host user not found');
      } else {
        console.error(`[Visit] Send failed: ${data.error}`);
        alert('Failed to send visit');
      }
      return;
    }
    
    console.log(`[Visit] Visit sent successfully (expires: ${data.expiresAt})`);
    alert(`${pokemonSpecies.charAt(0).toUpperCase() + pokemonSpecies.slice(1)} is now visiting ${hostUsername}!`);
  } catch (error) {
    console.error('[Visit] Network error:', error);
    alert('Failed to send visit');
  }
});

// === Send Home Flow ===

window.electronAPI.onSendHome(async (visitId) => {
  if (!visitId) {
    console.error('[Visit] No visitId provided to onSendHome');
    return;
  }
  
  try {
    console.log(`[Visit] Ending visit ${visitId}...`);
    
    const response = await window.auth.authenticatedFetch('/visits/end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ visit_id: visitId })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to end visit');
    }
    
    console.log('[Visit] Visit ended successfully');
    removeVisitor(visitId);
    alert('Visitor sent home!');
  } catch (error) {
    console.error('[Visit] End visit failed:', error);
    alert(`Failed to end visit: ${error.message}`);
  }
});

// ============================================================================
// PERMANENT EVENT LISTENERS FOR DIALOGS
// These are attached once on page load to avoid duplicate listener issues
// ============================================================================

function initializeDialogListeners() {
  // Add Friend Dialog event listeners
  const addFriendDialog = document.getElementById('add-friend-dialog');
  const addFriendClose = document.getElementById('add-friend-close');
  const friendSearchInput = document.getElementById('friend-search-input');

  if (addFriendClose) {
    addFriendClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAddFriendDialog();
    });
  }

  if (friendSearchInput) {
    friendSearchInput.addEventListener('input', handleSearchInput);
  }

  if (addFriendDialog) {
    // Close on overlay click
    addFriendDialog.addEventListener('click', (e) => {
      if (e.target === addFriendDialog) {
        closeAddFriendDialog();
      }
    });
  }

  // Close on Escape key (only when dialog is visible)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && addFriendDialog && addFriendDialog.style.display === 'flex') {
      closeAddFriendDialog();
    }
  });

  // Friend Requests Dialog event listeners
  const friendRequestsDialog = document.getElementById('friend-requests-dialog');
  const friendRequestsClose = document.getElementById('friend-requests-close');

  if (friendRequestsClose) {
    friendRequestsClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeFriendRequestsDialog();
    });
  }

  if (friendRequestsDialog) {
    // Close on overlay click
    friendRequestsDialog.addEventListener('click', (e) => {
      if (e.target === friendRequestsDialog) {
        closeFriendRequestsDialog();
      }
    });
  }

  // Close on Escape key (only when dialog is visible)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && friendRequestsDialog && friendRequestsDialog.style.display === 'flex') {
      closeFriendRequestsDialog();
    }
  });

  console.log('[Renderer] Dialog event listeners initialized');
}

// Initialize dialog listeners immediately (scripts are at end of body, DOM is ready)
initializeDialogListeners();


