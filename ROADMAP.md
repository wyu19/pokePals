# PokePals Roadmap

## Completed Milestones

### ✅ M001: Single-Player Desktop Pet
- Transparent overlay window with draggable Bulbasaur sprite
- Right-click context menu (Feed, Play)
- Hunger/Happiness stats with decay
- SQLite persistence across restarts

### ✅ M002: Multi-Starter Animation System
- 3 starter Pokémon (Bulbasaur, Charmander, Squirtle)
- Species selection system
- Per-species stat tracking

### ✅ M003: Animated Sprite Frames
- 4 animation states: Idle (breathing), Drag (struggle), Eat (chewing), Play (bounce)
- 2-frame animations per state at 2-6 FPS
- Programmatic sprite generation via Sharp
- Red/Blue pixel art aesthetic preserved

### ✅ M004: Multiplayer Visit System
- JWT-based authentication with registration/login
- Friend system: search, request, accept/decline
- Asynchronous visits: send your Pokémon to visit friends
- System notifications when friends visit
- 24-hour auto-expiration
- 93 passing tests (33 auth, 34 friends, 26 visits)

---

## 🚀 Current Milestone: M005 - Enhanced Animations & Multi-Visitor Support

### Vision
Transform one-shot interactions (feed, play, visit) from static 2-frame loops into **rich 8-frame animation sequences** that communicate emotion and personality. Enable **multiple simultaneous visitors** on a single host's desktop, creating dynamic social scenes where multiple friends' Pokémon interact together.

### Key Features

#### 🎬 8-Frame Feed Animation
Following `src/assets/sprites/feedPrompt.txt`:
1. **Idle (Base)** - Neutral pose
2. **Notice Food** - Eyes widen, head tilts forward
3. **Grab Food** - Food sprite appears, hands raised
4. **Bite** - Mouth opens, food overlaps
5. **Chew (Left)** - Cheek bulge on left
6. **Chew (Right)** - Cheek bulge switches to right
7. **Happy Chew** - Content expression, slight bounce
8. **Swallow + Satisfied** - Return to smile

**Target:** ~2 seconds at 4 FPS with visible emotional beats

#### 🎮 8-Frame Play Animation
Following `src/assets/sprites/playPrompt.txt`:
1. **Idle (Base)** - Happy smile
2. **Get Excited** - Eyes widen, grin
3. **Start Play Motion** - Foot lifts, preparing to hop
4. **Hop Up** - Body rises 2px, feet off ground
5. **Mid-Air Play** - Slight tilt, tail curves
6. **Land Bounce** - Squash effect (1px shorter)
7. **Playful Action** - Paw/bat motion
8. **Return to Happy Idle** - Relaxed smile

**Target:** Dynamic movement with visible hop and land mechanics

#### 👥 Multi-Visitor Support
- **Remove single-visitor limitation** - Up to 3 simultaneous visitors per host
- **Staggered positioning** - Visitors at +100px, +200px, +300px offsets
- **Independent animations** - Each visitor animates in play state
- **Individual context menus** - Right-click any visitor to Send Home
- **Performance target** - 4 concurrent animations (1 host + 3 visitors) at >30 FPS

#### ✨ 8-Frame Entrance Animation
- **Polished arrivals** - Fade-in or hop-in animation when visitor first appears
- **One-shot animation** - Plays once, then transitions to play loop
- **No re-trigger** - Entrance only plays on initial arrival, not on app restart

### Slices

| Slice | Title | Risk | Status |
|-------|-------|------|--------|
| **S01** | 8-Frame Feed Animation Sprites | High | 🔲 Not Started |
| **S02** | 8-Frame Play Animation Sprites & Feed/Play Integration | Medium | 🔲 Not Started |
| **S03** | Multi-Visitor Backend & Frontend Rendering | High | 🔲 Not Started |
| **S04** | 8-Frame Visitor Entrance Animation | Low | 🔲 Not Started |

### Key Risks

1. **Animation Timing** - 8-frame sequences need careful FPS tuning to avoid feeling sluggish or rushed
2. **Sprite Generation Complexity** - Cheek bulges, food sprites, mid-air tilts may exceed Sharp's capabilities (fallback to manual pixel art)
3. **Multi-Visitor Z-Index** - Layering multiple sprites without occlusion or context menu conflicts
4. **Performance** - 4 simultaneous animations must maintain >30 FPS

### Deliverables

- **72 new sprite files** - 3 species × 3 new states × 8 frames
  - Feed: 24 files (feed-1.png through feed-8.png per species)
  - Play: 24 files (play-1.png through play-8.png per species)
  - Entrance: 24 files (entrance-1.png through entrance-8.png per species)
- **AnimationStateMachine enhancements** - Support for 8-frame sequences
- **Multi-visitor rendering system** - Array-based visitor management with staggered positioning
- **Backend schema updates** - Remove single-visitor constraint, support unlimited concurrent visits
- **Integration tests** - 8-frame animation behavior, multi-visitor rendering, performance benchmarks

---

## Future Milestones (Planned)

### M006: Evolution System
- Stats affect evolution (Charmander → Charmeleon → Charizard)
- Evolution sprites and animation sequences
- Progression milestones based on care quality

### M007: Additional Species & Interactions
- Expand beyond 3 starters
- Visitor-to-visitor interactions
- More animation states (sleep, sick, excited)

---

## Development Notes

**Animation Prompts:** See `src/assets/sprites/feedPrompt.txt` and `playPrompt.txt` for detailed frame-by-frame specifications.

**Quality Thresholds (from M003):**
- Motion visibility: ≥1% pixel difference between frames
- Emotional clarity: Manual inspection confirms prompt intent
- Alpha transparency: `hasAlpha: yes` for all frames
- Aesthetic consistency: No anti-aliasing, nearest-neighbor interpolation only

**Test Coverage Target:** Maintain 100% passing rate on existing 93 tests, add new tests for 8-frame behavior and multi-visitor scenarios.
