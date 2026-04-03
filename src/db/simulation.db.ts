// src/db/simulation.db.ts

import { supabase } from './supabase';
import type { SimulationSnapshot, SimulationState } from '@/models/simulation';

/**
 * Save a simulation snapshot to Supabase.
 */
export async function saveSnapshot(snapshot: SimulationSnapshot): Promise<void> {
  const { error } = await supabase
    .from('simulation_snapshots')
    .insert({
      tick: snapshot.tick,
      timestamp: snapshot.timestamp,
      machine_states: snapshot.machineStates,
    });

  if (error) {
    console.error('[simulation.db] saveSnapshot error:', error);
  }
}

/**
 * Upsert the singleton simulation state row.
 */
export async function upsertSimulationState(state: SimulationState): Promise<void> {
  const { error } = await supabase
    .from('simulation_state')
    .upsert({
      id: 1,
      is_running: state.isRunning,
      current_tick: state.currentTick,
      tick_interval_ms: state.tickIntervalMs,
      speed: state.speed,
      event_queue: state.eventQueue,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    console.error('[simulation.db] upsertSimulationState error:', error);
  }
}

/**
 * Fetch the simulation state from Supabase.
 */
export async function fetchSimulationState(): Promise<Partial<SimulationState> | null> {
  const { data, error } = await supabase
    .from('simulation_state')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) return null;

  return {
    isRunning: data.is_running,
    currentTick: data.current_tick,
    tickIntervalMs: data.tick_interval_ms,
    speed: data.speed,
    eventQueue: data.event_queue || [],
  };
}
