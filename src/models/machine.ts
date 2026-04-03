// src/models/machine.ts

export type MachineStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'FAILED';

export type MachineType = 'pump' | 'compressor' | 'conveyor' | 'generator' | 'turbine' | 'heat-exchanger';

export interface Machine {
  id: string;
  name: string;
  type: MachineType;
  status: MachineStatus;

  // Sensor readings
  temperature: number;    // °C — normal: 40-70, warning: 70-90, critical: 90+
  vibration: number;      // mm/s — normal: 0-4, warning: 4-7, critical: 7+
  load: number;           // % — normal: 0-60, warning: 60-80, critical: 80+

  // Risk scores (0-1)
  ruleRisk: number;
  mlRisk: number;
  finalRisk: number;

  // Derived
  failureProbability: number;  // 0-1
  timeToFailure: number;       // hours (estimated)

  // Graph
  connections: string[];  // IDs of dependents

  // Position (for frontend rendering)
  position: { x: number; y: number };

  // Metadata
  lastUpdated: number;    // timestamp
  history: SensorSnapshot[];
}

export interface SensorSnapshot {
  timestamp: number;
  temperature: number;
  vibration: number;
  load: number;
  risk: number;
}
