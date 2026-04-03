/**
 * agentPipeline.ts — Phase 10/11
 *
 * The AI reasoning engine. Called on cascade tick and when mode = 'auto'.
 * In auto mode: detect → analyze → dispatch workers automatically.
 * Fires thinking-delay log entries to simulate AI deliberation.
 */
import { useMachineStore } from '../store/machineStore';
import { useSimulationStore } from '../store/simulationStore';
import { useAgentLogStore } from '../store/agentLogStore';
import { useRoiStore } from '../store/roiStore';
import { dispatchWorkerToMachine } from './workerDispatcher';

let thinkingTimeout: ReturnType<typeof setTimeout> | null = null;

function log(type: Parameters<ReturnType<typeof useAgentLogStore.getState>['addEntry']>[0]['type'],
             machineId: string | null,
             message: string) {
  useAgentLogStore.getState().addEntry({ type, machineId, message });
}

function delayedLog(
  type: Parameters<ReturnType<typeof useAgentLogStore.getState>['addEntry']>[0]['type'],
  machineId: string | null,
  message: string,
  delayMs: number
) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      log(type, machineId, message);
      resolve();
    }, delayMs);
  });
}

/**
 * Run the full agent reasoning pipeline for a given machine.
 * Fires log entries with delays to feel like the AI is "thinking".
 */
export async function runAgentPipeline(machineId: string): Promise<void> {
  const machine = useMachineStore.getState().machines[machineId];
  if (!machine) return;

  const label = machine.label;
  const risk = Math.round(machine.riskScore);
  const mode = useSimulationStore.getState().mode;

  // Step 1: Detection (immediate)
  log('sensor', machineId, `[DETECT] ${label} — anomaly threshold crossed. Risk: ${risk}%. Escalating...`);

  // Step 2: Thinking (300–500ms delay)
  await delayedLog('thinking', machineId,
    `[THINK] ${label} — cross-referencing sensor matrix. Failure pattern: ${
      risk > 85 ? 'IMMINENT' : risk > 70 ? 'HIGH PROBABILITY' : 'DEVELOPING'
    }. Calculating optimal intervention...`,
    320
  );

  // Step 3: Root Cause (600ms delay)
  const rcaOptions = [
    `bearing cyclic fatigue — load variance ${(risk * 0.4).toFixed(1)}% above SLA`,
    `thermal runaway — junction temp ${(65 + risk * 0.3).toFixed(0)}°C, limit: 80°C`,
    `resonance coupling — 48 Hz upstream interference from CONV`,
    `lubrication degradation — viscosity at ${(100 - risk * 0.5).toFixed(0)}% of spec`,
  ];
  const rca = rcaOptions[Math.floor(Math.random() * rcaOptions.length)];
  await delayedLog('rca', machineId,
    `[RCA] ${label} — root cause identified: ${rca}`,
    600
  );

  // Step 4: Prediction (900ms delay)
  const ttf = Math.max(1, Math.round((100 - risk) * 0.6));
  await delayedLog('predict', machineId,
    `[PRED] ${label} — time-to-failure: ${ttf}h. Confidence: ${Math.min(99, 60 + risk * 0.4).toFixed(0)}%. Downstream impact: ${
      risk > 80 ? 'CRITICAL CHAIN' : 'MODERATE'
    }`,
    900
  );

  // Step 5: Strategy decision (1200ms delay)
  const monthlyCost = Object.values(machine.monthlyCosts).reduce((a, b) => a + b, 0);
  const downtime = Math.round(monthlyCost / 30 * ttf * 0.8);
  const repairCost = Math.round(monthlyCost * 0.15);
  await delayedLog('thinking', machineId,
    `[DECIDE] ${label} — repair cost ₹${repairCost.toLocaleString('en-IN')} vs downtime ₹${downtime.toLocaleString('en-IN')}. ROI ratio: ${(downtime / repairCost).toFixed(1)}x. ✓ ACTION JUSTIFIED`,
    1200
  );

  // Step 6: Action (1500ms delay)
  if (mode === 'auto') {
    // Auto-mode: actually dispatch
    const workerId = dispatchWorkerToMachine(machineId);
    await delayedLog('action', machineId,
      `[AUTO] ${label} — worker ${workerId ?? 'N/A'} dispatched autonomously. Intervention initiated.`,
      1500
    );

    // ROI entry
    const savings = Math.round((monthlyCost / 30) * (0.5 + Math.random() * 0.5));
    setTimeout(() => {
      useRoiStore.getState().addSaving(savings);
      useRoiStore.getState().incrementActions();
      log('roi', machineId,
        `[ROI] Autonomous repair of ${label} — prevented ₹${savings.toLocaleString('en-IN')} in losses`
      );
    }, 2000);
  } else {
    // Manual mode: just recommend
    await delayedLog('action', machineId,
      `[RECOMMEND] ${label} — suggested action: "${machine.recommendedAction ?? 'Repair & Lubricate'}". Awaiting operator approval.`,
      1500
    );
  }
}

/**
 * Scenario: instantly push one random watch/good machine to critical.
 */
export function triggerFailureScenario(): void {
  const machines = Object.values(useMachineStore.getState().machines);
  const target = machines.find((m) => m.status === 'watch') ?? machines.find((m) => m.status === 'good');
  if (!target) return;

  useMachineStore.getState().updateMachineRisk(target.id, 95);
  useMachineStore.getState().updateMachineRootCause(
    target.id,
    'Manual failure trigger — catastrophic bearing collapse detected',
    'Emergency Shutdown + Replace'
  );
  log('sensor', target.id, `[ALARM] ${target.label} — CRITICAL FAILURE TRIGGERED. All sensors RED.`);
  runAgentPipeline(target.id);
}

/**
 * Scenario: cascade from current most-at-risk machine.
 */
export function triggerCascadeScenario(): void {
  const machines = Object.values(useMachineStore.getState().machines);
  const critical = machines.filter((m) => m.status === 'critical' || m.status === 'watch');
  if (critical.length === 0) {
    triggerFailureScenario();
    return;
  }

  const pipes = useMachineStore.getState().pipes;
  log('action', null, '[CASCADE] Cascade propagation initiated — upstream failure spreading...');

  // Elevate downstream machines
  critical.forEach((src) => {
    const downstream = pipes
      .filter((p) => p.from === src.id)
      .map((p) => useMachineStore.getState().machines[p.to])
      .filter(Boolean);

    downstream.forEach((m) => {
      if (!m) return;
      const newRisk = Math.min(100, m.riskScore + 30 + Math.random() * 20);
      useMachineStore.getState().updateMachineRisk(m.id, newRisk);
      setTimeout(() => {
        log('rca', m.id, `[CASCADE] ${m.label} — downstream contamination from ${src.label}. Risk +${Math.round(newRisk - m.riskScore)}%`);
        runAgentPipeline(m.id);
      }, 800);
    });
  });
}

/**
 * Scenario: spike aging on all machines.
 */
export function triggerAgingSpike(): void {
  const machines = Object.values(useMachineStore.getState().machines);
  log('sensor', null, '[AGING] Accelerated aging spike detected across facility — sensor drift pattern.');
  machines.forEach((m) => {
    const newRisk = Math.min(100, m.riskScore + 15 + Math.random() * 20);
    useMachineStore.getState().updateMachineRisk(m.id, newRisk);
  });
}

export { thinkingTimeout };
