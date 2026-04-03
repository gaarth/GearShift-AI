// src/db/events.db.ts

import { supabase } from './supabase';
import type { SystemEvent } from '@/models/event';

/**
 * Insert an event into Supabase.
 */
export async function insertEvent(event: SystemEvent): Promise<void> {
  const { error } = await supabase
    .from('events')
    .insert({
      id: event.id,
      type: event.type,
      machine_id: event.machineId,
      timestamp: event.timestamp,
      payload: event.payload,
      source: event.source,
    });

  if (error) {
    console.error('[events.db] insertEvent error:', error);
  }
}

/**
 * Fetch recent events, optionally filtered by machine ID.
 */
export async function fetchRecentEvents(
  machineId?: string,
  limit: number = 50
): Promise<SystemEvent[]> {
  let query = supabase
    .from('events')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (machineId) {
    query = query.eq('machine_id', machineId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[events.db] fetchRecentEvents error:', error);
    return [];
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data || []).map((row: any) => ({
    id: row.id,
    type: row.type,
    machineId: row.machine_id,
    timestamp: row.timestamp,
    payload: row.payload,
    source: row.source,
  }));
}
