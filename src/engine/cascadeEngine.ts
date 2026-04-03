/**
 * cascadeEngine.ts
 * Runs every N seconds. Simulates risk aging + failure cascades.
 * Fires the agent pipeline on threshold crossings.
 */
import { useMachineStore } from '../store/machineStore';
import { useSimulationStore } from '../store/simulationStore';
import { useAgentLogStore } from '../store/agentLogStore';
import { useRoiStore } from '../store/roiStore';
import { runAgentPipeline } from './agentPipeline';

// Track which machines we've already piped through the agent (avoid spam)
const pipelineFiredFor = new Set<string>();

export function runCascadeTick() {
  const machineState = useMachineStore.getState();
  const simState     = useSimulationStore.getState();
  const log          = useAgentLogStore.getState().addEntry;
  const roi          = useRoiStore.getState();

  if (simState.mode === 'paused') return;

  const machines = Object.values(machineState.machines);

  machines.forEach((machine) => {
    const ageFactor = machine.age / machine.ratedLife;
    const riskDelta = (Math.random() * 3 + ageFactor * 2) * simState.timeMultiplier;
    let newRisk = Math.min(100, machine.riskScore + riskDelta);

    // Upstream cascade pressure
    machineState.pipes
      .filter((p) => p.to === machine.id)
      .forEach((pipe) => {
        const upstream = machineState.machines[pipe.from];
        if (upstream?.status === 'critical') newRisk = Math.min(100, newRisk + 8);
      });

    machineState.updateMachineRisk(machine.id, newRisk);

    const label = machine.label;

    // Sensor log (sparse)
    if (newRisk > 30 && Math.random() < 0.2) {
      log({
        type: 'sensor', machineId: machine.id,
        message: `[MTR] ${label} — vibration Δ +${(newRisk * 0.3).toFixed(1)} g/s, temp ${(60 + newRisk * 0.4).toFixed(0)}°C`,
      });
    }

    // Prediction log at watch-level
    if (newRisk > 55 && Math.random() < 0.25) {
      log({
        type: 'predict', machineId: machine.id,
        message: `[PRED] ${label} — LSTM model: ${Math.round(newRisk)}% failure probability in 72h`,
      });
    }

    // Fire full agent pipeline on first critical crossing
    const justWentCritical = newRisk >= 90 && !pipelineFiredFor.has(machine.id);
    const justWentWatch    = newRisk >= 70 && newRisk < 90 && !pipelineFiredFor.has(machine.id + '_watch');

    if (justWentCritical) {
      pipelineFiredFor.add(machine.id);
      machineState.updateMachineRootCause(
        machine.id,
        `Bearing wear — temp spike +${(newRisk * 0.3).toFixed(0)}°C, vibration ${(newRisk * 0.08).toFixed(2)} dB above baseline`,
        'Repair Now'
      );
      runAgentPipeline(machine.id);
    } else if (justWentWatch) {
      pipelineFiredFor.add(machine.id + '_watch');
      log({
        type: 'thinking', machineId: machine.id,
        message: `[THINK] ${label} — risk ${Math.round(newRisk)}% crosses watch threshold. Monitoring 2 cycles before escalation.`,
      });
    }

    // Reset flags when repaired
    if (machine.status === 'good' && newRisk < 30) {
      pipelineFiredFor.delete(machine.id);
      pipelineFiredFor.delete(machine.id + '_watch');
    }

    // Passive ROI tick in auto mode
    if (machine.status === 'critical' && simState.mode === 'auto' && Math.random() < 0.08) {
      const mc = Object.values(machine.monthlyCosts).reduce((a, b) => a + b, 0);
      roi.addSaving(Math.round((mc / 30) * (0.4 + Math.random() * 0.6)));
      roi.incrementActions();
    }
  });

  simState.incrementTick();
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startCascadeEngine(intervalMs = 3000) {
  if (intervalId) return;
  intervalId = setInterval(runCascadeTick, intervalMs);
}

export function stopCascadeEngine() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}
