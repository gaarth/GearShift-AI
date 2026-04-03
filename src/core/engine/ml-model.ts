// src/core/engine/ml-model.ts
// Phase 2+3: Hardcoded logistic regression with JSON-structured explainable output

import type { Machine } from '@/models/machine';

/**
 * Structured ML prediction output — JSON-serializable for LLM parsing.
 */
export interface MLPredictionOutput {
  machineId: string;
  machineName: string;
  machineType: string;
  model: {
    name: string;
    type: string;
    trainingDataSize: number;
    accuracy: string;
  };
  inputs: {
    temperature: { raw: number; standardized: number; unit: string };
    vibration: { raw: number; standardized: number; unit: string };
    load: { raw: number; standardized: number; unit: string };
  };
  coefficients: {
    intercept: number;
    temperature: number;
    vibration: number;
    load: number;
  };
  computation: {
    linearCombination: number;
    sigmoidOutput: number;
  };
  prediction: {
    failureProbability: number;
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | 'EXTREME';
    confidence: string;
  };
  featureContributions: {
    temperature: { contribution: number; direction: 'increasing_risk' | 'decreasing_risk' | 'neutral' };
    vibration: { contribution: number; direction: 'increasing_risk' | 'decreasing_risk' | 'neutral' };
    load: { contribution: number; direction: 'increasing_risk' | 'decreasing_risk' | 'neutral' };
  };
}

// ─── Trained coefficients ───
const COEFFICIENTS = {
  intercept: -2.298332,
  temperature: 1.210237,
  vibration: 0.981404,
  load: 1.031794,
} as const;

const STANDARDIZATION = {
  temperature: { mean: 50, std: 30 },
  vibration: { mean: 3, std: 3 },
  load: { mean: 50, std: 25 },
} as const;

function sigmoid(x: number): number {
  const clamped = Math.max(-500, Math.min(500, x));
  return 1 / (1 + Math.exp(-clamped));
}

function standardize(value: number, mean: number, std: number): number {
  return (value - mean) / std;
}

function getRiskLevel(probability: number): 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | 'EXTREME' {
  if (probability >= 0.85) return 'EXTREME';
  if (probability >= 0.6) return 'VERY_HIGH';
  if (probability >= 0.35) return 'HIGH';
  if (probability >= 0.15) return 'MODERATE';
  return 'LOW';
}

function getDirection(contribution: number): 'increasing_risk' | 'decreasing_risk' | 'neutral' {
  if (contribution > 0.05) return 'increasing_risk';
  if (contribution < -0.05) return 'decreasing_risk';
  return 'neutral';
}

/**
 * Compute ML-based risk score (simple numeric output).
 * @returns Risk score in range [0, 1]
 */
export function computeMLRisk(machine: Machine): number {
  const tempStd = standardize(machine.temperature, STANDARDIZATION.temperature.mean, STANDARDIZATION.temperature.std);
  const vibStd = standardize(machine.vibration, STANDARDIZATION.vibration.mean, STANDARDIZATION.vibration.std);
  const loadStd = standardize(machine.load, STANDARDIZATION.load.mean, STANDARDIZATION.load.std);

  const z =
    COEFFICIENTS.intercept +
    COEFFICIENTS.temperature * tempStd +
    COEFFICIENTS.vibration * vibStd +
    COEFFICIENTS.load * loadStd;

  return sigmoid(z);
}

/**
 * Compute ML risk with full JSON-structured explainable output.
 * Designed for LLM consumption — every computation step is transparent.
 */
export function computeMLRiskExplained(machine: Machine): MLPredictionOutput {
  const tempStd = standardize(machine.temperature, STANDARDIZATION.temperature.mean, STANDARDIZATION.temperature.std);
  const vibStd = standardize(machine.vibration, STANDARDIZATION.vibration.mean, STANDARDIZATION.vibration.std);
  const loadStd = standardize(machine.load, STANDARDIZATION.load.mean, STANDARDIZATION.load.std);

  const tempContrib = COEFFICIENTS.temperature * tempStd;
  const vibContrib = COEFFICIENTS.vibration * vibStd;
  const loadContrib = COEFFICIENTS.load * loadStd;

  const z = COEFFICIENTS.intercept + tempContrib + vibContrib + loadContrib;
  const probability = sigmoid(z);

  return {
    machineId: machine.id,
    machineName: machine.name,
    machineType: machine.type,
    model: {
      name: 'GearShift-LR-v1',
      type: 'logistic_regression',
      trainingDataSize: 2500,
      accuracy: '~88%',
    },
    inputs: {
      temperature: { raw: machine.temperature, standardized: +tempStd.toFixed(4), unit: '°C' },
      vibration: { raw: machine.vibration, standardized: +vibStd.toFixed(4), unit: 'mm/s' },
      load: { raw: machine.load, standardized: +loadStd.toFixed(4), unit: '%' },
    },
    coefficients: { ...COEFFICIENTS },
    computation: {
      linearCombination: +z.toFixed(6),
      sigmoidOutput: +probability.toFixed(6),
    },
    prediction: {
      failureProbability: +probability.toFixed(6),
      riskLevel: getRiskLevel(probability),
      confidence: probability > 0.8 || probability < 0.2 ? 'high' : 'moderate',
    },
    featureContributions: {
      temperature: { contribution: +tempContrib.toFixed(4), direction: getDirection(tempContrib) },
      vibration: { contribution: +vibContrib.toFixed(4), direction: getDirection(vibContrib) },
      load: { contribution: +loadContrib.toFixed(4), direction: getDirection(loadContrib) },
    },
  };
}
