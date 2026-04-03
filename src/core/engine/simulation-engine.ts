// src/core/engine/simulation-engine.ts
// Phase 3: Full discrete-event simulation — sensor drift, event queue, cascade scheduling

import type { SimulationSnapshot, SimulationTickResult, ScheduledEvent } from '@/models/simulation';
import type { SystemEvent } from '@/models/event';
import { store } from '@/core/state/store';
import { updateMachine, getAllMachines } from '@/core/state/machine-store';
import { orchestrator } from '@/core/agents/agent-orchestrator';
import { processEvent } from '@/core/engine/event-ingestion';
import { broadcastState } from '@/core/realtime/sse-manager';
import { saveSnapshot } from '@/db/simulation.db';
import { SENSOR_BOUNDS, MAX_SNAPSHOT_HISTORY } from '@/lib/constants';
import { clamp, generateId } from '@/lib/utils';

/**
 * Discrete-event simulation engine.
 * 
 * Each tick:
 * 1. Apply sensor drift (random walk bounded by sensor limits)
 * 2. Process scheduled events from the event queue (fire events at their target tick)
 * 3. Run the agent orchestrator on all machines
 * 4. Check for new failures and schedule cascade events
 * 5. Capture snapshot and persist
 * 6. Broadcast updated state
 */
export class SimulationEngine {
  /**
   * Advance simulation by one tick.
   */
  tick(): SimulationTickResult {
    const sim = store.simulation;
    sim.currentTick++;

    const processedEvents: SystemEvent[] = [];

    // Step 1: Apply sensor drift to all machines
    this.applySensorDrift();

    // Step 2: Process scheduled events that fire at this tick
    const firedEvents = this.processEventQueue(sim.currentTick);
    processedEvents.push(...firedEvents);

    // Step 3: Run agent pipeline on all machines
    const machines = getAllMachines();
    for (const machine of machines) {
      orchestrator.run(machine.id);
    }

    // Step 4: Check for new failures → schedule cascade events
    this.checkForCascades();

    // Step 5: Capture snapshot
    const snapshot = this.captureSnapshot();

    // Store in simulation history (bounded)
    sim.history.push(snapshot);
    if (sim.history.length > MAX_SNAPSHOT_HISTORY) {
      sim.history = sim.history.slice(-MAX_SNAPSHOT_HISTORY);
    }

    // Persist snapshot to Supabase (fire and forget — every 10th tick)
    if (sim.currentTick % 10 === 0) {
      saveSnapshot(snapshot).catch(err => {
        console.error('[simulation] Snapshot persist failed:', err);
      });
    }

    // Step 6: Broadcast state change
    broadcastState();

    return {
      tick: sim.currentTick,
      processedEvents,
      snapshot,
    };
  }

  /**
   * Apply random sensor drift to all machines.
   * Simulates natural degradation over time.
   * 
   * Drift model:
   * - Temperature: ±0.5°C per tick (biased toward rising if above normal)
   * - Vibration: ±0.15 mm/s per tick (biased toward rising if above normal)
   * - Load: ±0.8% per tick (stable around current value)
   * 
   * Machines already in FAILED status drift MORE aggressively.
   */
  private applySensorDrift(): void {
    for (const [id, machine] of store.machines) {
      // Failed machines degrade faster
      const failedMultiplier = machine.status === 'FAILED' ? 2.0 : 1.0;

      // Temperature drift (biased upward when warm)
      const tempBias = machine.temperature > 70 ? 0.2 : -0.1;
      const tempDrift = (Math.random() - 0.45 + tempBias) * 0.5 * failedMultiplier;

      // Vibration drift (biased upward when elevated)
      const vibBias = machine.vibration > 4 ? 0.08 : -0.03;
      const vibDrift = (Math.random() - 0.45 + vibBias) * 0.15 * failedMultiplier;

      // Load drift (relatively stable)
      const loadDrift = (Math.random() - 0.5) * 0.8 * failedMultiplier;

      updateMachine(id, {
        temperature: clamp(
          machine.temperature + tempDrift,
          SENSOR_BOUNDS.temperature.min,
          SENSOR_BOUNDS.temperature.max
        ),
        vibration: clamp(
          machine.vibration + vibDrift,
          SENSOR_BOUNDS.vibration.min,
          SENSOR_BOUNDS.vibration.max
        ),
        load: clamp(
          machine.load + loadDrift,
          SENSOR_BOUNDS.load.min,
          SENSOR_BOUNDS.load.max
        ),
      });
    }
  }

  /**
   * Process all scheduled events that fire at or before the current tick.
   */
  private processEventQueue(currentTick: number): SystemEvent[] {
    const sim = store.simulation;
    const fired: SystemEvent[] = [];
    const remaining: ScheduledEvent[] = [];

    for (const scheduled of sim.eventQueue) {
      if (scheduled.targetTick <= currentTick) {
        processEvent(scheduled.event);
        fired.push(scheduled.event);
      } else {
        remaining.push(scheduled);
      }
    }

    sim.eventQueue = remaining;
    return fired;
  }

  /**
   * Check for machines that have crossed into FAILED status and schedule
   * cascade propagation events for their downstream dependencies.
   */
  private checkForCascades(): void {
    for (const [, machine] of store.machines) {
      if (machine.status !== 'FAILED') continue;

      // Find outgoing connections (downstream machines)
      const outgoing = store.connections.filter(c => c.sourceId === machine.id);

      for (const conn of outgoing) {
        const target = store.machines.get(conn.targetId);
        if (!target || target.status === 'FAILED') continue;

        // Only schedule cascade if no pending cascade exists for this pair
        const alreadyScheduled = store.simulation.eventQueue.some(
          se => se.event.machineId === conn.targetId &&
            se.event.type === 'CASCADE_PROPAGATION' &&
            (se.event.payload as { sourceId?: string })?.sourceId === machine.id
        );

        if (!alreadyScheduled) {
          const cascadeEvent: ScheduledEvent = {
            targetTick: store.simulation.currentTick + 2 + Math.floor(Math.random() * 3),
            event: {
              id: generateId(),
              type: 'CASCADE_PROPAGATION',
              machineId: conn.targetId,
              timestamp: Date.now(),
              payload: {
                sourceId: machine.id,
                impactStrength: conn.dependencyStrength,
              },
              source: 'simulation',
            },
          };
          store.simulation.eventQueue.push(cascadeEvent);
        }
      }
    }
  }

  /**
   * Capture a snapshot of all machine states at the current tick.
   */
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

export const simulationEngine = new SimulationEngine();
