// src/db/machines.db.ts

import { supabase } from './supabase';
import type { Machine } from '@/models/machine';

/**
 * Fetch all machines from Supabase.
 */
export async function fetchAllMachines(): Promise<Machine[]> {
  const { data, error } = await supabase
    .from('machines')
    .select('*');

  if (error) {
    console.error('[machines.db] fetchAllMachines error:', error);
    return [];
  }

  return (data || []).map(mapRowToMachine);
}

/**
 * Fetch a single machine by ID from Supabase.
 */
export async function fetchMachineById(id: string): Promise<Machine | null> {
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapRowToMachine(data);
}

/**
 * Upsert a machine into Supabase.
 */
export async function upsertMachine(machine: Machine): Promise<void> {
  const row = mapMachineToRow(machine);
  const { error } = await supabase
    .from('machines')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[machines.db] upsertMachine error:', error);
  }
}

/**
 * Upsert multiple machines at once.
 */
export async function upsertMachines(machines: Machine[]): Promise<void> {
  const rows = machines.map(mapMachineToRow);
  const { error } = await supabase
    .from('machines')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('[machines.db] upsertMachines error:', error);
  }
}

// ─── Row Mappers ───

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRowToMachine(row: any): Machine {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    temperature: row.temperature,
    vibration: row.vibration,
    load: row.load,
    ruleRisk: row.rule_risk,
    mlRisk: row.ml_risk,
    finalRisk: row.final_risk,
    failureProbability: row.failure_probability,
    timeToFailure: row.time_to_failure,
    connections: row.connections || [],
    position: { x: row.position_x, y: row.position_y },
    lastUpdated: row.last_updated,
    history: [], // History is kept in-memory only for performance
  };
}

function mapMachineToRow(machine: Machine): Record<string, unknown> {
  return {
    id: machine.id,
    name: machine.name,
    type: machine.type,
    status: machine.status,
    temperature: machine.temperature,
    vibration: machine.vibration,
    load: machine.load,
    rule_risk: machine.ruleRisk,
    ml_risk: machine.mlRisk,
    final_risk: machine.finalRisk,
    failure_probability: machine.failureProbability,
    time_to_failure: machine.timeToFailure,
    connections: machine.connections,
    position_x: machine.position.x,
    position_y: machine.position.y,
    last_updated: machine.lastUpdated,
  };
}
