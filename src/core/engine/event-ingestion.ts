// src/core/engine/event-ingestion.ts
// Phase 4: Full event processing pipeline with agent orchestrator + LLM explanations

import type { SystemEvent } from '@/models/event';
import type { MachineStatus } from '@/models/machine';
import { store } from '@/core/state/store';
import { updateMachine, getMachine, resetMachine } from '@/core/state/machine-store';
import { computeRuleRisk } from '@/core/engine/rule-engine';
import { computeMLRisk } from '@/core/engine/ml-model';
import { fuseRisk, estimateTimeToFailure, deriveStatus } from '@/core/engine/risk-fusion';
import { orchestrator } from '@/core/agents/agent-orchestrator';
import { explanationService } from '@/core/llm/explanation-service';
import { broadcastState } from '@/core/realtime/sse-manager';
import { insertEvent } from '@/db/events.db';
import { MAX_EVENT_LOG_SIZE, SENSOR_BOUNDS } from '@/lib/constants';
import { clamp } from '@/lib/utils';

/**
 * Process an incoming event through the full ingestion pipeline.
 * 
 * Pipeline:
 * 1. Log event to store (with trimming)
 * 2. Route by event type → update machine state
 * 3. Recalculate risk scores (rule + ML + fusion)
 * 4. Derive status and time-to-failure
 * 5. Broadcast updated state to SSE clients
 */
export function processEvent(event: SystemEvent): void {
  // 1. Log event in-memory
  store.events.push(event);
  if (store.events.length > MAX_EVENT_LOG_SIZE) {
    store.events = store.events.slice(-MAX_EVENT_LOG_SIZE);
  }

  // Persist to Supabase (fire and forget — non-blocking)
  insertEvent(event).catch(err => {
    console.error('[event-ingestion] Supabase event persist failed:', err);
  });

  // 2. Route by event type
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
    case 'CASCADE_PROPAGATION':
      applyCascadePropagation(event);
      break;
    case 'ANOMALY':
    case 'FAILURE':
    case 'SIMULATION_TICK':
      // These events are logged but don't directly modify state
      break;
    default:
      console.warn(`[event-ingestion] Unknown event type: ${event.type}`);
  }

  // 3. Run agent pipeline for the affected machine
  if (event.type !== 'FIX_ACTION') {
    // For state-changing events, run the full agent pipeline:
    // Prediction → Causality → Cost → Action
    if (event.type === 'SENSOR_UPDATE' || event.type === 'USER_INJECTED_EVENT' || event.type === 'CASCADE_PROPAGATION') {
      const result = orchestrator.run(event.machineId);

      // Async LLM explanation for high-risk machines (non-blocking)
      if (result.summary.finalRisk > 0.6) {
        explanationService.explain(event.machineId).catch(err => {
          console.error('[event-ingestion] LLM explanation failed:', err);
        });
      }
    } else {
      // Lightweight recalculation for non-critical events
      recalculateRisk(event.machineId);
    }
  } else {
    // Clear LLM cache for fixed machines
    explanationService.clearCache(event.machineId);
  }

  // 4. Broadcast state change to SSE clients
  broadcastState();
}

/**
 * Apply a sensor update event — overwrites sensor values on the machine.
 */
function applySensorUpdate(event: SystemEvent): void {
  const payload = event.payload as {
    temperature?: number;
    vibration?: number;
    load?: number;
  };

  const machine = getMachine(event.machineId);
  if (!machine) return;

  const updates: Record<string, number> = {};

  if (payload.temperature !== undefined) {
    updates.temperature = clamp(payload.temperature, SENSOR_BOUNDS.temperature.min, SENSOR_BOUNDS.temperature.max);
  }
  if (payload.vibration !== undefined) {
    updates.vibration = clamp(payload.vibration, SENSOR_BOUNDS.vibration.min, SENSOR_BOUNDS.vibration.max);
  }
  if (payload.load !== undefined) {
    updates.load = clamp(payload.load, SENSOR_BOUNDS.load.min, SENSOR_BOUNDS.load.max);
  }

  updateMachine(event.machineId, updates);
}

/**
 * Apply a user-injected event — applies arbitrary effects to a machine.
 * Supports sensor overrides, status forcing, and direct risk injection.
 */
function applyInjectedEvent(event: SystemEvent): void {
  const payload = event.payload as {
    temperature?: number;
    vibration?: number;
    load?: number;
    forceStatus?: string;
    addRisk?: number;
  };

  const machine = getMachine(event.machineId);
  if (!machine) return;

  const updates: Partial<{
    temperature: number;
    vibration: number;
    load: number;
    status: MachineStatus;
    finalRisk: number;
  }> = {};

  // Apply sensor overrides (if provided)
  if (payload.temperature !== undefined) {
    updates.temperature = clamp(payload.temperature, SENSOR_BOUNDS.temperature.min, SENSOR_BOUNDS.temperature.max);
  }
  if (payload.vibration !== undefined) {
    updates.vibration = clamp(payload.vibration, SENSOR_BOUNDS.vibration.min, SENSOR_BOUNDS.vibration.max);
  }
  if (payload.load !== undefined) {
    updates.load = clamp(payload.load, SENSOR_BOUNDS.load.min, SENSOR_BOUNDS.load.max);
  }

  // Apply forced status (if provided)
  if (payload.forceStatus) {
    updates.status = payload.forceStatus as MachineStatus;
  }

  // Apply additive risk (if provided)
  if (payload.addRisk !== undefined && typeof payload.addRisk === 'number') {
    updates.finalRisk = Math.min(1.0, machine.finalRisk + payload.addRisk);
  }

  updateMachine(event.machineId, updates);
}

/**
 * Apply a fix action — reset machine to healthy baseline.
 */
function applyFix(event: SystemEvent): void {
  resetMachine(event.machineId);

  // Mark pending actions for this machine as executed
  store.actions
    .filter(a => a.machineId === event.machineId && !a.executed)
    .forEach(a => { a.executed = true; });

  // Remove pending cascade events targeting this machine
  store.simulation.eventQueue = store.simulation.eventQueue.filter(
    e => e.event.machineId !== event.machineId
  );
}

/**
 * Apply cascade propagation — increase risk on a downstream machine
 * when an upstream machine fails.
 */
function applyCascadePropagation(event: SystemEvent): void {
  const payload = event.payload as {
    sourceId?: string;
    impactStrength?: number;
  };

  const machine = getMachine(event.machineId);
  if (!machine) return;

  const impactStrength = payload.impactStrength ?? 0.5;

  // Cascade adds stress to sensors (increases temperature, vibration, and load)
  const stressMultiplier = impactStrength * 0.3;

  updateMachine(event.machineId, {
    temperature: clamp(
      machine.temperature + machine.temperature * stressMultiplier,
      SENSOR_BOUNDS.temperature.min,
      SENSOR_BOUNDS.temperature.max
    ),
    vibration: clamp(
      machine.vibration + machine.vibration * stressMultiplier * 0.8,
      SENSOR_BOUNDS.vibration.min,
      SENSOR_BOUNDS.vibration.max
    ),
    load: clamp(
      machine.load + machine.load * stressMultiplier * 0.5,
      SENSOR_BOUNDS.load.min,
      SENSOR_BOUNDS.load.max
    ),
  });
}

/**
 * Recalculate risk scores for a machine using the full hybrid intelligence pipeline.
 * 
 * Pipeline:
 * 1. Rule engine → deterministic risk score
 * 2. ML model → logistic regression risk score
 * 3. Risk fusion → weighted combination
 * 4. Derive status + estimate time to failure
 * 5. Add sensor snapshot to history
 */
function recalculateRisk(machineId: string): void {
  const machine = getMachine(machineId);
  if (!machine) return;

  // Compute risk scores
  const ruleRisk = computeRuleRisk(machine);
  const mlRisk = computeMLRisk(machine);
  const finalRisk = fuseRisk(ruleRisk, mlRisk);
  const status = deriveStatus(finalRisk);
  const timeToFailure = estimateTimeToFailure(finalRisk);

  // Create sensor snapshot
  const snapshot = {
    timestamp: Date.now(),
    temperature: machine.temperature,
    vibration: machine.vibration,
    load: machine.load,
    risk: finalRisk,
  };

  // Keep history bounded (last 100 snapshots per machine)
  const history = [...machine.history, snapshot].slice(-100);

  // Update machine with computed risk scores
  updateMachine(machineId, {
    ruleRisk,
    mlRisk,
    finalRisk,
    failureProbability: finalRisk,
    timeToFailure,
    status,
    history,
  });
}
