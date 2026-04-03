// src/models/connection.ts

export type ConnectionType = 'power' | 'cooling' | 'material' | 'control';

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  dependencyStrength: number;  // 0-1 — how strongly source impacts target
  type: ConnectionType;
}
