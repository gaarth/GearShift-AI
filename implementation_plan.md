# GearShift — Backend Implementation Plan

> **AI-Native Industrial Control Tower with Hybrid Intelligence + Simulation Engine**
> Hackathon build target: **24 hours**  |  Stack: **Next.js App Router, Node.js, In-Memory State, SSE, PixiJS (frontend)**

---

## User Review Required

> [!IMPORTANT]
> **Key decisions that need your sign-off before I start building:**
> 1. **ML Model approach** — I recommend hardcoding logistic-regression coefficients (fastest, zero Python dependency). Acceptable?
> 2. **LLM provider** — Which provider/model for the explanation layer? (OpenAI `gpt-4o-mini`, Anthropic `claude-3-haiku`, Gemini `gemini-2.0-flash`, or skip LLM layer for MVP?)
> 3. **Deployment** — Vercel serverless has cold-start & no persistent memory between requests. I'll use a **singleton module-level store** that persists within a single serverless instance. For the hackathon demo this is fine. Acceptable?
> 4. **Frontend scope** — The PRD says "frontend handles rendering." I will expose all data via API + SSE. I will NOT build the PixiJS sandbox — only the API contract. Correct?
> 5. **Database** — Pure in-memory (fastest) vs Supabase (persistent across deploys). Which do you prefer for the hackathon?

---

## 1. Architecture Overview

```mermaid
graph TD
    subgraph Ingestion
        A[POST /api/events/inject] --> B[Event Ingestion Service]
    end

    subgraph StateEngine["State Engine (In-Memory)"]
        B --> C[Machine State Store]
        B --> D[Dependency Graph]
        B --> E[Event Log]
    end

    subgraph HybridIntelligence["Hybrid Intelligence"]
        C --> F[Rule Engine]
        C --> G[ML Model]
        F --> H[Risk Fusion]
        G --> H
    end

    subgraph Agents
        H --> I[Prediction Agent]
        I --> J[Causality Agent]
        J --> K[Cost Agent]
        K --> L[Action Agent]
    end

    subgraph Simulation
        L --> M[Simulation Engine]
        M --> N[Event Queue]
        N --> M
    end

    subgraph Realtime["Real-Time Layer"]
        M --> O[SSE Broadcaster]
        O --> P[Connected Clients]
    end

    subgraph API["API Layer"]
        Q[GET /api/machines]
        R[GET /api/machines/:id]
        S[POST /api/simulate/tick]
        T[POST /api/machines/:id/fix]
        U[GET /api/insights]
        V[GET /api/stream]
    end
```

### Design Principles

| Principle | Decision |
|---|---|
| State management | Module-level singleton (survives across requests within same instance) |
| Concurrency | Single-threaded event loop — no locks needed |
| Simulation | Discrete-event with tick-based progression |
| ML | Hardcoded logistic regression coefficients (no runtime dependency) |
| Real-time | Server-Sent Events (simpler than WebSockets for Vercel) |
| Serialization | JSON over HTTP |

---

## 2. Folder Structure

```
forgex/
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── README.md
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # Root layout
│   │   ├── page.tsx                       # Dashboard shell (minimal)
│   │   │
│   │   └── api/
│   │       ├── machines/
│   │       │   ├── route.ts               # GET /api/machines
│   │       │   └── [id]/
│   │       │       ├── route.ts           # GET /api/machines/:id
│   │       │       └── fix/
│   │       │           └── route.ts       # POST /api/machines/:id/fix
│   │       │
│   │       ├── events/
│   │       │   └── inject/
│   │       │       └── route.ts           # POST /api/events/inject
│   │       │
│   │       ├── simulate/
│   │       │   └── tick/
│   │       │       └── route.ts           # POST /api/simulate/tick
│   │       │
│   │       ├── insights/
│   │       │   └── route.ts              # GET /api/insights
│   │       │
│   │       └── stream/
│   │           └── route.ts              # GET /api/stream (SSE)
│   │
│   ├── core/
│   │   ├── state/
│   │   │   ├── store.ts                  # Singleton global state
│   │   │   ├── machine-store.ts          # Machine CRUD + state transitions
│   │   │   └── graph-store.ts            # Dependency graph operations
│   │   │
│   │   ├── engine/
│   │   │   ├── event-ingestion.ts        # Event processing pipeline
│   │   │   ├── rule-engine.ts            # Deterministic risk rules
│   │   │   ├── ml-model.ts              # Hardcoded logistic regression
│   │   │   ├── risk-fusion.ts           # Weighted combination
│   │   │   └── simulation-engine.ts     # Discrete-event simulation loop
│   │   │
│   │   ├── agents/
│   │   │   ├── agent-orchestrator.ts    # Pipeline coordinator
│   │   │   ├── prediction-agent.ts      # Risk computation
│   │   │   ├── causality-agent.ts       # Graph propagation
│   │   │   ├── cost-agent.ts            # Financial impact
│   │   │   └── action-agent.ts          # Decision + fix logic
│   │   │
│   │   ├── realtime/
│   │   │   └── sse-manager.ts           # SSE connection manager + broadcast
│   │   │
│   │   └── llm/
│   │       └── explanation-service.ts   # LLM-powered explanations (optional)
│   │
│   ├── models/
│   │   ├── machine.ts                   # Machine type + factory
│   │   ├── event.ts                     # Event types + enums
│   │   ├── connection.ts                # Dependency edge type
│   │   ├── simulation.ts               # Simulation state types
│   │   └── action.ts                   # Action recommendation types
│   │
│   ├── data/
│   │   ├── seed-machines.ts             # Initial machine fleet
│   │   └── seed-connections.ts          # Initial dependency graph
│   │
│   └── lib/
│       ├── constants.ts                 # Thresholds, weights, config
│       └── utils.ts                     # Helpers (clamp, uuid, etc.)
│
└── scripts/
    └── generate-ml-data.ts              # (Optional) synthetic data generator
```

---

## 3. Data Models (TypeScript)

### 3.1 Machine

```typescript
// src/models/machine.ts

export type MachineStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'FAILED';

export interface Machine {
  id: string;
  name: string;
  type: 'pump' | 'compressor' | 'conveyor' | 'generator' | 'turbine' | 'heat-exchanger';
  status: MachineStatus;

  // Sensor readings
  temperature: number;    // °C — normal: 40-70, warning: 70-90, critical: 90+
  vibration: number;      // mm/s — normal: 0-4, warning: 4-7, critical: 7+
  load: number;           // % — normal: 0-60, warning: 60-80, critical: 80+

  // Risk scores (0-1)
  ruleRisk: number;
  mlRisk: number;
  finalRisk: number;

  // Derived
  failureProbability: number;  // 0-1
  timeToFailure: number;       // hours (estimated)

  // Graph
  connections: string[];  // IDs of dependents

  // Position (for frontend rendering)
  position: { x: number; y: number };

  // Metadata
  lastUpdated: number;    // timestamp
  history: SensorSnapshot[];
}

export interface SensorSnapshot {
  timestamp: number;
  temperature: number;
  vibration: number;
  load: number;
  risk: number;
}
```

### 3.2 Connection (Dependency Edge)

```typescript
// src/models/connection.ts

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  dependencyStrength: number;  // 0-1 — how strongly source impacts target
  type: 'power' | 'cooling' | 'material' | 'control';
}
```

### 3.3 Event

```typescript
// src/models/event.ts

export type EventType =
  | 'SENSOR_UPDATE'
  | 'USER_INJECTED_EVENT'
  | 'ANOMALY'
  | 'FAILURE'
  | 'FIX_ACTION'
  | 'SIMULATION_TICK'
  | 'CASCADE_PROPAGATION';

export interface SystemEvent {
  id: string;
  type: EventType;
  machineId: string;
  timestamp: number;
  payload: Record<string, unknown>;
  source: 'system' | 'user' | 'simulation' | 'agent';
}
```

### 3.4 Simulation

```typescript
// src/models/simulation.ts

export interface SimulationState {
  isRunning: boolean;
  currentTick: number;
  tickIntervalMs: number;     // default: 1000 (1 second = 1 sim-hour)
  speed: number;              // multiplier: 1x, 2x, 5x
  eventQueue: ScheduledEvent[];
  history: SimulationSnapshot[];
}

export interface ScheduledEvent {
  event: SystemEvent;
  executeAtTick: number;
}

export interface SimulationSnapshot {
  tick: number;
  timestamp: number;
  machineStates: Record<string, {
    status: MachineStatus;
    finalRisk: number;
    temperature: number;
    vibration: number;
    load: number;
  }>;
}
```

### 3.5 Action

```typescript
// src/models/action.ts

export type ActionType = 'FIX_NOW' | 'SCHEDULE' | 'MONITOR' | 'ESCALATE';
export type ActionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActionRecommendation {
  id: string;
  machineId: string;
  action: ActionType;
  priority: ActionPriority;
  reason: string;
  estimatedCost: number;         // cost if NOT acted upon
  estimatedSavings: number;       // savings if acted upon NOW
  deadline: number;               // ticks until too late
  createdAt: number;
  executed: boolean;
}
```

---

## 4. Module Design — Deep Dive

### 4.1 State Engine (`src/core/state/store.ts`)

The singleton store holds ALL mutable state. Every other module reads/writes through this interface.

```typescript
// Singleton pattern — survives across requests in same serverless instance
class GlobalStore {
  machines: Map<string, Machine> = new Map();
  connections: Connection[] = [];
  events: SystemEvent[] = [];
  actions: ActionRecommendation[] = [];
  simulation: SimulationState = {
    isRunning: false,
    currentTick: 0,
    tickIntervalMs: 1000,
    speed: 1,
    eventQueue: [],
    history: [],
  };

  // SSE clients
  sseClients: Set<ReadableStreamController> = new Set();

  // Initialization flag
  initialized: boolean = false;
}

// Module-level singleton
export const store = new GlobalStore();
```

**Machine Store** exposes:
- `getMachine(id)` / `getAllMachines()`
- `updateMachine(id, partial)` — triggers risk recalc + SSE broadcast
- `transitionStatus(id)` — applies status rules based on `finalRisk`
- `resetMachine(id)` — used by FIX_ACTION

**Graph Store** exposes:
- `getDependents(machineId)` — returns machines that depend on this one
- `getDependencies(machineId)` — returns machines this one depends on
- `getImpactPath(machineId)` — BFS/DFS to find full cascade chain
- `getConnectionStrength(sourceId, targetId)`

### 4.2 Event Ingestion (`src/core/engine/event-ingestion.ts`)

```
          ┌─────────────────────┐
          │   Incoming Event    │
          └─────────┬───────────┘
                    │
          ┌─────────▼───────────┐
          │  Validate + Enrich  │
          │   (add id, ts)      │
          └─────────┬───────────┘
                    │
          ┌─────────▼───────────┐
          │   Route by Type     │
          └─────────┬───────────┘
                    │
    ┌───────────────┼────────────────┐
    │               │                │
SENSOR_UPDATE   USER_INJECTED   FIX_ACTION
    │               │                │
    ▼               ▼                ▼
Update sensors  Apply effect    Reset machine
    │               │                │
    └───────────────┼────────────────┘
                    │
          ┌─────────▼───────────┐
          │  Agent Orchestrator │
          │  (full pipeline)    │
          └─────────────────────┘
```

**Key logic:**

```typescript
export function processEvent(event: SystemEvent): void {
  // 1. Log
  store.events.push(event);

  // 2. Route
  switch (event.type) {
    case 'SENSOR_UPDATE':
      applySensorUpdate(event);
      break;
    case 'USER_INJECTED_EVENT':
      applyInjectedEvent(event);
      break;
    case 'FIX_ACTION':
      applyFix(event);
      break;
    // ...
  }

  // 3. Run full agent pipeline on affected machine
  orchestrator.run(event.machineId);

  // 4. Broadcast state change
  broadcastState();
}
```

### 4.3 Rule Engine (`src/core/engine/rule-engine.ts`)

Deterministic, fast, transparent.

```typescript
export function computeRuleRisk(machine: Machine): number {
  let risk = 0;

  // Temperature rules
  if (machine.temperature > 95) risk += 0.4;
  else if (machine.temperature > 85) risk += 0.25;
  else if (machine.temperature > 75) risk += 0.1;

  // Vibration rules
  if (machine.vibration > 8) risk += 0.35;
  else if (machine.vibration > 6) risk += 0.2;
  else if (machine.vibration > 4) risk += 0.1;

  // Load rules
  if (machine.load > 90) risk += 0.25;
  else if (machine.load > 75) risk += 0.15;
  else if (machine.load > 60) risk += 0.05;

  // Compound multiplier: multiple high readings are exponentially worse
  const highCount = [
    machine.temperature > 85,
    machine.vibration > 6,
    machine.load > 75,
  ].filter(Boolean).length;

  if (highCount >= 3) risk *= 1.5;
  else if (highCount >= 2) risk *= 1.2;

  return Math.min(risk, 1.0);
}
```

### 4.4 ML Model (`src/core/engine/ml-model.ts`)

Hardcoded logistic regression. Coefficients pre-computed from synthetic data.

```typescript
// Pre-trained coefficients (logistic regression)
const COEFFICIENTS = {
  intercept: -4.5,
  temperature: 0.045,   // per °C above baseline
  vibration: 0.35,      // per mm/s
  load: 0.025,          // per %
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function computeMLRisk(machine: Machine): number {
  const z =
    COEFFICIENTS.intercept +
    COEFFICIENTS.temperature * machine.temperature +
    COEFFICIENTS.vibration * machine.vibration +
    COEFFICIENTS.load * machine.load;

  return sigmoid(z);
}
```

**Why this works for hackathon:**
- Zero dependencies
- Instant computation
- Outputs 0-1 probability
- Coefficients are tuned to produce reasonable outputs for typical sensor ranges

### 4.5 Risk Fusion (`src/core/engine/risk-fusion.ts`)

```typescript
const RULE_WEIGHT = 0.6;
const ML_WEIGHT = 0.4;

export function fuseRisk(ruleRisk: number, mlRisk: number): number {
  return (RULE_WEIGHT * ruleRisk) + (ML_WEIGHT * mlRisk);
}

export function estimateTimeToFailure(finalRisk: number): number {
  // Higher risk = less time
  // Risk 1.0 → 0 hours, Risk 0.0 → 168 hours (1 week)
  if (finalRisk >= 0.95) return 0;
  return Math.max(0, Math.round(168 * (1 - finalRisk)));
}

export function deriveStatus(finalRisk: number): MachineStatus {
  if (finalRisk >= 0.85) return 'FAILED';
  if (finalRisk >= 0.6)  return 'CRITICAL';
  if (finalRisk >= 0.35) return 'WARNING';
  return 'HEALTHY';
}
```

### 4.6 Agent Orchestrator (`src/core/agents/agent-orchestrator.ts`)

Sequential pipeline — each agent feeds the next.

```
┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Prediction   │───▶│   Causality   │───▶│     Cost      │───▶│    Action     │
│    Agent      │    │    Agent      │    │    Agent      │    │    Agent      │
└───────────────┘    └───────────────┘    └───────────────┘    └───────────────┘
     │                     │                    │                    │
  ruleRisk            propagated            costEstimate        recommendation
  mlRisk              impacts               savings             action type
  finalRisk           affected IDs          deadline
```

```typescript
export class AgentOrchestrator {
  run(machineId: string): void {
    // Phase 1: Prediction
    const prediction = predictionAgent.compute(machineId);

    // Phase 2: Causality — propagate risk downstream
    const impacts = causalityAgent.propagate(machineId);

    // Phase 3: Cost — quantify financial impact
    const costAnalysis = costAgent.analyze(machineId, impacts);

    // Phase 4: Action — decide what to do
    const action = actionAgent.decide(machineId, prediction, costAnalysis);

    // Store action if generated
    if (action) {
      store.actions.push(action);
    }
  }
}
```

### 4.7 Prediction Agent

```typescript
export class PredictionAgent {
  compute(machineId: string): PredictionResult {
    const machine = store.machines.get(machineId)!;

    const ruleRisk = computeRuleRisk(machine);
    const mlRisk = computeMLRisk(machine);
    const finalRisk = fuseRisk(ruleRisk, mlRisk);
    const timeToFailure = estimateTimeToFailure(finalRisk);
    const status = deriveStatus(finalRisk);

    // Update machine state
    updateMachine(machineId, {
      ruleRisk,
      mlRisk,
      finalRisk,
      failureProbability: finalRisk,
      timeToFailure,
      status,
    });

    return { machineId, ruleRisk, mlRisk, finalRisk, timeToFailure, status };
  }
}
```

### 4.8 Causality Agent (Graph Propagation)

This is the most architecturally interesting module. It uses **BFS** to propagate risk through the dependency graph.

```typescript
export class CausalityAgent {
  propagate(sourceMachineId: string): CausalityImpact[] {
    const source = store.machines.get(sourceMachineId)!;
    const impacts: CausalityImpact[] = [];

    // Only propagate if source is at meaningful risk
    if (source.finalRisk < 0.3) return impacts;

    // BFS through dependency graph
    const visited = new Set<string>([sourceMachineId]);
    const queue: { machineId: string; incomingRisk: number; depth: number }[] = [];

    // Seed queue with direct dependents
    const directDependents = getConnectionsFrom(sourceMachineId);
    for (const conn of directDependents) {
      queue.push({
        machineId: conn.targetId,
        incomingRisk: source.finalRisk * conn.dependencyStrength,
        depth: 1,
      });
    }

    while (queue.length > 0) {
      const { machineId, incomingRisk, depth } = queue.shift()!;

      if (visited.has(machineId)) continue;
      visited.add(machineId);

      // Attenuate risk with depth (prevents runaway cascades)
      const attenuatedRisk = incomingRisk * Math.pow(0.7, depth - 1);

      if (attenuatedRisk < 0.05) continue; // below noise floor

      const target = store.machines.get(machineId)!;

      // Apply propagated risk (additive, capped at 1.0)
      const newRisk = Math.min(1.0, target.finalRisk + attenuatedRisk * 0.5);

      impacts.push({
        machineId,
        previousRisk: target.finalRisk,
        addedRisk: attenuatedRisk * 0.5,
        newRisk,
        depth,
        sourceChain: [sourceMachineId],
      });

      // Update target
      updateMachine(machineId, {
        finalRisk: newRisk,
        status: deriveStatus(newRisk),
        timeToFailure: estimateTimeToFailure(newRisk),
      });

      // Continue propagation to next level
      const nextDependents = getConnectionsFrom(machineId);
      for (const conn of nextDependents) {
        if (!visited.has(conn.targetId)) {
          queue.push({
            machineId: conn.targetId,
            incomingRisk: newRisk * conn.dependencyStrength,
            depth: depth + 1,
          });
        }
      }
    }

    return impacts;
  }
}
```

**Key design decisions:**
- **Depth attenuation** (`0.7^depth`) prevents infinite amplification
- **Noise floor** (`< 0.05`) stops propagation of negligible risk
- **Additive with cap** — propagated risk adds to existing, never exceeds 1.0
- **BFS** ensures breadth-first (closest machines impacted first)

### 4.9 Cost Agent

```typescript
const BASE_COSTS: Record<string, number> = {
  pump: 15000,
  compressor: 45000,
  conveyor: 12000,
  generator: 80000,
  turbine: 120000,
  'heat-exchanger': 35000,
};

const DOWNTIME_COST_PER_HOUR = 5000; // dollars
const DEGRADATION_RATE = 0.1;        // 10% cost increase per hour delayed

export class CostAgent {
  analyze(machineId: string, cascadeImpacts: CausalityImpact[]): CostAnalysis {
    const machine = store.machines.get(machineId)!;
    const baseCost = BASE_COSTS[machine.type] || 20000;

    // Direct failure cost
    const directCost = baseCost * machine.finalRisk;

    // Cascade cost (sum of all downstream impact costs)
    const cascadeCost = cascadeImpacts.reduce((sum, impact) => {
      const impactedMachine = store.machines.get(impact.machineId)!;
      return sum + (BASE_COSTS[impactedMachine.type] || 20000) * impact.addedRisk;
    }, 0);

    // Time-escalating cost: cost grows the longer you wait
    const ttf = machine.timeToFailure;
    const futureCost = (directCost + cascadeCost) * (1 + DEGRADATION_RATE * Math.max(0, 24 - ttf));

    // Savings if fixed NOW vs waiting
    const savingsIfFixedNow = futureCost - (baseCost * 0.1); // repair cost is ~10% of replacement

    return {
      machineId,
      directCost: Math.round(directCost),
      cascadeCost: Math.round(cascadeCost),
      totalCost: Math.round(directCost + cascadeCost),
      futureCost: Math.round(futureCost),
      savingsIfFixedNow: Math.round(savingsIfFixedNow),
      affectedMachineCount: cascadeImpacts.length,
    };
  }
}
```

### 4.10 Action Agent

```typescript
export class ActionAgent {
  decide(machineId: string, prediction: PredictionResult, cost: CostAnalysis): ActionRecommendation | null {
    const machine = store.machines.get(machineId)!;

    let action: ActionType;
    let priority: ActionPriority;
    let reason: string;

    if (machine.finalRisk >= 0.85) {
      action = 'FIX_NOW';
      priority = 'CRITICAL';
      reason = `Imminent failure detected. ${cost.affectedMachineCount} downstream machines at risk. Potential loss: $${cost.futureCost.toLocaleString()}.`;
    } else if (machine.finalRisk >= 0.6) {
      action = 'FIX_NOW';
      priority = 'HIGH';
      reason = `Critical risk level. Cascade cost: $${cost.cascadeCost.toLocaleString()}. Fix now saves $${cost.savingsIfFixedNow.toLocaleString()}.`;
    } else if (machine.finalRisk >= 0.35) {
      action = 'SCHEDULE';
      priority = 'MEDIUM';
      reason = `Warning state. Estimated ${machine.timeToFailure}h until failure. Schedule maintenance within ${Math.round(machine.timeToFailure * 0.5)}h.`;
    } else if (machine.finalRisk >= 0.15) {
      action = 'MONITOR';
      priority = 'LOW';
      reason = `Elevated baseline. Monitor sensors closely.`;
    } else {
      return null; // No action needed
    }

    return {
      id: generateId(),
      machineId,
      action,
      priority,
      reason,
      estimatedCost: cost.futureCost,
      estimatedSavings: cost.savingsIfFixedNow,
      deadline: machine.timeToFailure,
      createdAt: Date.now(),
      executed: false,
    };
  }
}
```

### 4.11 Simulation Engine

The simulation engine is a **discrete-event system** with a tick-based clock.

```typescript
export class SimulationEngine {
  /**
   * Advance simulation by one tick.
   * 1. Process scheduled events whose time has come
   * 2. Apply sensor drift (gradual degradation)
   * 3. Run full agent pipeline on affected machines
   * 4. Snapshot state
   */
  tick(): SimulationTickResult {
    const sim = store.simulation;
    sim.currentTick++;

    const processedEvents: SystemEvent[] = [];

    // 1. Execute scheduled events
    const due = sim.eventQueue.filter(e => e.executeAtTick <= sim.currentTick);
    sim.eventQueue = sim.eventQueue.filter(e => e.executeAtTick > sim.currentTick);

    for (const scheduled of due) {
      processEvent(scheduled.event);
      processedEvents.push(scheduled.event);
    }

    // 2. Apply sensor drift to all machines
    for (const [id, machine] of store.machines) {
      if (machine.status === 'FAILED') continue; // failed machines don't drift

      const drift = this.computeDrift(machine);
      updateMachine(id, {
        temperature: clamp(machine.temperature + drift.temperature, 20, 150),
        vibration: clamp(machine.vibration + drift.vibration, 0, 15),
        load: clamp(machine.load + drift.load, 0, 100),
      });

      // Re-run prediction pipeline
      orchestrator.run(id);
    }

    // 3. Check for new failures and schedule cascade events
    for (const [id, machine] of store.machines) {
      if (machine.status === 'FAILED' && machine.finalRisk >= 0.85) {
        this.scheduleCascadeEvents(id);
      }
    }

    // 4. Snapshot
    const snapshot = this.captureSnapshot();
    sim.history.push(snapshot);

    // 5. Broadcast
    broadcastState();

    return {
      tick: sim.currentTick,
      processedEvents,
      snapshot,
    };
  }

  private computeDrift(machine: Machine): { temperature: number; vibration: number; load: number } {
    // Machines under stress degrade faster
    const stressFactor = machine.finalRisk;

    return {
      temperature: (Math.random() - 0.3) * 2 * (1 + stressFactor * 3),
      vibration: (Math.random() - 0.3) * 0.5 * (1 + stressFactor * 2),
      load: (Math.random() - 0.4) * 3 * (1 + stressFactor),
    };
  }

  private scheduleCascadeEvents(failedMachineId: string): void {
    const connections = getConnectionsFrom(failedMachineId);

    for (const conn of connections) {
      // Delay cascade based on dependency strength (stronger = faster)
      const delay = Math.max(1, Math.round(3 / conn.dependencyStrength));

      const cascadeEvent: ScheduledEvent = {
        event: {
          id: generateId(),
          type: 'CASCADE_PROPAGATION',
          machineId: conn.targetId,
          timestamp: Date.now(),
          payload: {
            sourceId: failedMachineId,
            impactStrength: conn.dependencyStrength,
          },
          source: 'simulation',
        },
        executeAtTick: store.simulation.currentTick + delay,
      };

      store.simulation.eventQueue.push(cascadeEvent);
    }
  }

  private captureSnapshot(): SimulationSnapshot {
    const machineStates: SimulationSnapshot['machineStates'] = {};
    for (const [id, m] of store.machines) {
      machineStates[id] = {
        status: m.status,
        finalRisk: m.finalRisk,
        temperature: m.temperature,
        vibration: m.vibration,
        load: m.load,
      };
    }
    return {
      tick: store.simulation.currentTick,
      timestamp: Date.now(),
      machineStates,
    };
  }
}
```

**Simulation state flow:**
```
HEALTHY ──(risk > 0.35)──▶ WARNING ──(risk > 0.6)──▶ CRITICAL ──(risk > 0.85)──▶ FAILED
   ▲                                                                                │
   └──────────────────────── FIX_ACTION (reset sensors + risk) ◀────────────────────┘
```

### 4.12 Fix Logic

```typescript
export function applyFix(machineId: string): Machine {
  const machine = store.machines.get(machineId)!;

  // Reset to healthy baseline with some variance
  const fixed = {
    temperature: 45 + Math.random() * 10,  // 45-55°C
    vibration: 1.5 + Math.random() * 1.5,  // 1.5-3.0 mm/s
    load: 30 + Math.random() * 15,          // 30-45%
    ruleRisk: 0,
    mlRisk: 0,
    finalRisk: 0,
    failureProbability: 0,
    timeToFailure: 168,
    status: 'HEALTHY' as MachineStatus,
  };

  updateMachine(machineId, fixed);

  // Mark any pending actions as executed
  store.actions
    .filter(a => a.machineId === machineId && !a.executed)
    .forEach(a => { a.executed = true; });

  // Remove any pending cascade events targeting this machine
  store.simulation.eventQueue = store.simulation.eventQueue.filter(
    e => e.event.machineId !== machineId
  );

  return store.machines.get(machineId)!;
}
```

---

## 5. API Route Design

### 5.1 `GET /api/machines`

```typescript
// Returns all machines with current state
export async function GET() {
  ensureInitialized();
  const machines = Array.from(store.machines.values());
  return Response.json({
    machines,
    connections: store.connections,
    simulation: {
      tick: store.simulation.currentTick,
      isRunning: store.simulation.isRunning,
      queuedEvents: store.simulation.eventQueue.length,
    },
  });
}
```

### 5.2 `GET /api/machines/[id]`

```typescript
export async function GET(req: Request, { params }: { params: { id: string } }) {
  ensureInitialized();
  const machine = store.machines.get(params.id);
  if (!machine) return Response.json({ error: 'Not found' }, { status: 404 });

  const connections = store.connections.filter(
    c => c.sourceId === params.id || c.targetId === params.id
  );

  const actions = store.actions.filter(a => a.machineId === params.id);

  return Response.json({ machine, connections, actions });
}
```

### 5.3 `POST /api/events/inject`

```typescript
// Body: { machineId, type, payload }
export async function POST(req: Request) {
  ensureInitialized();
  const body = await req.json();

  const event: SystemEvent = {
    id: generateId(),
    type: body.type || 'USER_INJECTED_EVENT',
    machineId: body.machineId,
    timestamp: Date.now(),
    payload: body.payload || {},
    source: 'user',
  };

  processEvent(event);

  return Response.json({
    event,
    machineState: store.machines.get(body.machineId),
  });
}
```

### 5.4 `POST /api/simulate/tick`

```typescript
// Body (optional): { count?: number }  — how many ticks to advance
export async function POST(req: Request) {
  ensureInitialized();
  const body = await req.json().catch(() => ({}));
  const count = Math.min(body.count || 1, 50); // cap at 50 ticks per request

  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(simulationEngine.tick());
  }

  return Response.json({
    ticksProcessed: count,
    currentTick: store.simulation.currentTick,
    results,
    machines: Array.from(store.machines.values()),
  });
}
```

### 5.5 `POST /api/machines/[id]/fix`

```typescript
export async function POST(req: Request, { params }: { params: { id: string } }) {
  ensureInitialized();
  const machine = store.machines.get(params.id);
  if (!machine) return Response.json({ error: 'Not found' }, { status: 404 });

  const fixed = applyFix(params.id);

  // Log fix event
  processEvent({
    id: generateId(),
    type: 'FIX_ACTION',
    machineId: params.id,
    timestamp: Date.now(),
    payload: { previousStatus: machine.status },
    source: 'user',
  });

  broadcastState();

  return Response.json({ machine: fixed, message: `${machine.name} has been repaired.` });
}
```

### 5.6 `GET /api/insights`

```typescript
export async function GET() {
  ensureInitialized();

  const machines = Array.from(store.machines.values());
  const criticalMachines = machines.filter(m => m.status === 'CRITICAL' || m.status === 'FAILED');
  const pendingActions = store.actions.filter(a => !a.executed);
  const totalRisk = machines.reduce((s, m) => s + m.finalRisk, 0) / machines.length;

  const insights = {
    overallHealthScore: Math.round((1 - totalRisk) * 100),
    totalMachines: machines.length,
    statusBreakdown: {
      healthy: machines.filter(m => m.status === 'HEALTHY').length,
      warning: machines.filter(m => m.status === 'WARNING').length,
      critical: machines.filter(m => m.status === 'CRITICAL').length,
      failed: machines.filter(m => m.status === 'FAILED').length,
    },
    topRisks: machines
      .sort((a, b) => b.finalRisk - a.finalRisk)
      .slice(0, 5)
      .map(m => ({
        id: m.id,
        name: m.name,
        risk: m.finalRisk,
        status: m.status,
        timeToFailure: m.timeToFailure,
      })),
    pendingActions: pendingActions.slice(0, 10),
    simulationTick: store.simulation.currentTick,
    estimatedTotalLoss: pendingActions.reduce((s, a) => s + a.estimatedCost, 0),
    estimatedTotalSavings: pendingActions.reduce((s, a) => s + a.estimatedSavings, 0),
  };

  return Response.json(insights);
}
```

### 5.7 `GET /api/stream` (SSE)

```typescript
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      store.sseClients.add(controller);

      // Send initial state
      const data = JSON.stringify({
        type: 'INIT',
        machines: Array.from(store.machines.values()),
        connections: store.connections,
        simulation: store.simulation,
      });
      controller.enqueue(`data: ${data}\n\n`);
    },
    cancel(controller) {
      store.sseClients.delete(controller);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Broadcast function (called after every state change)
export function broadcastState(): void {
  const data = JSON.stringify({
    type: 'STATE_UPDATE',
    tick: store.simulation.currentTick,
    machines: Array.from(store.machines.values()),
    timestamp: Date.now(),
  });

  const message = `data: ${data}\n\n`;
  const encoder = new TextEncoder();

  for (const client of store.sseClients) {
    try {
      client.enqueue(encoder.encode(message));
    } catch {
      store.sseClients.delete(client);
    }
  }
}
```

---

## 6. Seed Data

### 6.1 Machine Fleet (8 machines)

```typescript
export const SEED_MACHINES: Omit<Machine, 'ruleRisk' | 'mlRisk' | 'finalRisk' | 'failureProbability' | 'timeToFailure' | 'lastUpdated' | 'history'>[] = [
  { id: 'pump-01',     name: 'Main Coolant Pump',      type: 'pump',           status: 'HEALTHY', temperature: 55, vibration: 2.1, load: 45, connections: ['hx-01'], position: { x: 200, y: 300 } },
  { id: 'comp-01',     name: 'Air Compressor Alpha',    type: 'compressor',     status: 'HEALTHY', temperature: 62, vibration: 3.2, load: 58, connections: ['turb-01'], position: { x: 400, y: 150 } },
  { id: 'conv-01',     name: 'Assembly Line Conveyor',  type: 'conveyor',       status: 'HEALTHY', temperature: 42, vibration: 1.8, load: 52, connections: ['conv-02'], position: { x: 600, y: 300 } },
  { id: 'conv-02',     name: 'Packaging Conveyor',      type: 'conveyor',       status: 'HEALTHY', temperature: 40, vibration: 1.5, load: 48, connections: [],         position: { x: 800, y: 300 } },
  { id: 'gen-01',      name: 'Backup Generator',        type: 'generator',      status: 'HEALTHY', temperature: 70, vibration: 3.8, load: 35, connections: ['comp-01', 'pump-01'], position: { x: 300, y: 500 } },
  { id: 'turb-01',     name: 'Steam Turbine',           type: 'turbine',        status: 'HEALTHY', temperature: 78, vibration: 4.2, load: 65, connections: ['gen-01', 'hx-01'], position: { x: 500, y: 500 } },
  { id: 'hx-01',       name: 'Primary Heat Exchanger',  type: 'heat-exchanger', status: 'HEALTHY', temperature: 68, vibration: 2.5, load: 55, connections: ['conv-01'], position: { x: 700, y: 500 } },
  { id: 'pump-02',     name: 'Hydraulic Press Pump',    type: 'pump',           status: 'HEALTHY', temperature: 58, vibration: 2.8, load: 50, connections: ['conv-01'], position: { x: 100, y: 500 } },
];
```

### 6.2 Dependency Graph

```typescript
export const SEED_CONNECTIONS: Connection[] = [
  { id: 'c1', sourceId: 'gen-01',  targetId: 'comp-01', dependencyStrength: 0.9, type: 'power' },
  { id: 'c2', sourceId: 'gen-01',  targetId: 'pump-01', dependencyStrength: 0.8, type: 'power' },
  { id: 'c3', sourceId: 'comp-01', targetId: 'turb-01', dependencyStrength: 0.7, type: 'material' },
  { id: 'c4', sourceId: 'turb-01', targetId: 'gen-01',  dependencyStrength: 0.5, type: 'power' },
  { id: 'c5', sourceId: 'turb-01', targetId: 'hx-01',   dependencyStrength: 0.6, type: 'cooling' },
  { id: 'c6', sourceId: 'pump-01', targetId: 'hx-01',   dependencyStrength: 0.85, type: 'cooling' },
  { id: 'c7', sourceId: 'hx-01',   targetId: 'conv-01', dependencyStrength: 0.4, type: 'cooling' },
  { id: 'c8', sourceId: 'conv-01', targetId: 'conv-02', dependencyStrength: 0.95, type: 'material' },
  { id: 'c9', sourceId: 'pump-02', targetId: 'conv-01', dependencyStrength: 0.6, type: 'control' },
];
```

This creates a **realistic dependency web** with feedback loops (turbine ↔ generator) and cascade chains (generator → compressor → turbine → heat exchanger → conveyors).

---

## 7. LLM Explanation Layer (Optional / Stretch)

```typescript
// src/core/llm/explanation-service.ts
export class ExplanationService {
  async explain(context: {
    machine: Machine;
    actions: ActionRecommendation[];
    cascadeImpacts: CausalityImpact[];
    costAnalysis: CostAnalysis;
  }): Promise<string> {
    const prompt = `
You are an industrial AI analyst. Given this machine state, explain the situation concisely:

Machine: ${context.machine.name} (${context.machine.type})
Status: ${context.machine.status}
Risk: ${(context.machine.finalRisk * 100).toFixed(1)}%
Temperature: ${context.machine.temperature}°C | Vibration: ${context.machine.vibration} mm/s | Load: ${context.machine.load}%
Time to Failure: ${context.machine.timeToFailure}h
Downstream Impact: ${context.cascadeImpacts.length} machines affected
Estimated Loss: $${context.costAnalysis.futureCost.toLocaleString()}
Recommended Action: ${context.actions[0]?.action || 'MONITOR'}

Provide a 2-3 sentence explanation for an operator. Be clear and actionable.
    `;

    // Call LLM API here (OpenAI, Anthropic, or Gemini)
    // Return explanation string
  }
}
```

---

## 8. Edge Cases & Failure Handling

| Scenario | Handling |
|---|---|
| **Circular dependencies** (A → B → A) | BFS `visited` set prevents infinite loops |
| **All machines fail** | System remains responsive; all show FAILED status |
| **Rapid-fire events** | Events processed synchronously — no race conditions |
| **SSE client disconnect** | `cancel()` handler removes from set; `try/catch` on broadcast |
| **Negative sensor values** | `clamp()` utility enforces min/max bounds |
| **Risk > 1.0** | `Math.min(risk, 1.0)` everywhere |
| **Missing machine ID** | 404 response with clear error message |
| **Serverless cold start** | `ensureInitialized()` re-seeds state if store is empty |
| **Large tick bursts** | Capped at 50 ticks per API call |

---

## 9. Performance Considerations

| Aspect | Decision |
|---|---|
| State lookups | `Map<string, Machine>` — O(1) by ID |
| Graph traversal | Max 8 machines — BFS is trivially fast |
| Risk computation | Pure math — sub-microsecond per machine |
| SSE broadcast | Only sends `machines` array (small payload) |
| Simulation history | Keep last 500 snapshots, then circular buffer |
| Event log | Keep last 1000 events |

---

## 10. Hour-by-Hour Execution Plan

### Phase 1 — Foundation (Hours 0–5) ⚡ CRITICAL

| Hour | Task | Output |
|---|---|---|
| 0–1 | Next.js project init, folder structure, TypeScript config, all data models | Compilable skeleton |
| 1–2 | Global store singleton, machine store, seed data, `ensureInitialized()` | State engine working |
| 2–3 | `GET /api/machines`, `GET /api/machines/:id` | First API responses |
| 3–4 | Event ingestion service, `POST /api/events/inject` | Events flow into system |
| 4–5 | Rule engine + ML model + risk fusion | Hybrid risk scores computing |

**✅ Milestone: Can inject events and see risk scores update via API.**

---

### Phase 2 — Intelligence (Hours 5–10) ⚡ CRITICAL

| Hour | Task | Output |
|---|---|---|
| 5–6 | Prediction Agent + Agent Orchestrator skeleton | Full prediction pipeline |
| 6–7 | Graph store + Causality Agent (BFS propagation) | Cascading risk propagation |
| 7–8 | Cost Agent + Action Agent | Financial impact + recommendations |
| 8–9 | Full orchestrator pipeline integration + testing | End-to-end: event → prediction → cascade → cost → action |
| 9–10 | `POST /api/machines/:id/fix`, fix logic, action tracking | Fix/repair flow working |

**✅ Milestone: Full AI pipeline operational. Inject event → see cascading impacts + cost + recommended actions.**

---

### Phase 3 — Simulation (Hours 10–16) ⚡ CRITICAL

| Hour | Task | Output |
|---|---|---|
| 10–11 | Simulation engine skeleton, tick logic, sensor drift | Time advances |
| 11–12 | Event queue system, scheduled events | Delayed cascade events |
| 12–13 | Cascade scheduling from simulation (failure → downstream delays) | Chain reactions over time |
| 13–14 | `POST /api/simulate/tick` (single + batch ticks) | Simulation controllable via API |
| 14–15 | Simulation snapshot history, state recording | Playback data |
| 15–16 | Integration testing — full simulation scenario | All systems working together |

**✅ Milestone: Run 50-tick simulation, see machines degrade, cascade, and fail over time. Fix works.**

---

### Phase 4 — Real-Time & Polish (Hours 16–20) 🔶 IMPORTANT

| Hour | Task | Output |
|---|---|---|
| 16–17 | SSE manager, `GET /api/stream`, broadcast function | Real-time data streaming |
| 17–18 | `GET /api/insights` analytics endpoint | Dashboard-ready data |
| 18–19 | Auto-simulation mode (optional interval-based ticking) | Simulation runs autonomously |
| 19–20 | Error handling pass, edge cases, input validation | Production-hardened |

**✅ Milestone: Real-time streaming works. Dashboard insights available. System is robust.**

---

### Phase 5 — LLM + Stretch (Hours 20–24) 🔷 OPTIONAL

| Hour | Task | Output |
|---|---|---|
| 20–21 | LLM explanation service integration | Natural language insights |
| 21–22 | Enhanced insights: trend detection, predictions summary | Richer analytics |
| 22–23 | Frontend integration support: CORS, sandbox API contract docs | Frontend team unblocked |
| 23–24 | Load testing, final polish, documentation | Ship-ready |

**✅ Milestone: Complete system with LLM explanations. Demo-ready.**

---

## 11. MVP vs Stretch Goals

### ✅ MVP (Must Have for Demo)

| Feature | Status |
|---|---|
| State engine with 8 machines | Critical |
| Event ingestion + processing | Critical |
| Rule engine + ML model + fusion | Critical |
| Causality graph propagation | Critical |
| Cost agent | Critical |
| Action recommendations | Critical |
| Simulation engine with ticks | Critical |
| Fix/repair action | Critical |
| REST API (all 6 endpoints) | Critical |
| SSE real-time streaming | Critical |
| Seed data (machines + graph) | Critical |

### 🔷 Stretch Goals (Nice to Have)

| Feature | Priority |
|---|---|
| LLM explanation layer | High |
| Auto-running simulation (interval) | Medium |
| Simulation speed control (1x/2x/5x) | Medium |
| Undo/replay simulation history | Low |
| WebSocket upgrade from SSE | Low |
| Persistent storage (Supabase) | Low |
| Authentication | Not needed for hackathon |
| Custom machine creation API | Low |

---

## 12. Frontend Integration Contract

The backend exposes this contract for the PixiJS frontend:

### SSE Event Shapes

```typescript
// On connect
{ type: 'INIT', machines: Machine[], connections: Connection[], simulation: SimulationState }

// On every state change
{ type: 'STATE_UPDATE', tick: number, machines: Machine[], timestamp: number }

// On action generated
{ type: 'ACTION', action: ActionRecommendation }
```

### Machine Position Data

Every `Machine` object includes `position: { x, y }` for direct rendering. Frontend should:
1. Connect to `GET /api/stream` for SSE
2. Render machines at their positions
3. Draw connections between machines (use `connections` array)
4. Color-code by `status`: HEALTHY=green, WARNING=amber, CRITICAL=orange, FAILED=red
5. Call `POST /api/simulate/tick` to advance time
6. Call `POST /api/machines/:id/fix` when user clicks repair

---

## Open Questions

> [!IMPORTANT]
> 1. **ML coefficients approach:** Hardcoded logistic regression vs training a real model with synthetic data. I strongly recommend hardcoded for the hackathon. Confirm?
> 2. **LLM provider:** Which API for the explanation layer? Or skip entirely for MVP?
> 3. **Auto-simulation:** Should the backend auto-tick on an interval, or only tick when the frontend calls `POST /api/simulate/tick`?
> 4. **Machine count:** 8 machines in seed data is optimal for demo (complex enough to show cascades, simple enough to visualize). Good?
> 5. **Deployment:** Vercel Edge Runtime or standard Node.js runtime? Standard Node is safer for SSE.

---

## Verification Plan

### Automated Tests

```bash
# After building, verify with curl commands:
curl http://localhost:3000/api/machines                    # Should return 8 machines
curl http://localhost:3000/api/machines/turb-01            # Should return turbine details
curl -X POST http://localhost:3000/api/events/inject \
  -H "Content-Type: application/json" \
  -d '{"machineId":"turb-01","type":"SENSOR_UPDATE","payload":{"temperature":95,"vibration":8.5,"load":85}}'
# Should return updated machine with high risk

curl -X POST http://localhost:3000/api/simulate/tick \
  -H "Content-Type: application/json" \
  -d '{"count":10}'
# Should show machines degrading over time

curl -X POST http://localhost:3000/api/machines/turb-01/fix
# Should reset turbine to healthy

curl http://localhost:3000/api/insights
# Should return analytics dashboard data
```

### Manual Verification

1. Open SSE stream in browser → verify live updates flow
2. Inject a high-risk event → verify cascade propagation to downstream machines
3. Run 50 simulation ticks → verify progressive degradation
4. Fix a failed machine → verify recovery
5. Check insights endpoint → verify accurate analytics
