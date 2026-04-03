// src/core/agents/prediction-agent.ts
// Phase 3: Full prediction agent — wraps rule engine + ML model + risk fusion

import type { MachineStatus } from '@/models/machine';
import { store } from '@/core/state/store';
import { updateMachine } from '@/core/state/machine-store';
import { computeRuleRisk } from '@/core/engine/rule-engine';
import { computeMLRisk, computeMLRiskExplained } from '@/core/engine/ml-model';
import type { MLPredictionOutput } from '@/core/engine/ml-model';
import { fuseRisk, estimateTimeToFailure, deriveStatus } from '@/core/engine/risk-fusion';

export interface PredictionResult {
  machineId: string;
  ruleRisk: number;
  mlRisk: number;
  finalRisk: number;
  timeToFailure: number;
  status: MachineStatus;
  mlExplained: MLPredictionOutput | null;
}

/**
 * Prediction Agent — first stage of the multi-agent pipeline.
 * 
 * Responsibilities:
 * 1. Compute rule-based risk (deterministic thresholds)
 * 2. Compute ML-based risk (logistic regression)
 * 3. Fuse both scores into finalRisk
 * 4. Derive status and time-to-failure
 * 5. Update machine state in the store
 * 6. Produce explainable JSON output for high-risk machines
 */
export class PredictionAgent {
  compute(machineId: string): PredictionResult {
    const machine = store.machines.get(machineId);
    if (!machine) {
      return {
        machineId,
        ruleRisk: 0,
        mlRisk: 0,
        finalRisk: 0,
        timeToFailure: 168,
        status: 'HEALTHY',
        mlExplained: null,
      };
    }

    // Compute risk scores
    const ruleRisk = computeRuleRisk(machine);
    const mlRisk = computeMLRisk(machine);
    const finalRisk = fuseRisk(ruleRisk, mlRisk);
    const timeToFailure = estimateTimeToFailure(finalRisk);
    const status = deriveStatus(finalRisk);

    // Generate explainable ML output for machines at meaningful risk
    const mlExplained = finalRisk >= 0.15 ? computeMLRiskExplained(machine) : null;

    // Create sensor snapshot for history
    const snapshot = {
      timestamp: Date.now(),
      temperature: machine.temperature,
      vibration: machine.vibration,
      load: machine.load,
      risk: finalRisk,
    };
    const history = [...machine.history, snapshot].slice(-100);

    // Update machine state
    updateMachine(machineId, {
      ruleRisk,
      mlRisk,
      finalRisk,
      failureProbability: finalRisk,
      timeToFailure,
      status,
      history,
    });

    return { machineId, ruleRisk, mlRisk, finalRisk, timeToFailure, status, mlExplained };
  }
}

export const predictionAgent = new PredictionAgent();
