# PokePals

A cross-platform desktop pet application where Pokémon sprites live on your screen as animated companions. Feed them, play with them, and send them to visit your friends' desktops.

![Pokémon Desktop Pet](docs/screenshot-placeholder.png)

## Features

### 🎮 Interactive Desktop Pet
- **Transparent overlay window** that sits on top of your desktop
- **Drag and reposition** your Pokémon anywhere on screen
- **Persistent state** — your Pokémon remembers its position and stats between sessions
- **Three starter Pokémon:** Bulbasaur, Charmander, Squirtle

### 🎬 Rich Animations
- **Four animation states:** idle (breathing), drag (reluctant), eat (satisfied), play (joyful)
- **Frame-by-frame animation** with 15-36 frames per action for smooth, expressive motion
- **Emotional clarity** — animations communicate personality through visible motion
- **Red/Blue pixel art aesthetic** preserved with chunky, nostalgic sprites

### 🤝 Multiplayer Social Features
- **User accounts** with JWT authentication
- **Friend system** — search users, send/accept friend requests
- **Visit system** — send your Pokémon to visit friends' desktops
- **Multi-visitor support** — up to 3 visiting Pokémon can appear simultaneously
- **System notifications** when friends visit
- **Smooth entrance/exit animations** for visiting Pokémon

### 📊 Stats & Care System
- **Hunger** — decays over time, restored by feeding
- **Happiness** — increases when you play, decreases when hungry
- **Persistent stats** stored in local SQLite database

## Installation

### Prerequisites
- **Node.js** v18+ ([download](https://nodejs.org/))
- **npm** v9+ (included with Node.js)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/pokepals.git
   cd pokepals
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Rebuild native modules for Electron:**
   ```bash
   npx electron-rebuild
   ```

4. **Start the backend server** (in a separate terminal):
   ```bash
   cd server
   npm install
   npm start
   ```
   Server runs on `http://localhost:3000`

5. **Start the desktop app:**
   ```bash
   npm start
   ```

## Usage

### First Launch
1. App opens with login screen
2. Click "Register" to create an account
3. Choose your starter Pokémon (Bulbasaur, Charmander, or Squirtle)
4. Your Pokémon appears on your desktop!

### Interacting with Your Pokémon
- **Move:** Click and drag the sprite anywhere on screen
- **Feed:** Right-click sprite → Feed (restores hunger)
- **Play:** Right-click sprite → Play (increases happiness)
- **Switch Pokémon:** Right-click → Switch Active Pokemon

### Social Features
- **Add friends:** Right-click → Friends → Add Friend → search by username
- **Accept requests:** Right-click → Friends → Friend Requests
- **Send visit:** Right-click → Friends → [friend name] → Send Visit
- **Dismiss visitor:** Right-click visiting Pokémon → Send Home

### Stats
- **View stats:** Right-click sprite → View Stats
- **Hunger** decays slowly when app is running
- **Happiness** decreases when hunger is critically low

## Project Structure

```
pokepals/
├── src/
│   ├── main.js              # Electron main process
│   ├── renderer.js          # UI logic
│   ├── preload.js           # IPC bridge
│   ├── animation.js         # Animation state machine
│   ├── database.js          # SQLite wrapper
│   ├── auth.js              # Authentication client
│   └── assets/
│       └── sprites/         # Pokémon sprite frames
├── server/
│   ├── server.js            # Express backend
│   ├── routes/              # API endpoints
│   └── tests/               # Backend tests (93 passing)
├── scripts/
│   ├── pixelDiffAnalysis.js # Animation quality verification
│   └── cullFrames.js        # Frame culling for GIF sources
└── .gsd/                    # Project documentation & planning
```

## Development

### Running Tests

**Backend tests:**
```bash
cd server
npm test
```

**Animation quality verification:**
```bash
node scripts/pixelDiffAnalysis.js bulbasaur eat
node scripts/pixelDiffAnalysis.js charmander play
node scripts/pixelDiffAnalysis.js squirtle eat
```

### Animation System

The animation system uses:
- **requestAnimationFrame** with FPS throttling (3-6 FPS)
- **Nearest-neighbor scaling** to preserve pixel art
- **Motion visibility baseline:** ≥1% pixel difference between frames
- **State machine:** idle (loop) → eat/play (one-shot) → return to idle

See `.gsd/KNOWLEDGE.md` for animation patterns and technical details.

### Database

Local SQLite database stored at:
- **macOS:** `~/Library/Application Support/Electron/pokepals.db`
- **Windows:** `%APPDATA%/Electron/pokepals.db`
- **Linux:** `~/.config/Electron/pokepals.db`

Stores: Pokémon stats, species, position, active selection.

## Architecture

### Client (Electron)
- **Main process:** Window management, IPC handlers, context menus
- **Renderer process:** Animation, sprite display, auth UI
- **Preload:** Secure IPC bridge with context isolation

### Server (Node.js + Express)
- **Authentication:** JWT tokens (24h expiration)
- **Friends API:** Bidirectional friendship model
- **Visits API:** Asynchronous visit creation with 24h TTL
- **Database:** SQLite with better-sqlite3

### Key Patterns
- **Async menu construction** — Pre-fetch data in renderer, cache in main, build menu synchronously
- **IPC lifecycle events** — Login/logout trigger window transitions
- **Frame culling** — Remove interpolated frames from GIF sources to meet motion visibility threshold
- **Conservative transformations** — ±2-4px shifts, ±4° tilts for visible motion without exaggeration

## Known Limitations

- **Multi-visitor cap:** Currently supports up to 3 simultaneous visitors (architecture supports more)
- **Token expiration:** No refresh token — users must re-login after 24 hours
- **No real-time notifications:** Friend requests/visits don't trigger instant alerts (could add WebSocket)
- **Animation coverage:** Not all species have full 36-frame eat/play animations yet
- **Cross-platform testing:** Primary development on macOS, Windows/Linux need validation

## Roadmap

- [x] **M001:** Single-player desktop pet (Bulbasaur only)
- [x] **M002:** Multi-starter system (3 species)
- [x] **M003:** Animated sprite frames (2-frame loops)
- [x] **M004:** Multiplayer visits with authentication
- [x] **M005:** Enhanced animations (8-36 frame sequences) ⬅️ **Current**
- [ ] **M006:** Additional Pokémon species
- [ ] **M007:** Evolution system
- [ ] **M008:** Cross-platform packaging & distribution

See `.gsd/milestones/` for detailed planning documents.

## Contributing

This project follows the **GSD (Get Shit Done)** methodology:
- See `.gsd/REQUIREMENTS.md` for capability contract
- See `.gsd/DECISIONS.md` for architectural decisions
- See `.gsd/KNOWLEDGE.md` for technical patterns
- See `.gsd/milestones/` for roadmap and slice planning

### Development Workflow
1. Read relevant slice plan in `.gsd/milestones/M00X/slices/S0X/`
2. Implement according to plan
3. Verify with provided verification commands
4. Write summary documenting what was built

## Credits

- **Pokémon sprites:** Original Red/Blue game sprites from [PokémonDB](https://pokemondb.net/)
- **Animation frames:** Sourced from pokemondb.net, culled and verified for quality
- **Framework:** Built with Electron, Node.js, SQLite

## License

[MIT License](LICENSE) — free to use, modify, and distribute.

---

**Note:** Pokémon is a trademark of Nintendo/Game Freak/Creatures Inc. This is a fan project and is not affiliated with or endorsed by Nintendo.
