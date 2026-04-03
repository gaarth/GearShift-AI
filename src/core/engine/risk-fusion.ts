// src/core/engine/risk-fusion.ts
// Phase 2: Weighted risk fusion + status derivation + time-to-failure estimation

import type { MachineStatus } from '@/models/machine';
import {
  RULE_WEIGHT,
  ML_WEIGHT,
  RISK_THRESHOLDS,
  MAX_TIME_TO_FAILURE_HOURS,
} from '@/lib/constants';

/**
 * Fuse rule-based and ML-based risk scores using weighted combination.
 * 
 * Default weights: 60% rule-based, 40% ML-based.
 * The rule engine provides transparent, explainable thresholds while
 * the ML model captures non-linear feature interactions.
 * 
 * @returns Fused risk score in range [0, 1]
 */
export function fuseRisk(ruleRisk: number, mlRisk: number): number {
  const fused = (RULE_WEIGHT * ruleRisk) + (ML_WEIGHT * mlRisk);
  return Math.min(fused, 1.0);
}

/**
 * Estimate time to failure based on final risk score.
 * 
 * Mapping:
 * - Risk 0.0 → 168 hours (1 week)
 * - Risk 0.5 → ~84 hours
 * - Risk 0.95+ → 0 hours (imminent)
 * 
 * Uses linear interpolation capped at 0.
 * 
 * @returns Estimated hours until failure (0 = imminent, 168 = very safe)
 */
export function estimateTimeToFailure(finalRisk: number): number {
  if (finalRisk >= 0.95) return 0;
  return Math.max(0, Math.round(MAX_TIME_TO_FAILURE_HOURS * (1 - finalRisk)));
}

/**
 * Derive machine status from final risk score.
 * 
 * Status bands:
 * - HEALTHY:  [0, 0.35)
 * - WARNING:  [0.35, 0.6)
 * - CRITICAL: [0.6, 0.85)
 * - FAILED:   [0.85, 1.0]
 * 
 * @returns MachineStatus enum value
 */
export function deriveStatus(finalRisk: number): MachineStatus {
  if (finalRisk >= RISK_THRESHOLDS.CRITICAL_MAX) return 'FAILED';
  if (finalRisk >= RISK_THRESHOLDS.WARNING_MAX)  return 'CRITICAL';
  if (finalRisk >= RISK_THRESHOLDS.HEALTHY_MAX)  return 'WARNING';
  return 'HEALTHY';
}
