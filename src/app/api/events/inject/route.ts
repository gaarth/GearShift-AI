// POST /api/events/inject — inject a custom event into the system
import { ensureInitialized } from '@/core/state/machine-store';
import { getMachine } from '@/core/state/machine-store';
import { processEvent } from '@/core/engine/event-ingestion';
import { generateId } from '@/lib/utils';
import type { SystemEvent } from '@/models/event';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  await ensureInitialized();

  const body = await request.json();

  if (!body.machineId) {
    return Response.json({ error: 'machineId is required' }, { status: 400 });
  }

  const machine = getMachine(body.machineId);
  if (!machine) {
    return Response.json({ error: 'Machine not found' }, { status: 404 });
  }

  const event: SystemEvent = {
    id: generateId(),
    type: body.type || 'USER_INJECTED_EVENT',
    machineId: body.machineId,
    timestamp: Date.now(),
    payload: body.payload || {},
    source: 'user',
  };

  processEvent(event);

  return Response.json({
    event,
    machineState: getMachine(body.machineId),
  });
}
