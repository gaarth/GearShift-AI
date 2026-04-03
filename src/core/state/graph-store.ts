// src/core/state/graph-store.ts
// Phase 3: Graph query utilities for the dependency network

import { store } from './store';
import type { Connection } from '@/models/connection';

/**
 * Get all outgoing connections from a source machine.
 * These are machines that DEPEND on the source (downstream).
 */
export function getConnectionsFrom(sourceId: string): Connection[] {
  return store.connections.filter(c => c.sourceId === sourceId);
}

/**
 * Get all incoming connections to a target machine.
 * These are machines that the target DEPENDS ON (upstream).
 */
export function getConnectionsTo(targetId: string): Connection[] {
  return store.connections.filter(c => c.targetId === targetId);
}

/**
 * Get all directly connected machine IDs (both directions).
 */
export function getNeighbors(machineId: string): string[] {
  const neighbors = new Set<string>();
  for (const c of store.connections) {
    if (c.sourceId === machineId) neighbors.add(c.targetId);
    if (c.targetId === machineId) neighbors.add(c.sourceId);
  }
  return Array.from(neighbors);
}

/**
 * Get the dependency strength between two machines (0 if not connected).
 */
export function getDependencyStrength(sourceId: string, targetId: string): number {
  const conn = store.connections.find(c => c.sourceId === sourceId && c.targetId === targetId);
  return conn?.dependencyStrength ?? 0;
}
