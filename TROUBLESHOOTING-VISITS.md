# Visit Sending Troubleshooting Guide

## Symptom: Failed to send visit from alice to bob (or vice versa)

### Verification Checklist

#### 1. Backend Server Running
```bash
# Check if server is running
curl http://localhost:3000/api/auth/login
# Expected: {"error":"Username and password required"}
```

#### 2. Users Exist and Are Friends
```bash
./debug-visits.sh
# Should show:
# - alice (ID 3764), bob (ID 3765)
# - Friendship status: accepted
```

#### 3. Active Pokémon Set
```bash
sqlite3 ~/Library/Application\ Support/Electron/pokepals.db \
  "SELECT id, species, active_pokemon FROM pokemon WHERE active_pokemon = 1;"
# Expected: One row with active_pokemon = 1
```

#### 4. Token Stored After Login
**In Electron DevTools Console:**
```javascript
localStorage.getItem('authToken')
// Should return: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Common Issues

#### Issue A: "Not friends with user" alert
**Cause:** Friendship not accepted or doesn't exist

**Fix:**
1. Check database: `./debug-visits.sh`
2. Verify friendship shows `status=accepted`
3. If status is `pending`, accept the friend request in the app

#### Issue B: No alert, animation plays but nothing happens
**Cause:** API request failing silently

**Debug:**
1. Open DevTools: View → Toggle Developer Tools
2. Go to Console tab
3. Try sending visit again
4. Look for error messages starting with `[Visit]`
5. Check Network tab for failed requests to `/api/visits`

#### Issue C: "Host user not found" alert
**Cause:** hostUserId is incorrect or undefined

**Debug:**
```javascript
// In DevTools Console, check what's being sent:
window.electronAPI.onSendVisit(({hostUserId, hostUsername, pokemonSpecies}) => {
  console.log('hostUserId:', hostUserId, 'type:', typeof hostUserId);
  console.log('hostUsername:', hostUsername);
  console.log('pokemonSpecies:', pokemonSpecies);
});
```

**Common cause:** hostUserId is a string instead of number

**Fix in code:** Ensure friend.id is stored as number in friends cache

#### Issue D: "Valid pokemon_species required" alert
**Cause:** pokemon_species is undefined or invalid

**Debug:**
1. Check active Pokémon is set:
   ```bash
   sqlite3 ~/Library/Application\ Support/Electron/pokepals.db \
     "SELECT species FROM pokemon WHERE active_pokemon = 1;"
   ```
2. Verify species is one of: bulbasaur, charmander, squirtle

### Manual API Test

Test the API directly to verify backend works:

```bash
# 1. Login as alice
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"test1234"}')

echo $RESPONSE

# Extract token (manual - copy the token value)
TOKEN="<paste token here>"

# 2. Send visit to bob (ID 3765)
curl -X POST http://localhost:3000/api/visits \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"host_user_id": 3765, "pokemon_species": "charmander"}'

# Expected: {"visitId":251,"expiresAt":"2026-04-08 20:06:58"}
# If this works, the backend is fine - issue is in frontend
```

### Frontend Debugging Steps

1. **Check friends cache populated:**
   ```javascript
   // In main.js, add log after friends cache update:
   console.log('[Main] Cached friends:', cachedFriends);
   ```

2. **Check menu click handler receives correct data:**
   ```javascript
   // In main.js, in the 'Send Visit' click handler:
   click: async () => {
     const activePokemon = getActivePokemon();
     console.log('[Main] Send Visit clicked');
     console.log('[Main] Friend:', friend);
     console.log('[Main] Active Pokemon:', activePokemon);
     // ...
   }
   ```

3. **Check IPC message sent:**
   ```javascript
   // In main.js:
   event.sender.send('send-visit', {
     hostUserId: friend.id,
     hostUsername: friend.username,
     pokemonSpecies: activePokemon.species
   });
   console.log('[Main] Sent send-visit IPC:', { hostUserId: friend.id, pokemonSpecies: activePokemon.species });
   ```

4. **Check renderer receives IPC:**
   ```javascript
   // In renderer.js onSendVisit:
   window.electronAPI.onSendVisit(async ({ hostUserId, hostUsername, pokemonSpecies }) => {
     console.log('[Visit] IPC received:', { hostUserId, hostUsername, pokemonSpecies });
     console.log('[Visit] hostUserId type:', typeof hostUserId);
     // ...
   });
   ```

### Most Likely Causes

1. **Friends cache empty** - Login process didn't fetch friends list
2. **Friend ID wrong type** - friend.id is string instead of number
3. **Active Pokémon not found** - getActivePokemon() returns null
4. **Token expired** - Stored token is invalid (logout and login again)

### Quick Fix Attempt

1. **Quit the app completely** (Cmd+Q)
2. **Clear localStorage:**
   - Delete token: rm ~/Library/Application\ Support/Electron/pokepals.db (or don't, just re-login)
3. **Restart backend:** Ctrl+C in server terminal, then `npm run dev`
4. **Launch app fresh:** `npm start`
5. **Login as alice with DevTools open**
6. **Check Console for:**
   - `[Auth UI] Friends fetched: N friends`
   - `[Main] Friends cache updated: N friends`
7. **Try sending visit with DevTools Network tab open**
8. **Look for POST to `/api/visits`**

If you share the console logs and Network tab results, I can pinpoint the exact issue.
