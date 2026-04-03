// src/core/agents/action-agent.ts
// Phase 3: Full action decision logic

import type { ActionRecommendation, ActionType, ActionPriority } from '@/models/action';
import type { PredictionResult } from './prediction-agent';
import type { CostAnalysis } from './cost-agent';
import { generateId } from '@/lib/utils';
import { store } from '@/core/state/store';
import { insertAction } from '@/db/actions.db';

/**
 * Action Agent — fourth and final stage of the multi-agent pipeline.
 * 
 * Decision matrix:
 * 
 * | Risk Level    | Cost Threshold | Cascade Impact | Action    |
 * |---------------|----------------|----------------|-----------|
 * | ≥ 0.85        | Any            | Any            | FIX_NOW   |
 * | ≥ 0.60        | > $50K total   | ≥ 2 machines   | FIX_NOW   |
 * | ≥ 0.60        | ≤ $50K total   | < 2 machines   | SCHEDULE  |
 * | ≥ 0.35        | > $25K total   | ≥ 1 machine    | SCHEDULE  |
 * | ≥ 0.35        | ≤ $25K total   | 0 machines     | MONITOR   |
 * | < 0.35        | Any            | ≥ 3 machines   | ESCALATE  |
 * | < 0.35        | Any            | Any            | null      |
 */
export class ActionAgent {
  decide(
    machineId: string,
    prediction: PredictionResult,
    cost: CostAnalysis
  ): ActionRecommendation | null {
    const { finalRisk } = prediction;

    // Below warning threshold — no action unless high cascade impact
    if (finalRisk < 0.35) {
      if (cost.affectedMachineCount >= 3) {
        return this.createAction(machineId, 'ESCALATE', 'MEDIUM', prediction, cost,
          `Machine ${machineId} has low individual risk but impacts ${cost.affectedMachineCount} downstream machines. Escalate for review.`
        );
      }
      return null;
    }

    // FAILED status — immediate fix
    if (finalRisk >= 0.85) {
      return this.createAction(machineId, 'FIX_NOW', 'CRITICAL', prediction, cost,
        `Machine ${machineId} is at critical failure risk (${(finalRisk * 100).toFixed(1)}%). Immediate intervention required. ` +
        `Estimated cost if unaddressed: $${cost.futureCost.toLocaleString()}. ` +
        `Potential savings from immediate fix: $${cost.savingsIfFixedNow.toLocaleString()}.`
      );
    }

    // CRITICAL range — decide based on cost and cascade
    if (finalRisk >= 0.60) {
      if (cost.totalCost > 50000 || cost.affectedMachineCount >= 2) {
        return this.createAction(machineId, 'FIX_NOW', 'HIGH', prediction, cost,
          `Machine ${machineId} is at high risk (${(finalRisk * 100).toFixed(1)}%) with significant financial exposure ($${cost.totalCost.toLocaleString()}) and ${cost.affectedMachineCount} downstream machines at risk.`
        );
      }
      return this.createAction(machineId, 'SCHEDULE', 'HIGH', prediction, cost,
        `Machine ${machineId} is at elevated risk (${(finalRisk * 100).toFixed(1)}%). Schedule maintenance within ${prediction.timeToFailure} hours. ` +
        `Current estimated impact: $${cost.totalCost.toLocaleString()}.`
      );
    }

    // WARNING range
    if (cost.totalCost > 25000 || cost.affectedMachineCount >= 1) {
      return this.createAction(machineId, 'SCHEDULE', 'MEDIUM', prediction, cost,
        `Machine ${machineId} entering warning zone (${(finalRisk * 100).toFixed(1)}%) with downstream exposure. ` +
        `Schedule inspection within ${prediction.timeToFailure} hours.`
      );
    }

    return this.createAction(machineId, 'MONITOR', 'LOW', prediction, cost,
      `Machine ${machineId} showing early warning signs (${(finalRisk * 100).toFixed(1)}%). Continue monitoring sensor trends.`
    );
  }

  private createAction(
    machineId: string,
    action: ActionType,
    priority: ActionPriority,
    prediction: PredictionResult,
    cost: CostAnalysis,
    reason: string
  ): ActionRecommendation {
    // Check if we already have a pending action for this machine with same action type
    const existingAction = store.actions.find(
      a => a.machineId === machineId && a.action === action && !a.executed
    );
    if (existingAction) {
      // Update reason and costs on existing action
      existingAction.reason = reason;
      existingAction.estimatedCost = cost.totalCost;
      existingAction.estimatedSavings = cost.savingsIfFixedNow;
      return existingAction;
    }

    const rec: ActionRecommendation = {
      id: generateId(),
      machineId,
      action,
      priority,
      reason,
      estimatedCost: cost.totalCost,
      estimatedSavings: cost.savingsIfFixedNow,
      deadline: prediction.timeToFailure,
      createdAt: Date.now(),
      executed: false,
    };

    // Add to in-memory store
    store.actions.push(rec);

    // Persist to Supabase (fire and forget)
    insertAction(rec).catch(err => {
      console.error('[action-agent] Supabase persist failed:', err);
    });

    return rec;
  }
}

export const actionAgent = new ActionAgent();
