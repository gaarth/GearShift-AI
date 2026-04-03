// src/core/state/store.ts

import type { Machine } from '@/models/machine';
import type { Connection } from '@/models/connection';
import type { SystemEvent } from '@/models/event';
import type { ActionRecommendation } from '@/models/action';
import type { SimulationState } from '@/models/simulation';

/**
 * Singleton store — survives across requests in same serverless instance.
 * All mutable state lives here. Every module reads/writes through this interface.
 */
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
  sseClients: Set<ReadableStreamDefaultController> = new Set();

  // Initialization flag
  initialized: boolean = false;
}

// Module-level singleton
export const store = new GlobalStore();
