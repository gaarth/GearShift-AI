// src/core/engine/rule-engine.ts
// Phase 2: Full deterministic rule-based risk engine

import type { Machine } from '@/models/machine';

/**
 * Compute deterministic rule-based risk score for a machine.
 * 
 * Uses sensor thresholds with graduated risk contributions:
 * - Temperature: 75–85 → +0.1, 85–95 → +0.25, 95+ → +0.4
 * - Vibration:   4–6 → +0.1,  6–8 → +0.2,  8+ → +0.35
 * - Load:        60–75 → +0.05, 75–90 → +0.15, 90+ → +0.25
 * 
 * Compound multiplier: multiple elevated readings amplify risk exponentially.
 * 
 * @returns Risk score in range [0, 1]
 */
export function computeRuleRisk(machine: Machine): number {
  let risk = 0;

  // ─── Temperature rules ───
  if (machine.temperature > 95) risk += 0.4;
  else if (machine.temperature > 85) risk += 0.25;
  else if (machine.temperature > 75) risk += 0.1;

  // ─── Vibration rules ───
  if (machine.vibration > 8) risk += 0.35;
  else if (machine.vibration > 6) risk += 0.2;
  else if (machine.vibration > 4) risk += 0.1;

  // ─── Load rules ───
  if (machine.load > 90) risk += 0.25;
  else if (machine.load > 75) risk += 0.15;
  else if (machine.load > 60) risk += 0.05;

  // ─── Compound multiplier ───
  // Multiple high readings are exponentially worse than individual ones
  const highCount = [
    machine.temperature > 85,
    machine.vibration > 6,
    machine.load > 75,
  ].filter(Boolean).length;

  if (highCount >= 3) risk *= 1.5;
  else if (highCount >= 2) risk *= 1.2;

  return Math.min(risk, 1.0);
}
