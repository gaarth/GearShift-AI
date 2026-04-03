// POST /api/machines/[id]/fix — repair a machine
import { ensureInitialized, getMachine } from '@/core/state/machine-store';
import { processEvent } from '@/core/engine/event-ingestion';
import { generateId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureInitialized();

  const { id } = await params;
  const machine = getMachine(id);

  if (!machine) {
    return Response.json({ error: 'Machine not found' }, { status: 404 });
  }

  const previousStatus = machine.status;

  // Process fix event — this handles everything:
  // 1. Logs the event
  // 2. Resets machine to healthy baseline (via applyFix)
  // 3. Marks pending actions as executed
  // 4. Removes pending cascade events
  // 5. Broadcasts state change via SSE
  processEvent({
    id: generateId(),
    type: 'FIX_ACTION',
    machineId: id,
    timestamp: Date.now(),
    payload: { previousStatus },
    source: 'user',
  });

  // Fetch the updated machine state after fix
  const fixed = getMachine(id);

  return Response.json({
    machine: fixed,
    message: `${machine.name} has been repaired.`,
  });
}
