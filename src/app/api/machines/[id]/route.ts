// GET /api/machines/[id] — returns a single machine with connections and actions
import { ensureInitialized, getMachine } from '@/core/state/machine-store';
import { store } from '@/core/state/store';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureInitialized();

  const { id } = await params;
  const machine = getMachine(id);

  if (!machine) {
    return Response.json({ error: 'Machine not found' }, { status: 404 });
  }

  const connections = store.connections.filter(
    c => c.sourceId === id || c.targetId === id
  );

  const actions = store.actions.filter(a => a.machineId === id);

  return Response.json({ machine, connections, actions });
}
