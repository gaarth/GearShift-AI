// src/core/agents/cost-agent.ts
// Phase 3: Full financial impact modeling

import type { CausalityImpact } from './causality-agent';
import { store } from '@/core/state/store';
import { BASE_COSTS, DOWNTIME_COST_PER_HOUR, DEGRADATION_RATE } from '@/lib/constants';

export interface CostAnalysis {
  machineId: string;
  machineName: string;
  machineType: string;
  directCost: number;
  cascadeCost: number;
  totalCost: number;
  futureCost: number;
  savingsIfFixedNow: number;
  affectedMachineCount: number;
  costBreakdown: {
    replacementCost: number;
    downtimeCostPerHour: number;
    estimatedDowntimeHours: number;
    cascadedMachines: { machineId: string; machineName: string; addedCost: number }[];
  };
}

/**
 * Cost Agent — third stage of the multi-agent pipeline.
 * 
 * Computes financial impact of machine failure:
 * - Direct cost = replacement cost × risk + downtime cost
 * - Cascade cost = sum of downstream machine impacts
 * - Future cost = total cost × (1 + degradation_rate)^hours_delayed
 * - Savings = future cost - current repair cost
 */
export class CostAgent {
  analyze(machineId: string, cascadeImpacts: CausalityImpact[]): CostAnalysis {
    const machine = store.machines.get(machineId);
    if (!machine) {
      return this.emptyCostAnalysis(machineId);
    }

    const baseCost = BASE_COSTS[machine.type] ?? 20000;
    const risk = machine.finalRisk;

    // Direct cost: base replacement cost weighted by risk + projected downtime
    const replacementCost = baseCost * risk;
    const estimatedDowntimeHours = Math.max(1, Math.ceil(risk * 48)); // 1-48 hours
    const downtimeCost = estimatedDowntimeHours * DOWNTIME_COST_PER_HOUR;
    const directCost = replacementCost + downtimeCost;

    // Cascade cost: sum impact on downstream machines
    const cascadedMachines = cascadeImpacts.map(impact => {
      const targetMachine = store.machines.get(impact.machineId);
      const targetBaseCost = targetMachine ? (BASE_COSTS[targetMachine.type] ?? 20000) : 20000;
      const addedCost = targetBaseCost * impact.addedRisk + DOWNTIME_COST_PER_HOUR * Math.ceil(impact.addedRisk * 24);
      return {
        machineId: impact.machineId,
        machineName: impact.machineName,
        addedCost: Math.round(addedCost),
      };
    });

    const cascadeCost = cascadedMachines.reduce((sum, cm) => sum + cm.addedCost, 0);
    const totalCost = Math.round(directCost + cascadeCost);

    // Future cost: what it will cost if we delay (degradation compounds)
    const hoursUntilFailure = machine.timeToFailure;
    const delayMultiplier = Math.pow(1 + DEGRADATION_RATE, Math.max(0, 24 - hoursUntilFailure));
    const futureCost = Math.round(totalCost * delayMultiplier);

    // Savings: how much we save by fixing now instead of waiting
    const repairCostNow = Math.round(baseCost * 0.15); // 15% of base for preventive fix
    const savingsIfFixedNow = Math.max(0, futureCost - repairCostNow);

    return {
      machineId,
      machineName: machine.name,
      machineType: machine.type,
      directCost: Math.round(directCost),
      cascadeCost: Math.round(cascadeCost),
      totalCost,
      futureCost,
      savingsIfFixedNow,
      affectedMachineCount: cascadeImpacts.length,
      costBreakdown: {
        replacementCost: Math.round(replacementCost),
        downtimeCostPerHour: DOWNTIME_COST_PER_HOUR,
        estimatedDowntimeHours,
        cascadedMachines,
      },
    };
  }

  private emptyCostAnalysis(machineId: string): CostAnalysis {
    return {
      machineId,
      machineName: 'Unknown',
      machineType: 'unknown',
      directCost: 0,
      cascadeCost: 0,
      totalCost: 0,
      futureCost: 0,
      savingsIfFixedNow: 0,
      affectedMachineCount: 0,
      costBreakdown: {
        replacementCost: 0,
        downtimeCostPerHour: 0,
        estimatedDowntimeHours: 0,
        cascadedMachines: [],
      },
    };
  }
}

export const costAgent = new CostAgent();
