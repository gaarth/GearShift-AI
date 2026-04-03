// src/lib/constants.ts

// ─── Risk Thresholds ───
export const RISK_THRESHOLDS = {
  HEALTHY_MAX: 0.35,
  WARNING_MAX: 0.6,
  CRITICAL_MAX: 0.85,
  // >= CRITICAL_MAX → FAILED
} as const;

// ─── Sensor Thresholds ───
export const TEMPERATURE_THRESHOLDS = {
  NORMAL_MAX: 70,
  WARNING_MAX: 90,
  // > WARNING_MAX → critical
} as const;

export const VIBRATION_THRESHOLDS = {
  NORMAL_MAX: 4,
  WARNING_MAX: 7,
  // > WARNING_MAX → critical
} as const;

export const LOAD_THRESHOLDS = {
  NORMAL_MAX: 60,
  WARNING_MAX: 80,
  // > WARNING_MAX → critical
} as const;

// ─── Risk Fusion Weights ───
export const RULE_WEIGHT = 0.6;
export const ML_WEIGHT = 0.4;

// ─── ML Model Coefficients (Logistic Regression — Trained) ───
// Trained on 2,500 synthetic samples via gradient descent (20k epochs)
// Features are standardized (z-score): (value - mean) / std
export const ML_COEFFICIENTS = {
  intercept: -2.298332,
  temperature: 1.210237,   // standardized (mean=50, std=30)
  vibration: 0.981404,     // standardized (mean=3, std=3)
  load: 1.031794,          // standardized (mean=50, std=25)
} as const;

export const ML_STANDARDIZATION = {
  temperature: { mean: 50, std: 30 },
  vibration: { mean: 3, std: 3 },
  load: { mean: 50, std: 25 },
} as const;

// ─── Cost Constants ───
export const BASE_COSTS: Record<string, number> = {
  pump: 15000,
  compressor: 45000,
  conveyor: 12000,
  generator: 80000,
  turbine: 120000,
  'heat-exchanger': 35000,
};

export const DOWNTIME_COST_PER_HOUR = 5000; // dollars
export const DEGRADATION_RATE = 0.1;        // 10% cost increase per hour delayed

// ─── Simulation ───
export const MAX_TICKS_PER_REQUEST = 50;
export const DEFAULT_TICK_INTERVAL_MS = 1000;
export const DEFAULT_SIMULATION_SPEED = 1;
export const CASCADE_DEPTH_ATTENUATION = 0.7;
export const CASCADE_NOISE_FLOOR = 0.05;
export const CASCADE_RISK_PROPAGATION_FACTOR = 0.5;

// ─── State Limits ───
export const MAX_EVENT_LOG_SIZE = 1000;
export const MAX_SNAPSHOT_HISTORY = 500;

// ─── Sensor Bounds ───
export const SENSOR_BOUNDS = {
  temperature: { min: 20, max: 150 },
  vibration: { min: 0, max: 15 },
  load: { min: 0, max: 100 },
} as const;

// ─── Time to Failure ───
export const MAX_TIME_TO_FAILURE_HOURS = 168; // 1 week
