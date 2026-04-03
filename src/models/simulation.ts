// src/models/simulation.ts

import type { MachineStatus } from './machine';
import type { SystemEvent } from './event';

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
  targetTick: number;
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

export interface SimulationTickResult {
  tick: number;
  processedEvents: SystemEvent[];
  snapshot: SimulationSnapshot;
}
