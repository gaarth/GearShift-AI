// src/core/agents/causality-agent.ts
// Phase 3: Full BFS graph propagation with depth attenuation

import { store } from '@/core/state/store';
import { updateMachine } from '@/core/state/machine-store';
import { getConnectionsFrom } from '@/core/state/graph-store';
import { deriveStatus, estimateTimeToFailure } from '@/core/engine/risk-fusion';
import {
  CASCADE_DEPTH_ATTENUATION,
  CASCADE_NOISE_FLOOR,
  CASCADE_RISK_PROPAGATION_FACTOR,
} from '@/lib/constants';

export interface CausalityImpact {
  machineId: string;
  machineName: string;
  previousRisk: number;
  addedRisk: number;
  newRisk: number;
  depth: number;
  sourceChain: string[];
  connectionType: string;
  dependencyStrength: number;
}

/**
 * Causality Agent — second stage of the multi-agent pipeline.
 * 
 * Propagates risk through the dependency graph using BFS.
 * 
 * Key design decisions:
 * - Depth attenuation (0.7^depth) prevents infinite amplification
 * - Noise floor (< 0.05) stops propagation of negligible risk
 * - Additive with cap — propagated risk adds to existing, never exceeds 1.0
 * - BFS ensures breadth-first (closest machines impacted first)
 * - Visited set prevents circular dependency infinite loops
 */
export class CausalityAgent {
  // Cache last impacts per machine for later access by LLM service
  private lastImpacts: Map<string, CausalityImpact[]> = new Map();

  /**
   * Propagate risk from a source machine through the dependency graph.
   * Only propagates if source machine has meaningful risk (≥ 0.3).
   */
  propagate(sourceMachineId: string): CausalityImpact[] {
    const source = store.machines.get(sourceMachineId);
    if (!source) return [];

    const impacts: CausalityImpact[] = [];

    // Only propagate if source is at meaningful risk
    if (source.finalRisk < 0.3) {
      this.lastImpacts.set(sourceMachineId, []);
      return impacts;
    }

    // BFS through dependency graph
    const visited = new Set<string>([sourceMachineId]);
    const queue: {
      machineId: string;
      incomingRisk: number;
      depth: number;
      sourceChain: string[];
    }[] = [];

    // Seed queue with direct dependents
    const directConnections = getConnectionsFrom(sourceMachineId);
    for (const conn of directConnections) {
      queue.push({
        machineId: conn.targetId,
        incomingRisk: source.finalRisk * conn.dependencyStrength,
        depth: 1,
        sourceChain: [sourceMachineId],
      });
    }

    while (queue.length > 0) {
      const { machineId, incomingRisk, depth, sourceChain } = queue.shift()!;

      if (visited.has(machineId)) continue;
      visited.add(machineId);

      // Attenuate risk with depth (prevents runaway cascades)
      const attenuatedRisk = incomingRisk * Math.pow(CASCADE_DEPTH_ATTENUATION, depth - 1);

      // Below noise floor — stop propagating
      if (attenuatedRisk < CASCADE_NOISE_FLOOR) continue;

      const target = store.machines.get(machineId);
      if (!target) continue;

      // Find the connection to get type
      const connection = directConnections.find(c => c.targetId === machineId)
        || store.connections.find(c => c.targetId === machineId && sourceChain.includes(c.sourceId));

      // Apply propagated risk (additive, capped at 1.0)
      const addedRisk = attenuatedRisk * CASCADE_RISK_PROPAGATION_FACTOR;
      const newRisk = Math.min(1.0, target.finalRisk + addedRisk);

      impacts.push({
        machineId,
        machineName: target.name,
        previousRisk: target.finalRisk,
        addedRisk,
        newRisk,
        depth,
        sourceChain: [...sourceChain],
        connectionType: connection?.type ?? 'unknown',
        dependencyStrength: connection?.dependencyStrength ?? 0,
      });

      // Update target machine state
      updateMachine(machineId, {
        finalRisk: newRisk,
        status: deriveStatus(newRisk),
        timeToFailure: estimateTimeToFailure(newRisk),
      });

      // Continue propagation to next level
      const nextConnections = getConnectionsFrom(machineId);
      for (const conn of nextConnections) {
        if (!visited.has(conn.targetId)) {
          queue.push({
            machineId: conn.targetId,
            incomingRisk: newRisk * conn.dependencyStrength,
            depth: depth + 1,
            sourceChain: [...sourceChain, machineId],
          });
        }
      }
    }

    // Cache for later access
    this.lastImpacts.set(sourceMachineId, impacts);

    return impacts;
  }

  /**
   * Get the last computed impacts for a machine.
   * Used by the LLM explanation service.
   */
  getLastImpacts(machineId: string): CausalityImpact[] {
    return this.lastImpacts.get(machineId) ?? [];
  }
}

export const causalityAgent = new CausalityAgent();
