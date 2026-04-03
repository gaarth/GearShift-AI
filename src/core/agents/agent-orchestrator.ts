// src/core/agents/agent-orchestrator.ts
// Phase 3: Full multi-agent pipeline coordinator

import type { ActionRecommendation } from '@/models/action';
import { predictionAgent } from './prediction-agent';
import type { PredictionResult } from './prediction-agent';
import { causalityAgent } from './causality-agent';
import type { CausalityImpact } from './causality-agent';
import { costAgent } from './cost-agent';
import type { CostAnalysis } from './cost-agent';
import { actionAgent } from './action-agent';
import { store } from '@/core/state/store';

/**
 * Complete pipeline result for a single machine analysis.
 * JSON-structured for LLM consumption and API responses.
 */
export interface OrchestratorResult {
  machineId: string;
  timestamp: number;
  pipeline: {
    prediction: PredictionResult;
    causality: CausalityImpact[];
    cost: CostAnalysis;
    action: ActionRecommendation | null;
  };
  summary: {
    finalRisk: number;
    status: string;
    timeToFailure: number;
    totalCost: number;
    affectedMachines: number;
    recommendedAction: string | null;
    actionPriority: string | null;
  };
}

/**
 * Agent Orchestrator — sequential pipeline coordinator.
 * 
 * Pipeline execution order (critical — each stage feeds the next):
 * 1. Prediction Agent → compute risk scores (rule + ML + fusion)
 * 2. Causality Agent → propagate risk through dependency graph
 * 3. Cost Agent → quantify financial impact (direct + cascade + future)
 * 4. Action Agent → decide what to do (FIX_NOW / SCHEDULE / MONITOR / ESCALATE)
 * 
 * Design decisions:
 * - Sequential execution (not parallel) — each stage depends on previous
 * - Full result object returned for API/LLM consumption
 * - Cached per machine for the LLM explanation service
 */
export class AgentOrchestrator {
  // Cache for LLM service to retrieve latest analysis
  private lastResults: Map<string, OrchestratorResult> = new Map();

  /**
   * Run the full multi-agent pipeline for a single machine.
   */
  run(machineId: string): OrchestratorResult {
    const timestamp = Date.now();

    // Stage 1: Prediction — compute risk scores
    const prediction = predictionAgent.compute(machineId);

    // Stage 2: Causality — propagate risk through dependency graph
    const causality = causalityAgent.propagate(machineId);

    // Stage 3: Cost — quantify financial impact
    const cost = costAgent.analyze(machineId, causality);

    // Stage 4: Action — decide what to do
    const action = actionAgent.decide(machineId, prediction, cost);

    const result: OrchestratorResult = {
      machineId,
      timestamp,
      pipeline: { prediction, causality, cost, action },
      summary: {
        finalRisk: prediction.finalRisk,
        status: prediction.status,
        timeToFailure: prediction.timeToFailure,
        totalCost: cost.totalCost,
        affectedMachines: causality.length,
        recommendedAction: action?.action ?? null,
        actionPriority: action?.priority ?? null,
      },
    };

    // Cache for later retrieval
    this.lastResults.set(machineId, result);

    return result;
  }

  /**
   * Run the pipeline for ALL machines. Returns results sorted by risk (highest first).
   */
  runAll(): OrchestratorResult[] {
    const results: OrchestratorResult[] = [];

    for (const machineId of store.machines.keys()) {
      results.push(this.run(machineId));
    }

    return results.sort((a, b) => b.summary.finalRisk - a.summary.finalRisk);
  }

  /**
   * Get the last computed result for a machine.
   * Used by the LLM explanation service.
   */
  getLastResult(machineId: string): OrchestratorResult | undefined {
    return this.lastResults.get(machineId);
  }
}

export const orchestrator = new AgentOrchestrator();
