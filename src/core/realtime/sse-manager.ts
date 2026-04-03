// src/core/realtime/sse-manager.ts
// Phase 4: Full SSE with encoded messages, heartbeat, and error handling

import { store } from '@/core/state/store';

/**
 * Broadcast current state to all connected SSE clients.
 * Includes machine states, pending actions, and simulation state.
 */
export function broadcastState(): void {
  if (store.sseClients.size === 0) return;

  const machines = Array.from(store.machines.values());
  const pendingActions = store.actions.filter(a => !a.executed);

  const data = JSON.stringify({
    type: 'STATE_UPDATE',
    tick: store.simulation.currentTick,
    machines,
    connections: store.connections,
    actions: pendingActions.slice(0, 10),
    insights: {
      overallHealthScore: Math.round(
        (1 - (machines.length > 0
          ? machines.reduce((s, m) => s + m.finalRisk, 0) / machines.length
          : 0)) * 100
      ),
      statusBreakdown: {
        healthy: machines.filter(m => m.status === 'HEALTHY').length,
        warning: machines.filter(m => m.status === 'WARNING').length,
        critical: machines.filter(m => m.status === 'CRITICAL').length,
        failed: machines.filter(m => m.status === 'FAILED').length,
      },
      totalMachines: machines.length,
      estimatedTotalLoss: pendingActions.reduce((s, a) => s + a.estimatedCost, 0),
    },
    timestamp: Date.now(),
  });

  const message = `data: ${data}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);

  const deadClients: ReadableStreamDefaultController[] = [];

  for (const client of store.sseClients) {
    try {
      client.enqueue(encoded);
    } catch {
      deadClients.push(client);
    }
  }

  // Clean up dead clients
  for (const dead of deadClients) {
    store.sseClients.delete(dead);
  }
}

/**
 * Broadcast a specific event notification (e.g., new action, explanation ready).
 */
export function broadcastEvent(eventType: string, payload: Record<string, unknown>): void {
  if (store.sseClients.size === 0) return;

  const data = JSON.stringify({
    type: eventType,
    ...payload,
    timestamp: Date.now(),
  });

  const message = `data: ${data}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);

  const deadClients: ReadableStreamDefaultController[] = [];

  for (const client of store.sseClients) {
    try {
      client.enqueue(encoded);
    } catch {
      deadClients.push(client);
    }
  }

  for (const dead of deadClients) {
    store.sseClients.delete(dead);
  }
}

/**
 * Get the count of currently connected SSE clients.
 */
export function getClientCount(): number {
  return store.sseClients.size;
}
