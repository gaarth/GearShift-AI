// GET /api/stream — Server-Sent Events (SSE) endpoint for real-time updates
import { ensureInitialized, getAllMachines } from '@/core/state/machine-store';
import { store } from '@/core/state/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureInitialized();

  const stream = new ReadableStream({
    start(controller) {
      // Register this client
      store.sseClients.add(controller);

      // Send initial state (same shape as STATE_UPDATE for consistency)
      const machines = getAllMachines();
      const pendingActions = store.actions.filter(a => !a.executed);

      const data = JSON.stringify({
        type: 'INIT',
        machines,
        connections: store.connections,
        actions: pendingActions.slice(0, 10),
        simulation: {
          isRunning: store.simulation.isRunning,
          currentTick: store.simulation.currentTick,
          speed: store.simulation.speed,
          eventQueueSize: store.simulation.eventQueue.length,
        },
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
        },
        timestamp: Date.now(),
      });

      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    },
    cancel(controller) {
      // Client disconnected — clean up
      store.sseClients.delete(controller);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
