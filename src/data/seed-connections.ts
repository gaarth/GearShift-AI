// src/data/seed-connections.ts

import type { Connection } from '@/models/connection';

export const SEED_CONNECTIONS: Connection[] = [
  { id: 'c1', sourceId: 'gen-01',  targetId: 'comp-01', dependencyStrength: 0.9, type: 'power' },
  { id: 'c2', sourceId: 'gen-01',  targetId: 'pump-01', dependencyStrength: 0.8, type: 'power' },
  { id: 'c3', sourceId: 'comp-01', targetId: 'turb-01', dependencyStrength: 0.7, type: 'material' },
  { id: 'c4', sourceId: 'turb-01', targetId: 'gen-01',  dependencyStrength: 0.5, type: 'power' },
  { id: 'c5', sourceId: 'turb-01', targetId: 'hx-01',   dependencyStrength: 0.6, type: 'cooling' },
  { id: 'c6', sourceId: 'pump-01', targetId: 'hx-01',   dependencyStrength: 0.85, type: 'cooling' },
  { id: 'c7', sourceId: 'hx-01',   targetId: 'conv-01', dependencyStrength: 0.4, type: 'cooling' },
  { id: 'c8', sourceId: 'conv-01', targetId: 'conv-02', dependencyStrength: 0.95, type: 'material' },
  { id: 'c9', sourceId: 'pump-02', targetId: 'conv-01', dependencyStrength: 0.6, type: 'control' },
];
