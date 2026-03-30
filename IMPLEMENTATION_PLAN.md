# GearSwitch Dashboard — Implementation Plan

> **Aesthetic Direction:** *Industrial Retro-Futurism* — A pixel-art simulation hybrid crossed with cinematic control-room darkness. Not a SaaS dashboard. A living mission interface where an AI operator runs a factory in real time.

> **DFII Score: 14/15** (Impact: 5, Fit: 5, Feasibility: 4, Performance: 4, Consistency Risk: -4)

> **Differentiation Anchor:** "If this were screenshotted with the logo removed, you'd recognize it by the pixel-art machines breathing steam on a dark canvas floor, with neon cascade pipes pulsing failure across the factory."

---

## User Review Required

> ✅ **Machine Panel Visualization:** **2D Isometric Canvas rendering** (no Three.js). A high-fidelity 2D isometric SVG/Canvas drawing of the machine with animated red-glow highlights on affected failure zones. Slowly rotates via CSS transform. Same forensic-inspection feel, zero extra bundle weight.

> [!IMPORTANT]
> **PixiJS vs Raw Canvas:** You already have `pixi.js` installed. For the factory map with 8 machines, 5 workers, particles, pipes, and zone transitions running at 60fps, PixiJS gives us GPU-accelerated rendering, built-in sprite batching, and a scene graph — massively faster than raw Canvas2D for this workload. **I recommend using PixiJS for the simulation layer. Confirm?**

> [!WARNING]
> **Build Order Resequencing:** Your plan's hour-by-hour schedule has been restructured below for dependency correctness and maximum demo-readiness at every checkpoint. The factory map must render before workers can patrol it; state stores must exist before UI can consume them. The new order ensures a **demoable product at every 2-hour checkpoint.**

---

## Design System Snapshot

### Aesthetic Name: *Industrial Retro-Futurism*

**Key Inspiration:** NASA mission control interfaces, pixel-art factory simulators (Factorio vibes), submarine command displays — where every glow means something and silence means danger.

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
  /* Backgrounds */
  --bg-void:        #050505;   /* Deepest background — logs drawer */
  --bg-primary:     #0D0D0D;   /* Main dashboard background */
  --bg-surface:     #111118;   /* Panels, cards */
  --bg-elevated:    #1A1A2E;   /* Canvas floor tiles */
  --bg-hover:       #1E1E3A;   /* Hover states */

  /* Status Colors — the soul of the system */
  --status-good:    #22C55E;   /* Operational — steady green glow */
  --status-watch:   #EAB308;   /* Warning — amber flicker */
  --status-critical:#EF4444;   /* Critical — red pulse */
  --status-isolated:#1F2937;   /* Dead/isolated — dark grey */

  /* Agent Tag Colors */
  --agent-sensor:   #22D3EE;   /* Cyan — sensor readings */
  --agent-predict:  #EAB308;   /* Yellow — prediction */
  --agent-rca:      #F97316;   /* Orange — root cause analysis */
  --agent-action:   #EF4444;   /* Red — action decisions */
  --agent-roi:      #22C55E;   /* Green — financial impact */
  --agent-thinking: #A78BFA;   /* Purple — agent reasoning */

  /* UI Accents */
  --accent-primary: #6366F1;   /* Indigo — buttons, active states */
  --accent-glow:    #818CF8;   /* Lighter indigo — glows */
  --pipe-default:   #334155;   /* Slate — default pipe color */
  --pipe-active:    #475569;   /* Slightly brighter for active */

  /* Text */
  --text-primary:   #E2E8F0;   /* Primary text — slate-200 */
  --text-secondary: #94A3B8;   /* Secondary — slate-400 */
  --text-muted:     #64748B;   /* Muted — slate-500 */
  --text-inverse:   #0D0D0D;   /* On light backgrounds */

  /* Financial */
  --money-save:     #22C55E;   /* Savings — green */
  --money-loss:     #EF4444;   /* Losses — red */
  --money-neutral:  #EAB308;   /* Pending — amber */

  /* Projection overlay */
  --projection-tint: rgba(139, 92, 246, 0.08); /* Purple tint for future mode */
}
```

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

## Proposed Changes

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
