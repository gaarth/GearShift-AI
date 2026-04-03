/**
 * workerDispatcher.ts
 * Pure dispatch logic — finds the nearest idle worker in a zone,
 * assigns it to a machine, and starts a repair job.
 * Called by the MachinePanel action buttons and auto-mode engine.
 */
import { useWorkerStore } from '../store/workerStore';
import { useMachineStore } from '../store/machineStore';
import { useRepairStore } from '../store/repairStore';
import { useAgentLogStore } from '../store/agentLogStore';

// Duration (ms) for a full repair — shorter if critical (faster urgency)
const REPAIR_DURATIONS: Record<string, number> = {
  good:     0,       // no repair needed
  watch:    10000,   // 10 seconds
  critical: 6000,    // 6 seconds (urgent!)
  isolated: 0,
};

/**
 * Finds nearest idle/patrolling worker in the same zone and dispatches them.
 * Returns workerId if dispatched, null if no workers available.
 */
export function dispatchWorkerToMachine(machineId: string): string | null {
  const { workers, updateWorkerState } = useWorkerStore.getState();
  const { machines } = useMachineStore.getState();
  const { startRepair } = useRepairStore.getState();
  const { addEntry } = useAgentLogStore.getState();

  const machine = machines[machineId];
  if (!machine) return null;

  // Don't dispatch if already being repaired
  const { jobs } = useRepairStore.getState();
  if (jobs[machineId]) return jobs[machineId].workerId;

  // Find closest available worker in same zone
  const eligible = Object.values(workers).filter(
    (w) => w.zone === machine.zone && (w.state === 'idle' || w.state === 'patrolling')
  );

  if (eligible.length === 0) {
    addEntry({ type: 'action', machineId, message: `⚠ No available workers in Zone ${machine.zone} for ${machine.label}` });
    return null;
  }

  // Pick nearest by euclidean distance
  const nearest = eligible.reduce((best, w) => {
    const dxB = best.position.x - machine.position.x;
    const dyB = best.position.y - machine.position.y;
    const dxW = w.position.x - machine.position.x;
    const dyW = w.position.y - machine.position.y;
    return (dxW * dxW + dyW * dyW) < (dxB * dxB + dyB * dyB) ? w : best;
  });

  const duration = REPAIR_DURATIONS[machine.status] || 8000;

  // Update worker: dispatched → target = machine position
  updateWorkerState(nearest.id, 'dispatched', machine.position, machineId);

  // Register repair job (progress starts at 0, begins when worker arrives)
  startRepair({
    machineId,
    workerId: nearest.id,
    progress: 0,
    startedAt: 0, // will be set when worker arrives (state → 'repairing')
    duration,
  });

  addEntry({
    type: 'action',
    machineId,
    message: `[DISPATCH] Worker ${nearest.id} → ${machine.label} (ETA ~${Math.round(duration / 1000)}s repair)`,
  });

  return nearest.id;
}

/**
 * Returns a worker to patrol after completing a repair.
 */
export function releaseWorker(workerId: string, machineId: string): void {
  const { updateWorkerState, workers } = useWorkerStore.getState();
  const { updateMachineStatus, updateMachineRisk, updateMachineRootCause } = useMachineStore.getState();
  const { finishRepair } = useRepairStore.getState();
  const { addEntry } = useAgentLogStore.getState();

  const worker = workers[workerId];
  if (!worker) return;

  // Send worker back somewhere near center of their zone
  const zoneCenters: Record<string, { x: number; y: number }> = {
    A: { x: 420, y: 325 }, B: { x: 450, y: 325 }, C: { x: 450, y: 325 },
    D: { x: 420, y: 325 }, E: { x: 450, y: 325 },
  };
  const returnTarget = zoneCenters[worker.zone] ?? { x: 450, y: 325 };
  // Jitter so workers don't stack
  returnTarget.x += (Math.random() - 0.5) * 100;
  returnTarget.y += (Math.random() - 0.5) * 80;

  updateWorkerState(workerId, 'returning', returnTarget, undefined);

  // Fix the machine
  updateMachineStatus(machineId, 'good');
  updateMachineRisk(machineId, 15);
  updateMachineRootCause(machineId, null, null);
  finishRepair(machineId);

  addEntry({
    type: 'roi',
    machineId,
    message: `✓ REPAIR COMPLETE — ${machineId.toUpperCase()} restored to GOOD. Worker ${workerId} returning.`,
  });
}
