// src/models/event.ts

export type EventType =
  | 'SENSOR_UPDATE'
  | 'USER_INJECTED_EVENT'
  | 'ANOMALY'
  | 'FAILURE'
  | 'FIX_ACTION'
  | 'SIMULATION_TICK'
  | 'CASCADE_PROPAGATION';

export type EventSource = 'system' | 'user' | 'simulation' | 'agent';

export interface SystemEvent {
  id: string;
  type: EventType;
  machineId: string;
  timestamp: number;
  payload: Record<string, unknown>;
  source: EventSource;
}
