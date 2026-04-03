// GET /api/machines — returns all machines with current state
import { ensureInitialized, getAllMachines } from '@/core/state/machine-store';
import { store } from '@/core/state/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureInitialized();

  const machines = getAllMachines();

  return Response.json({
    machines,
    connections: store.connections,
    simulation: {
      tick: store.simulation.currentTick,
      isRunning: store.simulation.isRunning,
      queuedEvents: store.simulation.eventQueue.length,
    },
  });
}
