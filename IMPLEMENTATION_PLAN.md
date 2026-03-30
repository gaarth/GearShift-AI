# GearSwitch Dashboard — Implementation Plan

> **Aesthetic Direction:** *Minimal Industrial Pixel-RPG* — A top-down pixel art factory simulation in the GBA/RPG-Maker tradition. Muted, soft color palette. No neon. No loud colors. Clean tile-based zones where chibi pixel workers patrol industrial equipment. The UI chrome is minimal and stays out of the way — the simulation IS the interface.

> **DFII Score: 14/15** (Impact: 5, Fit: 5, Feasibility: 4, Performance: 4, Consistency Risk: -4)

> **Differentiation Anchor:** "If this were screenshotted with the logo removed, you'd recognize it as a top-down pixel factory — chunky industrial machines, tiny hard-hat workers patrolling tile floors, soft status glows in muted amber and grey-green. Nothing screams. Everything breathes."

---

## User Review Required

> ✅ **Machine Panel Visualization:** **2D top-down pixel art** rendering of the machine (matching the factory map art style). Static sprite with a soft pulsing status glow border. No rotation. Matches the GBA/RPG-Maker visual language of the factory canvas.

> [!IMPORTANT]
> ✅ **PixiJS Confirmed:** Using PixiJS + `@pixi/react` for the factory canvas simulation layer.

> [!WARNING]
> **Build Order Resequencing:** Your plan's hour-by-hour schedule has been restructured below for dependency correctness and maximum demo-readiness at every checkpoint. The factory map must render before workers can patrol it; state stores must exist before UI can consume them. The new order ensures a **demoable product at every 2-hour checkpoint.**

---

## Design System Snapshot

### Aesthetic Name: *Minimal Industrial Pixel-RPG*

**Key Inspiration:** GBA Pokemon/RPG Maker top-down indoor environments. Hospital/clinic and indoor workspace pixel maps (image 4 reference). Chibi character sprite sheets with 4-directional walk cycles (Pokemon trainer sprite style, images 1 & 2). Muted, desaturated palettes. Clean tile floors. Industrial equipment as simple top-down objects. The factory feels lived-in, not cinematic.

### Typography

| Role | Font | Weight | Rationale |
|------|------|--------|-----------|
| **Display / Zone Labels** | `Press Start 2P` | 400 | Pixel-art identity anchor — instantly memorable |
| **UI Headings / Panel Titles** | `JetBrains Mono` | 700 | Monospace authority, technical feel, excellent readability |
| **Body / Data / Logs** | `JetBrains Mono` | 400 | Terminal aesthetic for agent logs, data readouts |
| **Numeric Counters** | `Share Tech Mono` | 400 | Clean monospace for ROI tickers, risk percentages |

### Color System (CSS Variables)

```css
:root {
  /* === CANVAS / MAP BACKGROUNDS === */
  --bg-floor-base:     #D8D4CC;   /* Light warm grey — default tile floor */
  --bg-floor-zone-a:   #C8D0C0;   /* Zone A: Raw Materials — muted sage */
  --bg-floor-zone-b:   #C4CCD8;   /* Zone B: Assembly — muted slate blue */
  --bg-floor-zone-c:   #D4C8C0;   /* Zone C: Packaging — muted warm */
  --bg-floor-zone-d:   #C8C4B8;   /* Zone D: Storage — muted tan */
  --bg-floor-zone-e:   #C0CCC8;   /* Zone E: QC — muted teal-grey */
  --bg-wall:           #7A7068;   /* Wall color — dark warm grey */
  --bg-wall-border:    #5A5048;   /* Wall border — darker warm grey */

  /* === UI CHROME BACKGROUNDS === */
  --bg-ui-base:        #F4F2EF;   /* UI panels — warm off-white */
  --bg-ui-surface:     #ECEAE6;   /* Slightly darker surface */
  --bg-ui-elevated:    #E4E2DE;   /* Cards, hover states */
  --bg-ui-dark:        #2C2A28;   /* Dark UI elements — logs drawer */

  /* === STATUS COLORS (muted, not neon) === */
  --status-good:       #5A8A5A;   /* Operational — muted forest green */
  --status-good-glow:  rgba(90, 138, 90, 0.25);
  --status-watch:      #A08040;   /* Warning — muted amber/ochre */
  --status-watch-glow: rgba(160, 128, 64, 0.25);
  --status-critical:   #9A4040;   /* Critical — muted brick red */
  --status-critical-glow: rgba(154, 64, 64, 0.25);
  --status-isolated:   #8A8A8A;   /* Dead/isolated — grey */

  /* === PIPE COLORS === */
  --pipe-default:      #8A8078;   /* Default pipe — warm medium grey */
  --pipe-watch:        #A08040;   /* Watch upstream — muted amber */
  --pipe-critical:     #9A4040;   /* Critical upstream — muted brick */
  --pipe-isolated:     #C0BCB8;   /* Dead pipe — light grey */

  /* === AGENT LOG TAG COLORS (muted) === */
  --agent-sensor:      #4A8A9A;   /* Cyan-grey — sensor readings */
  --agent-predict:     #8A7A30;   /* Dark gold — prediction */
  --agent-rca:         #9A6030;   /* Burnt orange — root cause */
  --agent-action:      #9A4040;   /* Brick red — action decisions */
  --agent-roi:         #5A8A5A;   /* Forest green — financial impact */
  --agent-thinking:    #7A6A8A;   /* Muted purple — agent reasoning */

  /* === UI TEXT === */
  --text-primary:      #2C2A28;   /* Near-black — primary text */
  --text-secondary:    #6A6460;   /* Medium warm grey — secondary */
  --text-muted:        #9A9490;   /* Muted grey — hints, labels */
  --text-on-dark:      #E8E4E0;   /* Light warm white — on dark panels */
  --text-on-canvas:    #2C2A28;   /* On light canvas floor */

  /* === ACCENT (UI buttons, focus states) === */
  --accent-primary:    #4A6A8A;   /* Muted steel blue — buttons */
  --accent-hover:      #3A5A7A;   /* Darker on hover */
  --accent-focus:      rgba(74, 106, 138, 0.3); /* Focus ring */

  /* === FINANCIAL === */
  --money-save:        #5A8A5A;   /* Muted green */
  --money-loss:        #9A4040;   /* Muted red */
  --money-neutral:     #8A7A30;   /* Muted gold */

  /* === PROJECTION OVERLAY === */
  --projection-tint:   rgba(100, 90, 120, 0.10); /* Very subtle purple tint */
}
```

> [!NOTE]
> **Color Philosophy:** Every color is desaturated by ~40% from a typical vibrant palette. Status indicators use muted brick red, ochre, and forest green — legible, distinct, but never garish. The tile floors read like real pixel RPG maps. The UI chrome uses warm off-whites and dark warm greys. Nothing is pure black or pure white.

### Spacing Rhythm

```
4px → 8px → 12px → 16px → 24px → 32px → 48px → 64px
```

### Motion Philosophy

- **Purposeful only.** Every animation tells a story or conveys status.
- Micro-interactions: 150-300ms ease-out
- Panel transitions: 300ms ease-out
- Zone transitions: 400ms cubic-bezier(0.4, 0, 0.2, 1)
- Status pulses: CSS keyframes (GPU-composited, zero JS)
- Canvas animations: `requestAnimationFrame` at 60fps, delta-time based
- **`prefers-reduced-motion`**: Disable all decorative animations, keep status indicators static with color-only differentiation.

---

## Visual Style & Sprite Generation Guidelines

> [!IMPORTANT]
> **All 2D sprites and maps must be generated using the nano-banana image generation tool before the build phase begins.** Do not draw anything procedurally that conflicts with this style. Canvas drawing code must faithfully replicate generated sprites.

### Reference Style Summary

| Ref Image | What it shows | How we use it |
|-----------|--------------|---------------|
| Image 1 (Pokemon trainer red) | 4-row × 3-col sprite sheet, chibi proportions, walk + idle frames | Worker sprite sheet format |
| Image 2 (Pokemon female trainer) | Same sprite sheet format, different colors/accessories | Second worker variant format |
| Image 3 (Teal pixel RPG map) | Top-down indoor/outdoor map, soft teal palette, rounded room shapes, characters placed in map | Zone aesthetic inspiration |
| Image 4 (Hospital pixel map) | Top-down indoor multi-room map, clean tile floor, furniture as top-down objects, room dividers | **PRIMARY MAP REFERENCE — Factory zone layout style** |

### Art Style Rules (Non-Negotiable)

- **Perspective:** Top-down orthographic (bird's eye, not isometric)
- **Pixel size:** ~16×24px base characters, 32×32px machines, tiles divisible by 16px
- **Outlines:** Solid 1px dark outlines on all sprites
- **Palette per sprite:** Max 6-8 colors per character sprite, 10-12 per machine sprite
- **Color mood:** Desaturated, warm-neutral. No electric brightness. Reference image 4's tile floor greys and warm wall yellows as primary tones
- **Characters:** Round heads, slightly oversized, chibi proportions exactly like images 1 & 2
- **No neon. No gradients. No glow effects IN the sprites.** (Status glow is added in canvas code, not baked into sprites)

### Sprite Animation Frame Specification

#### Worker Characters — Sprite Sheet Layout

Each worker has a **4×4 sprite sheet** (4 rows × 4 columns):

```
Row 1: Facing DOWN  (toward viewer) — Frame 0 idle | Frame 1 walk-L | Frame 2 walk-R | Frame 3 idle-bob
Row 2: Facing LEFT                   — Frame 0 idle | Frame 1 walk-L | Frame 2 walk-R | Frame 3 idle-bob
Row 3: Facing RIGHT                  — Frame 0 idle | Frame 1 walk-L | Frame 2 walk-R | Frame 3 idle-bob
Row 4: Facing UP   (away from viewer)— Frame 0 idle | Frame 1 walk-L | Frame 2 walk-R | Frame 3 idle-bob
```

**Idle animation (breathing/bob):**
- Frame 0 → Frame 3 → Frame 0 loop (400ms each frame)
- Frame 3 has body 1px lower than Frame 0 (subtle bob)
- Head is same, only torso/legs shift slightly

**Walk animation:**
- Frame 0 → Frame 1 → Frame 0 → Frame 2 → repeat (150-200ms each frame)
- Left leg forward in Frame 1, right leg forward in Frame 2
- Arms swing opposite to legs

**Per-worker animation intervals (so they don’t sync up):**
```
Worker A: idle bob every 420ms, walk frame every 160ms
Worker B: idle bob every 380ms, walk frame every 175ms
Worker C: idle bob every 460ms, walk frame every 155ms  (taller, slightly slower)
Worker D: idle bob every 400ms, walk frame every 180ms
Worker E: idle bob every 500ms, walk frame every 170ms  (deliberate pace)
```

#### Machine Sprites — Idle Animation Frames

Each machine has a **1×2 or 1×3 sprite strip** for idle animation:

```
GOOD status:    Frame 0 | Frame 1  (soft vertical piston/indicator bob, 800ms per frame)
WATCH status:   Frame 0 | Frame 1 | Frame 2  (slightly faster oscillation, 500ms per frame)
CRITICAL status: Frame 0 | Frame 1 | Frame 2 | Frame 3  (erratic, 200-400ms random)
```

Status-based sprite swapping (not CSS filters — different sprite tint versions):
- Good variant: normal colors
- Watch variant: slight warm amber tint on highlights, rust on corner pixels
- Critical variant: heavier rust, darker overall, warning indicator pixel on top

### nano-banana Image Generation Prompts

> [!NOTE]
> Run these prompts using the `generate_image` tool before beginning canvas code. Save all generated images to `assets/sprites/` and `assets/maps/`. Reference them in PixiJS Sprite loading.

---

#### PROMPT GROUP 1 — Factory Zone Maps (5 zones)

**Prompt 1A — Zone B: Assembly (primary showcase zone)**
```
Top-down pixel art factory floor map, GBA Pokemon RPG-Maker style matching the hospital interior map reference (clean tile grid floors, room dividers as thick pixel walls, furniture/equipment as top-down objects). Single rectangular factory room. Muted color palette: warm light grey tile floor (#D0CCC8), dark warm grey walls, muted steel blue for equipment bodies. Contains: 2 tall rectangular motor machines (side by side), 1 wide squat welding station with sparks indicator pixel, pipe lines connecting them drawn on floor as dark grey channels. Clear walking paths between machines. Scale: character sprites would be ~8-10% of room height. Top-down orthographic view. No perspective distortion. Resolution: 512x512 pixels. Solid 1px dark outlines on all objects. Style: image 4 hospital map aesthetic but industrial factory.
```

**Prompt 1B — Zone A: Raw Materials**
```
Top-down pixel art factory zone, GBA Pokemon RPG-Maker indoor style. Muted warm-sage floor tiles. Contains: 1 long horizontal conveyor belt machine (wide rectangle), 1 large square crusher machine with heavy dark body, pipe connections on floor between them, input/output markers. Multiple walking paths. Same muted industrial palette — no bright colors. 512x512. Dark outlines. Matches hospital map ref art style.
```

**Prompt 1C — Zone C: Packaging**
```
Top-down pixel art factory packaging zone, GBA RPG-Maker style. Warm beige-grey floor tiles. Contains: 1 medium square sealer machine, 1 wide rectangular wrapper machine, package output area with stacked box graphics. Connected by floor pipes. Muted warm palette. 512x512. Dark outlines. Same art style as image 4 reference.
```

**Prompt 1D — Zone D: Storage**
```
Top-down pixel art factory storage zone, GBA RPG-Maker style. Muted tan-grey floor. Contains: 1 L-shaped forklift bay machine with small cart graphic, shelving units along walls as top-down objects with box sprites on them, floor arrows indicating traffic flow as subtle pixel markers. Muted brown-grey palette. 512x512. Dark outlines.
```

**Prompt 1E — Zone E: QC**
```
Top-down pixel art factory quality control zone, GBA RPG-Maker style. Muted teal-grey tiles. Contains: 1 small square QC scanner machine with scan beam indicator pixel, inspection table as top-down flat rectangle, result indicator board on wall. Soft muted blue-grey palette. 512x512. Dark outlines. Clean, clinical feel within the pixel art style.
```

---

#### PROMPT GROUP 2 — Worker Character Sprite Sheets (5 variants)

**Prompt 2A — Worker A: Floor Operator**
```
Pixel art character sprite sheet, GBA Pokemon trainer style exactly like the red-hat trainer reference (image 1). Grid layout: 4 rows x 4 columns on white background. Row 1 facing down, Row 2 facing left, Row 3 facing right, Row 4 facing up. Columns: idle-stand, walk-left-leg-forward, walk-right-leg-forward, idle-bob (body 1px lower). Character: chibi proportions, round head, yellow hard hat, blue work overalls, dark brown boots, pale skin. Max 7 colors. 16x24px per sprite cell. Solid dark 1px outlines. Muted industrial colors. No neon. White grid background.
```

**Prompt 2B — Worker B: Technician**
```
Pixel art character sprite sheet, GBA Pokemon trainer style (same format as image 1). 4x4 grid on white background. Character: white hard hat, orange hi-vis vest over grey shirt, dark grey pants, brown work boots. Chibi proportions, round head. 4 directions x 4 frames (idle, walk-L, walk-R, idle-bob). 16x24px cells. Dark outlines. Muted colors only.
```

**Prompt 2C — Worker C: Supervisor**
```
Pixel art character sprite sheet, GBA Pokemon trainer style. 4x4 grid on white. Character: red hard hat, green safety jacket, khaki pants, black boots. Slightly taller than others (18x26px). Chibi proportions. 4 directions x 4 frames. Muted colors. Dark outlines.
```

**Prompt 2D — Worker D: Maintenance**
```
Pixel art character sprite sheet, GBA Pokemon trainer style. 4x4 grid on white. Character: no hat (dark hair), grey coveralls, dark boots. Tool belt visible as pixel detail on waist. When idle, holds wrench in one hand. 4 directions x 4 frames. 16x24px. Muted grey palette. Dark outlines.
```

**Prompt 2E — Worker E: Engineer**
```
Pixel art character sprite sheet, GBA Pokemon trainer style. 4x4 grid on white. Character: blue safety helmet, white shirt with tiny pixel tie, dark navy pants, black shoes. Holds clipboard as flat pixel rectangle when idle. 4 directions x 4 frames. 16x24px. Muted professional colors. Dark outlines.
```

---

#### PROMPT GROUP 3 — Machine Sprites (status variants)

**Prompt 3A — Motor Machine (MTR-1, MTR-2)**
```
Pixel art sprite strip of a top-down industrial motor machine, 3 frames wide x 1 frame tall on white background. Top-down view of a tall rectangular machine (32x48px). Frame 1: normal operation (steel blue body, dark grey details, small green indicator light). Frame 2: watch state (same body, amber tinted highlights, faint rust pixels on corners). Frame 3: critical state (darker body, heavy rust texture on corners, red indicator pixel, small steam dot above). Muted industrial palette. Dark 1px outlines. GBA pixel art style.
```

**Prompt 3B — Conveyor Belt (CONV)**
```
Pixel art sprite strip, top-down view of industrial conveyor belt. 3 frames wide x 1 tall. Long horizontal rectangle (64x24px). Conveyor belt texture as alternating dark/light grey horizontal bands with arrow direction markers. Frame 1: normal (moving lines, grey-slate). Frame 2: watch (slight amber tint, slower implied motion). Frame 3: critical (stopped, darker, red edges). Dark outlines. Muted palette.
```

**Prompt 3C — All other machines (CRSH, WLDR, SEAL, WRPR, FRKT, QCSC)**
```
Pixel art sprite sheet, top-down view of 6 different industrial machines arranged in a 3x2 grid on white. Each machine: 3 status variants shown as sub-frames. Crusher (large dark square with angular teeth-like details), Welder (wide squat with orange-brown body and spark pixel), Sealer (medium purple-grey square with clamping detail), Wrapper (wide teal rectangle with roll indicators), Forklift Bay (L-shaped yellow-brown with fork arms visible from above), QC Scanner (small cyan square with scan line detail). All top-down orthographic. Muted colors. Dark outlines. 32x32px base size each.
```

---

#### PROMPT GROUP 4 — Tile Sets & UI Elements

**Prompt 4A — Floor Tile Set**
```
Pixel art tile set, 5 floor tile variants on white background arranged in a row. Each tile 16x16px. Tile 1: light warm grey grid (Zone B default). Tile 2: sage green-grey (Zone A). Tile 3: warm beige-grey (Zone C). Tile 4: tan-grey (Zone D). Tile 5: teal-grey (Zone E). Each tile has subtle 1px grid lines on edges in slightly darker shade. No patterns, just clean flat color with minimal texture. GBA Pokemon floor tile aesthetic.
```

**Prompt 4B — Pipe/Conduit Tiles**
```
Pixel art pipe tile set for factory floor. 16x16px tiles on white background in a grid. Variants: horizontal straight pipe, vertical straight pipe, corner (4 rotations), T-junction (4 rotations). Pipes are 4px wide, centered in tile, dark warm grey color (#6A6460) with slight border darker shade. Status variants: normal (grey), watch (muted amber), critical (muted brick red). Clean pixel art. Industrial look.
```

---

### Generated Reference Images

> [!NOTE]
> These images were generated as style prototypes using nano-banana. Final sprites generated during build must match this aesthetic.

#### Factory Zone Map Reference

![Factory Zone Map Reference](C:\Users\RYZEN\.gemini\antigravity\brain\5b7609d8-4c47-4b96-94be-e64d1d03b75d\factory_zone_map_reference_1774886932044.png)

#### Worker Sprite Sheet Reference  

![Worker Sprite Sheet Reference](C:\Users\RYZEN\.gemini\antigravity\brain\5b7609d8-4c47-4b96-94be-e64d1d03b75d\worker_sprite_sheet_reference_1774886948375.png)

---

### Sprite Asset Loading Strategy (PixiJS)

```typescript
// src/canvas/assets.ts
import { Assets, Spritesheet } from 'pixi.js';

// All generated sprites loaded as spritesheets
const SPRITE_MANIFEST = [
  { alias: 'worker-a', src: '/assets/sprites/worker_a_spritesheet.png' },
  { alias: 'worker-b', src: '/assets/sprites/worker_b_spritesheet.png' },
  { alias: 'worker-c', src: '/assets/sprites/worker_c_spritesheet.png' },
  { alias: 'worker-d', src: '/assets/sprites/worker_d_spritesheet.png' },
  { alias: 'worker-e', src: '/assets/sprites/worker_e_spritesheet.png' },
  { alias: 'machines',  src: '/assets/sprites/machines_spritesheet.png' },
  { alias: 'tiles',     src: '/assets/sprites/tiles_spritesheet.png' },
  { alias: 'pipes',     src: '/assets/sprites/pipes_spritesheet.png' },
  { alias: 'map-zone-a', src: '/assets/maps/zone_a_raw_materials.png' },
  { alias: 'map-zone-b', src: '/assets/maps/zone_b_assembly.png' },
  { alias: 'map-zone-c', src: '/assets/maps/zone_c_packaging.png' },
  { alias: 'map-zone-d', src: '/assets/maps/zone_d_storage.png' },
  { alias: 'map-zone-e', src: '/assets/maps/zone_e_qc.png' },
];

// Spritesheet frame definitions (generated from sprite positions)
// Each worker: 16 frames (4 directions x 4 frames each)
// Frame IDs: `{variant}_{direction}_{frame}` e.g. 'worker_a_down_0'
export const WORKER_FRAME_MAP = {
  down:  [0, 1, 2, 3],   // facing camera
  left:  [4, 5, 6, 7],
  right: [8, 9, 10, 11],
  up:    [12, 13, 14, 15], // facing away
};

// Walking uses frames 1,0,2,0 (leg-L, neutral, leg-R, neutral)
// Idle uses frames 0,3,0,3 (stand, bob-down, stand, bob-down)
```

---

### Project Scaffolding & Stack

#### [NEW] Vite + React Project Initialization

Scaffold with Vite (React + TypeScript template):

```
npx -y create-vite@latest ./ --template react-ts
```

#### Full Dependency List

```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "pixi.js": "^8.17.1",
    "@pixi/react": "^8",
    "zustand": "^5",
    "framer-motion": "^12",
    "immer": "^10",
    "lucide-react": "^0.468"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4",
    "typescript": "^5.7",
    "vite": "^6"
  }
}
```

> [!NOTE]
> **Why these specific choices:**
> - `pixi.js` v8 — GPU-accelerated 2D rendering for the factory canvas (already installed)
> - `@pixi/react` — React bindings for declarative PixiJS components
> - `zustand` v5 — Minimal state management, perfect for real-time simulation state
> - `immer` — Immutable state updates for complex nested machine/worker state
> - `framer-motion` — Panel slide-ins, drawer animations, layout transitions
> - `lucide-react` — Clean SVG icon set (replaces emojis per UI/UX Pro Max guidelines)
> - **No Three.js** — Machine panel uses 2D isometric Canvas art with CSS rotation
> - **Tailwind v4** — Utility-first with CSS variable integration

---

### File Structure

```
src/
├── main.tsx                          # Entry point
├── App.tsx                           # Root layout + route placeholder
├── index.css                         # Global styles, CSS variables, fonts
│
├── stores/                           # Zustand state management
│   ├── machineStore.ts               # Machine state, status, risk scores, aging
│   ├── workerStore.ts                # Worker positions, states, assignments
│   ├── zoneStore.ts                  # Current zone, zone navigation
│   ├── agentLogStore.ts              # Agent log entries, pause state
│   ├── roiStore.ts                   # Financial counters, savings
│   ├── simulationStore.ts           # Simulation clock, cascade interval, auto mode
│   └── uiStore.ts                    # Panel visibility, selected machine, drawer state
│
├── data/                             # Static/synthetic data definitions
│   ├── machines.ts                   # Machine roster (8 machines, zones, shapes, colors)
│   ├── zones.ts                      # Zone definitions (5 zones, connections, floor patterns)
│   ├── workers.ts                    # Worker variants (5 types, sprite configs)
│   ├── actions.ts                    # Action matrix (per-status available actions)
│   └── pipes.ts                      # Pipe connection map (upstream → downstream)
│
├── engine/                           # Simulation logic (pure functions + intervals)
│   ├── cascadeEngine.ts              # Cascade risk propagation (10s interval)
│   ├── agentPipeline.ts              # Detection → Analysis → Prediction → Strategy → Decision → Action
│   ├── workerDispatcher.ts           # Worker assignment logic, queueing
│   ├── roiCalculator.ts              # Cost/savings computation engine
│   ├── scenarioTriggers.ts           # Demo control: trigger failure, cascade, aging spike
│   └── futureProjection.ts           # +6h / +24h state projection calculator
│
├── canvas/                           # PixiJS canvas layer (factory map)
│   ├── FactoryCanvas.tsx             # Main canvas component, game loop, zoom/pan
│   ├── ZoneRenderer.ts              # Floor tiles, zone backgrounds, zone label
│   ├── MachineNode.ts               # Machine sprite drawing (status visuals, aging, glow)
│   ├── PipeSystem.ts                # Pipe rendering (L-shapes, straight, color by upstream)
│   ├── ParticleSystem.ts            # Steam/smoke emitters per machine
│   ├── WorkerSprite.ts              # Procedural worker drawing (5 variants, 3 frames)
│   ├── WorkerAnimator.ts            # Walk cycle, idle behaviors, patrol, dispatch
│   └── ZoneTransition.ts            # Zone slide transition animation (400ms)
│
├── components/                       # React UI components (Tailwind + Framer Motion)
│   ├── layout/
│   │   └── DashboardLayout.tsx       # Full dashboard shell (topbar, map, panels, ROI bar)
│   │
│   ├── topbar/
│   │   └── TopBar.tsx                # Logo, zone name, status counts, logs btn, notifications
│   │
│   ├── panels/
│   │   ├── MachinePanel.tsx          # Left slide-in panel (machine details)
│   │   ├── StatusTab.tsx             # Status tab with root cause + actions + what-if
│   │   ├── MachineLifeTab.tsx        # Machine life tab with aging, costs, replacement
│   │   ├── CostDeltaOverlay.tsx      # Before/after cost comparison on action click
│   │   ├── ActionButton.tsx          # Individual action button with dispatch logic
│   │   └── ExplainDecision.tsx       # "Explain This Decision" LLM-style output
│   │
│   ├── quickpane/
│   │   └── QuickSummaryPane.tsx      # Top-right always-visible summary pane
│   │
│   ├── logs/
│   │   └── AgentLogsDrawer.tsx       # Bottom slide-up terminal drawer
│   │
│   ├── roi/
│   │   └── ROICounterBar.tsx         # Bottom pinned ROI counter
│   │
│   ├── controls/
│   │   ├── AutonomousToggle.tsx      # Manual / Autonomous mode toggle
│   │   ├── TimeProjectionToggle.tsx  # Current / +6h / +24h toggle
│   │   ├── ScenarioTriggers.tsx      # Demo control buttons
│   │   └── FailureReplay.tsx         # Replay incident controller
│   │
│   └── shared/
│       ├── StatusBadge.tsx           # Reusable status indicator (good/watch/critical)
│       ├── GlowBorder.tsx            # Animated glow border component
│       ├── TickingCounter.tsx        # Smooth number ticker (for ROI)
│       └── ProgressBar.tsx           # Repair progress bar
│
├── hooks/                            # Custom React hooks
│   ├── useSimulationLoop.ts          # Master simulation tick (10s cascade, agent pipeline)
│   ├── useKeyboardShortcuts.ts       # Keyboard nav for zones, panel close
│   └── useReducedMotion.ts           # prefers-reduced-motion detection
│
└── utils/
    ├── formatCurrency.ts             # ₹ formatting with Indian numbering (L, Cr)
    ├── interpolate.ts                # Smooth value interpolation for tickers
    └── colors.ts                     # Status color resolver, pipe color logic
```

---

### Component Architecture & Detailed Specifications

---

#### Component 1: DashboardLayout

**File:** `src/components/layout/DashboardLayout.tsx`

The root layout component. Orchestrates all panels and the canvas.

```
┌──────────────────────────────────────────────────────────────────┐
│ TopBar (fixed, z-50)                                             │
├────────────────────────────────────────────────┬─────────────────┤
│                                                │ QuickSummary    │
│                                                │ Pane (z-30)     │
│         FactoryCanvas (z-0)                    │ w-80, right-0   │
│         (fills remaining space)                │                 │
│                                                │                 │
├────────────────────────────────────────────────┴─────────────────┤
│ ROICounterBar (fixed bottom, z-40)                               │
└──────────────────────────────────────────────────────────────────┘

[MachinePanel slides in from left, z-40, dims canvas behind]
[AgentLogsDrawer slides up from bottom, z-45, 40vh]
```

- **TopBar**: `position: fixed; top: 0; height: 48px; z-index: 50`
- **QuickSummaryPane**: `position: fixed; right: 0; top: 48px; width: 320px; z-index: 30`
- **FactoryCanvas**: Fills all remaining space, renders behind everything
- **MachinePanel**: `position: fixed; left: 0; top: 48px; width: 400px; z-index: 40` — slides in via Framer Motion `x: -400 → 0`
- **AgentLogsDrawer**: `position: fixed; bottom: 48px; left: 0; right: 0; height: 40vh; z-index: 45` — slides up
- **ROICounterBar**: `position: fixed; bottom: 0; height: 48px; z-index: 40`

**Z-Index Scale:**
```
0   — Canvas
30  — Quick Summary Pane
40  — Machine Panel, ROI Bar
45  — Agent Logs Drawer
50  — TopBar
60  — Modals / Cost Delta overlay
```

---

#### Component 2: TopBar

**File:** `src/components/topbar/TopBar.tsx`

```
[ GearSwitch logo ]  [ ZONE B: ASSEMBLY ]  ●1 Critical  ▲2 Watch  ✓2 Good  |  [Manual|⚡Auto]  [Current|+6h|+24h]  📋Logs  🔔3
```

- **Left**: GearSwitch wordmark in `Press Start 2P`, 14px, `var(--accent-glow)`
- **Center**: Current zone name — updates on zone navigation with a crossfade (150ms)
- **Status Counts**: Live-updating badges. Use `StatusBadge` component with colored dots (not emojis). Counts derive from `machineStore` filtered by current zone
- **Mode Toggles**: `AutonomousToggle` + `TimeProjectionToggle` — segmented button groups
- **Right**: Logs button (Lucide `ScrollText` icon) + Notification bell (Lucide `Bell` icon) with unacknowledged count badge

---

#### Component 3: FactoryCanvas (PixiJS)

**File:** `src/canvas/FactoryCanvas.tsx`

The heart of the system. A full-viewport PixiJS `<Application>` rendered via `@pixi/react`.

**Rendering Layers (bottom to top):**

| Layer | Content | Update Frequency |
|-------|---------|-----------------|
| 0 | Floor tiles (ZoneRenderer) | On zone change only |
| 1 | Pipes (PipeSystem) | Every 10s (cascade tick) |
| 2 | Machine nodes (MachineNode) | Every frame (status animations) |
| 3 | Particles/steam (ParticleSystem) | Every frame |
| 4 | Workers (WorkerSprite) | Every frame (walk cycle) |
| 5 | UI overlays (labels, badges) | On state change |

**Zone System:**
- 5 zones, one visible at a time
- Navigation via directional arrows pinned to viewport edges
- Arrow appearance: Lucide chevron icons over semi-transparent dark circles
- Arrow pulses red (CSS animation on the React overlay) if adjacent zone has a critical machine
- Zone transition: current zone container slides out (transform), new one slides in — 400ms ease

**Zone Map:**
```
                [Zone A: Raw Materials]
                        ↓
[Zone D: Storage] ← [Zone B: Assembly] → [Zone E: QC]
                        ↓
                [Zone C: Packaging]
```

**Zoom + Pan:**
- Scroll wheel: zoom 0.5x–3x (PixiJS stage scale)
- Click-drag: pan within zone (PixiJS stage position)
- Double-click machine: smooth zoom toward machine (GSAP-like tween using PixiJS ticker) + trigger `MachinePanel`

**Floor Tiles:**
- Dark pixel grid base: `#1A1A2E`
- Each zone has a subtly different tile pattern (diagonal lines, dots, crosses, hatching, grid) drawn procedurally
- Zone label rendered in `Press Start 2P` at top-left of canvas

---

#### Component 4: MachineNode (PixiJS Sprite)

**File:** `src/canvas/MachineNode.ts`

Each of the 8 machines is a procedurally drawn PixiJS Graphics object.

**Machine Roster:**

| ID | Label | Shape | Base Color | Zone | Size (px) |
|----|-------|-------|------------|------|-----------|
| motor-1 | MTR-1 | Tall rect | `#4A7AB5` Steel blue | B | 60×90 |
| motor-2 | MTR-2 | Tall rect | `#2D5A8A` Dark blue | B | 60×90 |
| welder | WLDR | Wide squat | `#B87333` Orange-brown | B | 90×60 |
| conveyor | CONV | Long bar | `#5A6B7A` Slate grey | A | 140×40 |
| crusher | CRSH | Large square | `#2D6B4F` Dark green | A | 80×80 |
| sealer | SEAL | Medium square | `#7A6B8A` Purple-grey | C | 70×70 |
| wrapper | WRPR | Wide rect | `#4A8B8A` Teal | C | 100×55 |
| forklift-bay | FRKT | L-shape | `#8B7A33` Yellow-brown | D | 80×80 |
| qc-scanner | QCSC | Small square | `#22B8CF` Cyan | E | 55×55 |

**Status Visuals (per frame):**

| Status | Border Glow | Body Effect | Movement | Smoke |
|--------|------------|-------------|----------|-------|
| GOOD | Steady `#22C55E` (1px) | Clean, bright fill | Perfectly still | 1 puff / 3s, opacity 0.3 |
| WATCH | Flickering `#EAB308` (2px) | Slight rust tint on corners | 1-2px slow oscillation | 2-3 / 800ms, opacity 0.5 |
| CRITICAL | Rapidly pulsing `#EF4444` (3px) | Full rust tint, darkened | Erratic 3-5px shake | 5-8 burst / 300ms, opacity 0.8 |

**Aging Visual Progression (applied additively):**

| Life % Used | Visual Change |
|-------------|--------------|
| 0-50% | Clean, full brightness |
| 50-80% | Slight darkening (-10% brightness), faint rust pixels on corners |
| 80-90% | Heavy rust patches (brown pixel overlay), amber tint, slow permanent sway |
| 90%+ | Maximum rust texture, red age badge `[⚠ 8.5yr]`, constant slight shake |

**Age Badge:** Rendered as a small text label above the machine label. Amber background `#EAB308`, dark text, `Press Start 2P` 8px.

---

#### Component 5: PipeSystem (PixiJS Graphics)

**File:** `src/canvas/PipeSystem.ts`

Pipes are L-shaped or straight pixel lines connecting machines.

**Connection Map:**
```
CRSH (A) ──→ CONV (A) ──→ MTR-1 (B) ──→ WLDR (B) ──→ MTR-2 (B)
                                                            │
                                                            ↓
FRKT (D) ←──────────────────── SEAL (C) ←── WRPR (C)
                                                            │
                                                            ↓
                                                        QCSC (E)
```

**Pipe Rendering:**
- Default: `#334155`, 4px width, solid
- Watch upstream: `#EAB308`, 4px, slow pulse (opacity 0.4→1.0→0.4 over 2s)
- Critical upstream: `#EF4444`, 6px, fast pulse (opacity 0.3→1.0→0.3 over 600ms)
- Isolated: `#1F2937`, 4px, dim (dead appearance)

**Cross-Zone Pipes:**
- When pipe connects machines in different zones, show a truncated segment ending at the zone edge with a glowing arrow indicator showing which direction the connection leads
- The arrow pulses if the connected machine in the other zone is critical

**Cascade Logic (runs every 10s via `cascadeEngine.ts`):**
```typescript
function runCascade(machines: Machine[], pipes: Pipe[]) {
  for (const pipe of pipes) {
    const upstream = machines.find(m => m.id === pipe.from);
    const downstream = machines.find(m => m.id === pipe.to);
    
    if (upstream.status === 'critical') {
      downstream.riskScore += 15;
      if (downstream.riskScore > 70) downstream.status = 'watch';
      if (downstream.riskScore > 90) downstream.status = 'critical';
      
      // Log cascade event
      agentLogStore.addEntry({
        type: 'SENSOR',
        message: `Cascade: ${upstream.label} → ${downstream.label} risk +15 (now ${downstream.riskScore}%)`
      });
    }
  }
}
```

---

#### Component 6: ParticleSystem (PixiJS)

**File:** `src/canvas/ParticleSystem.ts`

Each machine has an attached particle emitter. Particles are small PixiJS Graphics circles.

| Status | Emission Rate | Count/Burst | Opacity | Color | Behavior |
|--------|--------------|-------------|---------|-------|----------|
| Good | 1 per 3s | 1-2 | 0.3 | `#94A3B8` light grey | Rise slowly, slight drift, fade over 2s |
| Watch | 1 per 800ms | 2-3 | 0.5 | `#64748B` grey | Rise faster, more drift, fade over 1.5s |
| Critical | Burst per 300ms | 5-8 | 0.8 | `#E2E8F0`/`#475569` alternating | Irregular bursts, erratic drift, expand + fade over 1s |

**Particle Physics:**
- `vy`: -0.5 to -1.5 px/frame (upward)
- `vx`: random -0.3 to 0.3 (drift)
- `scale`: starts 1.0, grows to 1.5 over lifetime
- `alpha`: starts at max, linear fade to 0
- Pool-based: pre-allocate 50 particles per machine, recycle on death

---

#### Component 7: WorkerSprite (PixiJS Procedural)

**File:** `src/canvas/WorkerSprite.ts`

5 worker variants drawn procedurally (no sprite sheets needed). Each worker is ~16×24px.

**Worker Variants:**

| ID | Hat | Top | Pants | Boots | Special Accessory |
|----|-----|-----|-------|-------|-------------------|
| A — Floor Op | Yellow hard hat | Blue overalls | Dark blue | Black | — |
| B — Technician | White hard hat | Orange vest + grey shirt | Dark grey | Brown | — |
| C — Supervisor | Red hard hat | Green jacket | Khaki | Black | Slightly taller (28px) |
| D — Maintenance | None (dark hair) | Grey coveralls | Grey | Dark grey | Tool belt pixels, wrench when repairing |
| E — Engineer | Blue helmet | White shirt + pixel tie | Dark navy | Black | Clipboard when idle |

**Walk Animation Frames:**
- Frame 0: Neutral — legs together
- Frame 1: Left leg forward
- Frame 2: Right leg forward
- Cycle: `0 → 1 → 0 → 2 → repeat`
- Frame interval: 150-230ms per worker (randomized so they don't march in sync)
- Facing: horizontally flip the Graphics based on movement direction

**Worker State Machine:**
```
IDLE → PATROLLING → DISPATCHED → REPAIRING → RETURNING → PATROLLING
```

**Idle Behaviors (WorkerAnimator.ts):**
- Head bob: 1px y-shift every 3-4s
- Random glance: facing flips for 1.2s then reverts
- Worker E: raises clipboard every 8s (small animation)
- Worker D: examines tool belt occasionally

**Repair Sequence:**
1. Action selected (panel or quick pane)
2. 1-2 nearest workers detach from patrol
3. Walk toward machine (A* pathfinding simplified to straight-line with one direction change)
4. Arrive → lock to Frame 0 next to machine
5. Wrench icon (Lucide, rendered as PixiJS text sprite) bobs above machine
6. Green progress bar fills under machine over ~8 seconds
7. Machine gradually calms: shake reduces → steam slows → glow shifts red → amber → green
8. Machine status → GOOD → workers hold 1s → resume patrol
9. Agent log fires completion entry + ROI counter jumps

**Worker Resource Rules:**
- 2 workers per zone by default
- 2 critical machines → workers split between them
- 3 critical, only 2 workers → third machine queued, logged as `[ACTION] Queued: ${machine.label} — no available workers`
- Supervisor (Worker C) dispatched only on "Escalate" actions

---

#### Component 8: MachinePanel (Left Slide-In)

**File:** `src/components/panels/MachinePanel.tsx`

Triggered by double-clicking a machine. Slides in from the left.

**Animation:** `framer-motion` — `animate={{ x: 0 }}` from `initial={{ x: -400 }}`, 300ms ease-out. Canvas dims to 25% opacity (CSS filter on the canvas container, not a full overlay).

**Panel has two tabs:** `[Status]` and `[Machine Life]`

##### Status Tab (`StatusTab.tsx`):

```
┌──────────────────────────────────┐
│ MTR-1 — Motor 1           [×]   │
│ ● CRITICAL    Risk: 94%         │
├──────────────────────────────────┤
│                                  │
│  [ Machine Visualization ]       │
│  2D Isometric Canvas art         │
│  CSS slow-rotation (20s loop)    │
│  Red glow on affected zones      │
│  Click to pause / inspect        │
│                                  │
├──────────────────────────────────┤
│ ROOT CAUSE                       │
│ "Bearing wear — temp spike +     │
│  abnormal vibration pattern"     │
│                                  │
│ [Explain Decision]               │
├──────────────────────────────────┤
│ AVAILABLE ACTIONS                │
│ [Repair Now] [Reduce Load 15%]  │
│ [Reduce Load 30%] [Isolate]     │
│ [Emergency Shutdown]             │
│ [Schedule Maintenance]           │
│ [Run Diagnostic]                 │
├──────────────────────────────────┤
│ WHAT-IF SIMULATION               │
│ Action      │ Time   │ Cost     │
│ Do nothing  │ 6hrs   │ ₹2.5L   │
│ Reduce load │ 2days  │ ₹40K    │
│ Repair now  │ —      │ ₹25K ✓  │
│                                  │
│ "Repair now saves ₹2.25L"       │
└──────────────────────────────────┘
```

**Actions Available Per Status:**

| Action | Good | Watch | Critical |
|--------|------|-------|----------|
| Run Diagnostic | ✓ | ✓ | ✓ |
| View History | ✓ | ✓ | ✓ |
| Schedule Maintenance | ✓ | ✓ | — |
| Reduce Load 15% | — | ✓ | ✓ |
| Reduce Load 30% | — | ✓ | ✓ |
| Dispatch Inspect | — | ✓ | — |
| Escalate Monitoring | — | ✓ | — |
| Repair Now | — | — | ✓ |
| Isolate Machine | — | — | ✓ |
| Emergency Shutdown | — | — | ✓ |
| Escalate to Supervisor | — | ✓ | ✓ |
| Replace Machine | ✓ | ✓ | ✓ |

**"Explain Decision" (`ExplainDecision.tsx`):**
On click, typewriter-animates a structured explanation:
```
"Repair now is optimal because:
 • Failure probability exceeds 75%
 • Cost of downtime exceeds repair cost by 9x
 • Machine age (8.5yr) increases failure volatility
 • Downstream dependency risk is high"
```
Uses 30ms per character typewriter effect with `JetBrains Mono`. Agent tag `[AGENT]` prefix in purple.

##### Machine Life Tab (`MachineLifeTab.tsx`):

```
┌──────────────────────────────────┐
│ ████████████░░░░  82% life used  │
│ Age: 8.5yr | Rated: 10yr        │
├──────────────────────────────────┤
│ MONTHLY COSTS                    │
│ Oil: ₹32,640  (+128%) ↑         │
│ Power: ₹14,640  (+35%) ↑        │
│ Maint: every 47d (was 90d) ↑    │
│ Excess: ₹18,400/mo              │
├──────────────────────────────────┤
│ REPLACEMENT ANALYSIS             │
│ New unit: ₹9,50,000             │
│ Monthly save: ₹22,200           │
│ Break-even: 43 months           │
├──────────────────────────────────┤
│ [Keep & Maintain]  [Replace]     │
└──────────────────────────────────┘
```

**Cost Delta Overlay (`CostDeltaOverlay.tsx`):**
When any action is clicked (before confirming), an overlay shows side-by-side:
- **Before:** Current costs + risk percentage
- **After:** Projected costs post-action + reduced risk
- **Net:** Highlighted saving/cost in green/red
- `[Confirm]` `[Cancel]` buttons
- Framer Motion `opacity: 0→1, scale: 0.95→1`, 200ms

---

#### Component 9: QuickSummaryPane (Top Right)

**File:** `src/components/quickpane/QuickSummaryPane.tsx`

Always visible, collapses to thin vertical bar on toggle (chevron icon).

```
┌───────────────────────────────┐
│ ⚡ QUICK SUMMARY         [▸] │
├───────────────────────────────┤
│ ● MTR-1  Repair now     [→]  │
│ ● WLDR   Isolate        [→]  │
│ ▲ CONV   Reduce load    [→]  │
│ ◷ CRSH   Old machine    [→]  │
├───────────────────────────────┤
│ 💰 At risk: ₹6.2L            │
│ 📉 Age waste: ₹54,800/mo     │
│ ✓ Saved: ₹4.75L              │
├───────────────────────────────┤
│ [Fix All Critical]           │
│ [Review Aging Machines]      │
└───────────────────────────────┘
```

> [!NOTE]
> Emojis in the spec are replaced with Lucide SVG icons in implementation: `AlertCircle`, `TrendingDown`, `CheckCircle`, `Clock`, `Zap`.

- **`[→]`** executes AI's top recommended action instantly — dispatches worker, fires agent log, updates ROI
- **`[Fix All Critical]`** dispatches all available workers simultaneously to all critical machines — the map comes alive with movement
- **`[Review Aging Machines]`** highlights all machines with age >80% life on map (amber pulse overlay)
- Clicking any row causes the corresponding machine on the map to pulse its glow once

---

#### Component 10: AgentLogsDrawer (Bottom Terminal)

**File:** `src/components/logs/AgentLogsDrawer.tsx`

Triggered by Logs button in TopBar. Slides up 40vh from bottom.

**Style:** Terminal aesthetic. `JetBrains Mono` 13px. `var(--bg-void)` background. Scanline overlay (CSS pseudo-element, very subtle).

```
┌──────────────────────────────────────────────────────────────┐
│ AGENT LOGS                           [Pause] [Clear] [×]    │
├──────────────────────────────────────────────────────────────┤
│ 14:32:06 [ACTION]  Best action: Repair → saves ₹2.25L       │
│ 14:32:05 [ACTION]  Simulating scenarios...                   │
│ 14:32:05 [ACTION]  Recommended: Repair now                   │
│ 14:32:04 [RCA]     Bearing wear: temp + vibration            │
│ 14:32:03 [PREDICT] MTR-1 failure prob: 78%                   │
│ 14:32:01 [SENSOR]  MTR-1 temp spike: 94°C                    │
└──────────────────────────────────────────────────────────────┘
```

**Agent Tag Colors:**
- `[SENSOR]` → `var(--agent-sensor)` cyan
- `[PREDICT]` → `var(--agent-predict)` yellow
- `[RCA]` → `var(--agent-rca)` orange
- `[ACTION]` → `var(--agent-action)` red
- `[ROI]` → `var(--agent-roi)` green
- `[AGENT]` → `var(--agent-thinking)` purple (for thinking state)

New logs prepend at top. Auto-scroll to latest. `[Pause]` freezes scroll for reading. Max 200 entries retained.

**Agent "Thinking State" Visualization:**
Before any action output, inject 2-3 thinking entries with 300-600ms delays:
```
14:32:04 [AGENT]  Evaluating 3 strategies...
14:32:05 [AGENT]  Simulating outcomes...
14:32:06 [ACTION] Best action: Repair → saves ₹2.25L
```
The thinking entries have a subtle pulsing dot animation on the `[AGENT]` tag.

---

#### Component 11: ROICounterBar (Bottom Pinned)

**File:** `src/components/roi/ROICounterBar.tsx`

```
💰 Potential savings identified: ₹ 4,75,000  |  ✓ Actions taken: 3  |  📉 Age waste this month: ₹54,800
```

- Main counter uses `TickingCounter` component — smooth CSS counter animation (transforms digit elements)
- Small tick-up when a machine is flagged (detection)
- Big jump with pulse flash when a repair completes (lifetime savings)
- Biggest jump with gold border flash when Replace is confirmed
- Age waste counter: static per session, updates when aging machines are flagged
- Font: `Share Tech Mono` 16px, `var(--text-primary)`
- Background: `var(--bg-surface)` with top 1px border `var(--pipe-default)`

---

#### Component 12: AutonomousToggle

**File:** `src/components/controls/AutonomousToggle.tsx`

```
[ Manual Mode  |  ⚡ Autonomous Mode ]
```

Segmented toggle in TopBar. When Autonomous is ON:
1. `simulationStore.autoMode = true`
2. Every cascade tick, system auto-runs the agent pipeline:
   - Detects issues → selects best action → dispatches workers → updates ROI
3. Logs go rapid-fire (looks incredibly intelligent)
4. Quick pane updates dynamically as actions are taken
5. Machines get fixed without any user clicks
6. Subtle purple border glow on TopBar to indicate active AI control

**Visual indicator:** A breathing `var(--accent-glow)` border pulse on the toggle when active.

---

#### Component 13: TimeProjectionToggle

**File:** `src/components/controls/TimeProjectionToggle.tsx`

```
[ Current  |  +6h  |  +24h ]
```

When switched to +6h or +24h:
1. `futureProjection.ts` calculates projected state based on current risk scores + cascade rates
2. More machines turn watch/critical on the map
3. Pipes spread risk visually
4. ROI bar updates to show projected potential loss
5. Overlay tint: `var(--projection-tint)` purple overlay on the canvas
6. Label: "PROJECTED STATE — +6h" in `JetBrains Mono` at top of canvas, fading in/out
7. Quick pane updates with projected financials

---

#### Component 14: ScenarioTriggers (Demo Control)

**File:** `src/components/controls/ScenarioTriggers.tsx`

Small button group in top-right corner of TopBar (or floating near the controls):

```
[ Trigger Failure ]  [ Trigger Cascade ]  [ Trigger Aging Spike ]
```

- **Trigger Failure:** Sets a random GOOD machine to CRITICAL instantly, fires full agent pipeline
- **Trigger Cascade:** Sets an upstream machine to CRITICAL, runs cascade tick immediately so judges watch propagation in real time
- **Trigger Aging Spike:** Sets 2-3 machines to >85% life used, spawning age badges and cost warnings
- Buttons styled differently: small, outlined, faded — clearly "demo controls" not production UI. `var(--text-muted)` color, dashed border

---

#### Component 15: FailureReplay

**File:** `src/components/controls/FailureReplay.tsx`

After a cascade event completes, a `[ Replay Incident ]` button appears in the QuickSummaryPane.

When clicked:
1. System logs the current state
2. Rewinds to pre-cascade state
3. Replays each cascade step with 1.5s delay between steps
4. Pipe pulses in slow motion (3x normal duration)
5. Origin machine flashes bright on initiation
6. Each downstream machine highlights as risk hits
7. Agent log replays entries in sync
8. After replay completes, restores to real state with a fade

---

### Zustand Store Architecture

#### machineStore.ts
```typescript
interface Machine {
  id: string;
  label: string;
  zone: ZoneId;
  status: 'good' | 'watch' | 'critical';
  riskScore: number;          // 0-100
  age: number;                // years
  ratedLife: number;          // years
  position: { x: number; y: number };  // canvas position within zone
  shape: 'tall-rect' | 'wide-squat' | 'long-bar' | 'large-square' | 'medium-square' | 'wide-rect' | 'l-shape' | 'small-square';
  baseColor: string;
  monthlyCosts: { oil: number; power: number; maintenance: number };
  rootCause: string | null;
  recommendedAction: string | null;
}
```

#### workerStore.ts
```typescript
interface Worker {
  id: string;
  variant: 'A' | 'B' | 'C' | 'D' | 'E';
  zone: ZoneId;
  state: 'idle' | 'patrolling' | 'dispatched' | 'repairing' | 'returning';
  position: { x: number; y: number };
  targetPosition: { x: number; y: number } | null;
  assignedMachine: string | null;
  frame: 0 | 1 | 2;
  facing: 'left' | 'right';
  frameInterval: number;     // 150-230ms, randomized
}
```

#### simulationStore.ts
```typescript
interface SimulationState {
  isRunning: boolean;
  autoMode: boolean;                     // Autonomous toggle
  timeProjection: 'current' | '+6h' | '+24h';
  cascadeInterval: number;               // 10000ms default
  lastCascadeTick: number;
  replayState: 'idle' | 'recording' | 'replaying';
  replayBuffer: SnapshotEntry[];
}
```

---

### Engine Logic

#### cascadeEngine.ts
- Runs every 10 seconds via `setInterval` in `useSimulationLoop`
- Iterates the pipe connection map
- Applies +15 risk to downstream of any critical machine
- Checks threshold crossings (>70 → watch, >90 → critical)
- Fires agent log entries for each cascade step
- In Autonomous Mode: also triggers `agentPipeline` after each cascade

#### agentPipeline.ts
- **Detection**: Read current machine states from store
- **Analysis**: Generate root cause string (from pre-defined templates matched to risk factors)
- **Prediction**: Calculate failure probability from risk score + age factor
- **Strategy**: Enumerate available actions per machine status
- **Decision**: Score each action by cost-benefit (pre-computed what-if table)
- **Action**: If auto-mode, dispatch workers; if manual, populate recommendations in panel
- **Learning**: Adjust risk decay rates based on actions taken (simple exponential)

Each step fires an agent log entry with appropriate tag and 300-600ms thinking delay.

#### roiCalculator.ts
- On detection: `potentialSavings += estimatedDowntimeCost`
- On repair: `potentialSavings += lifetimeSavingsFromPrevention`
- On replace: `potentialSavings += (monthlyExcess × remainingLife × 12)`
- Machine-specific cost templates drive all calculations

---

## Build Phases (Resequenced for Demo-Readiness)

### Phase 1 — Foundation (Hour 0-2)
- Vite + React + TypeScript scaffolding
- Tailwind v4 + CSS variables
- Google Fonts loading (`Press Start 2P`, `JetBrains Mono`, `Share Tech Mono`)
- All Zustand stores scaffolded with initial synthetic data
- `DashboardLayout` shell with fixed zones
- `TopBar` with static content
- **Checkpoint: Empty dark dashboard renders with topbar**

### Phase 2 — Canvas Map Core (Hour 2-4)
- PixiJS `<Application>` mounted in layout
- `ZoneRenderer`: floor tiles with zone-specific patterns
- `MachineNode`: 8 machines drawn with base colors and shapes
- Basic click detection (single-click highlight, double-click for future panel)
- Pipe connections drawn (static, default color)
- **Checkpoint: A dark canvas with colored machine blocks and pipes visible**

### Phase 3 — Map Interactions (Hour 4-6)
- Zoom + pan (scroll wheel + drag)
- Zone navigation arrows + zone transition animations (400ms slide)
- Machine status visuals (green/amber/red glow, shake, flicker)
- Pipe color updates based on machine status
- Cascade logic running on 10s interval
- **Checkpoint: Navigable zones where machines change status and pipes pulse**

### Phase 4 — Particle System + Aging (Hour 6-7)
- Steam particle emitters per machine
- Three emission modes (good/watch/critical)
- Machine aging visual progression (rust, darkening, badges)
- Age badge rendering
- **Checkpoint: Machines breathe steam, old machines look worn**

### Phase 5 — Workers (Hour 7-9)
- 5 worker variants procedurally drawn
- Walk animation (3 frames, per-worker intervals)
- Idle behaviors (head bob, glance, clipboard raise)
- Patrol movement (random waypoints within zone)
- **Checkpoint: Workers walk around the factory floor**

### Phase 6 — Worker Dispatch + Repair (Hour 9-10)
- Worker dispatch on action trigger
- Walk-to-machine pathfinding
- Repair animation (wrench icon, progress bar, machine calming)
- Worker resource management (splitting, queueing)
- **Checkpoint: Click a machine → worker walks over → repairs it**

### Phase 7 — Machine Panel (Hour 10-12)
- `MachinePanel` slide-in with Framer Motion
- Status tab: root cause, action buttons, what-if simulation table
- Machine Life tab: aging bar, monthly costs, replacement analysis
- Cost Delta overlay on action click
- Action buttons wired to worker dispatch + state updates
- **Checkpoint: Full interactive machine details panel**

### Phase 8 — Quick Summary Pane (Hour 12-13)
- Always-visible right pane with collapsible state
- Critical machine list with one-click `[→]` actions
- Financial summary (at risk, age waste, saved)
- `[Fix All Critical]` dispatches all workers
- `[Review Aging Machines]` highlights aged machines
- **Checkpoint: One-click factory management from the side pane**

### Phase 9 — Agent Logs + ROI Counter (Hour 13-14)
- Agent Logs drawer with terminal aesthetic
- Log entries wired to all engine events
- Agent tag color coding
- Pause/Clear/Close buttons
- ROI counter bar with smooth ticking animation
- Big jump effects on repair/replace
- **Checkpoint: Full agent intelligence trail visible, savings counter ticking**

### Phase 10 — Agent Thinking + Explain Decision (Hour 14-14.5)
- Agent thinking state visualization (delayed entries)
- "Explain This Decision" typewriter effect in panel
- Thinking dot animation on `[AGENT]` tags
- **Checkpoint: AI feels like it's reasoning, not just outputting**

### Phase 11 — Autonomous Mode (Hour 14.5-15)
- Manual/Autonomous toggle wired
- Auto-detect → auto-select → auto-dispatch → auto-ROI loop
- Visual indicator (purple border glow on topbar)
- Logs go rapid-fire in auto mode
- **Checkpoint: Toggle autonomous → watch the AI run the factory**

### Phase 12 — Future Projection (Hour 15-15.5)
- Time projection toggle (Current / +6h / +24h)
- Projected state calculator
- Purple overlay tint on canvas
- "PROJECTED STATE" label
- ROI updates to projected losses
- **Checkpoint: See the factory's future — judges see predictive power**

### Phase 13 — Scenario Triggers (Hour 15.5-16)
- Demo control buttons (Trigger Failure / Cascade / Aging Spike)
- Wired to engine functions
- Styled as subtle demo controls
- **Checkpoint: Perfect demo control**

### Phase 14 — Failure Replay (Hour 16-16.5)
- Replay incident button appears after cascades
- Rewind + slow-motion replay logic
- Synchronized log replay
- **Checkpoint: Storytelling — watch failure propagate in slow motion**

### Phase 15 — Polish Pass (Hour 16.5-17.5)
- Transition smoothness audit
- Performance profiling (ensure 60fps on canvas)
- `prefers-reduced-motion` support
- Keyboard shortcuts (Escape to close panels, arrow keys for zones)
- Edge cases (no workers available, all machines critical)
- Color contrast verification (WCAG AA minimum)

### Phase 16 — Final QA (Hour 17.5-18)
- Full demo flow rehearsal
- All scenario triggers tested
- Autonomous mode stress test
- Mobile/responsive check (desktop-first, but no breaks on resize)
- Screenshot walkthrough

---

## Open Questions

> ✅ **Machine Panel Visualization:** 2D Isometric Canvas art with CSS slow-rotation + red glow highlights on failure zones. No Three.js dependency.

> ✅ **PixiJS Confirmed:** Using PixiJS + `@pixi/react` for the factory canvas simulation layer.

> [!IMPORTANT]
> **3. Tailwind v4 vs v3:** The plan uses Tailwind v4 (CSS-first, `@tailwindcss/vite` plugin, no `tailwind.config.js`). If you have a preference for v3, let me know.

> [!IMPORTANT]
> **4. Indian Currency Formatting:** The plan uses `₹` with Indian numbering (L = Lakh, Cr = Crore). All financial displays follow this format (e.g., `₹4,75,000` not `₹475,000`). Confirm this is correct.

> [!NOTE]
> **5. Sound Effects:** Not in your spec, but a subtle audio ping on critical alerts and a satisfying "ka-ching" on ROI jumps would be extremely high-impact for demo. Want me to add Web Audio API integration for minimal sound design?

---

## Verification Plan

### Automated Tests
- `npm run dev` — verify hot reload works
- Browser DevTools Performance tab — verify canvas runs at 60fps
- Lighthouse accessibility audit — verify WCAG AA contrast ratios
- Test all scenario triggers in sequence
- Verify cascade propagation across zones

### Manual Verification (Demo Rehearsal)
1. **Cold Start:** Dashboard loads → machines are alive → workers patrol → steam rises
2. **Trigger Failure:** Click scenario button → machine goes critical → logs fire → quick pane updates
3. **Trigger Cascade:** Watch failure propagate via pipes → downstream machines degrade
4. **Machine Panel:** Double-click machine → panel slides in → explore root cause, what-if, costs
5. **Quick Action:** Click `[→]` in quick pane → worker dispatches → machine repairs → ROI jumps
6. **Fix All:** Click `[Fix All Critical]` → all workers mobilize simultaneously
7. **Autonomous Mode:** Toggle on → AI takes over → logs go rapid → machines get fixed automatically
8. **Future Projection:** Switch to +24h → see degraded future → switch back
9. **Failure Replay:** After cascade → click Replay → watch slow-motion propagation
10. **Explain Decision:** Click explain → typewriter explanation of AI reasoning
