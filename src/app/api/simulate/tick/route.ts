// POST /api/simulate/tick — advance the simulation by N ticks
import { ensureInitialized, getAllMachines } from '@/core/state/machine-store';
import { simulationEngine } from '@/core/engine/simulation-engine';
import { store } from '@/core/state/store';
import { MAX_TICKS_PER_REQUEST } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  await ensureInitialized();

  const body = await request.json().catch(() => ({}));
  const count = Math.min(body.count || 1, MAX_TICKS_PER_REQUEST);

  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(simulationEngine.tick());
  }

  return Response.json({
    ticksProcessed: count,
    currentTick: store.simulation.currentTick,
    results,
    machines: getAllMachines(),
  });
}
