// src/db/actions.db.ts

import { supabase } from './supabase';
import type { ActionRecommendation } from '@/models/action';

/**
 * Insert an action recommendation into Supabase.
 */
export async function insertAction(action: ActionRecommendation): Promise<void> {
  const { error } = await supabase
    .from('actions')
    .insert({
      id: action.id,
      machine_id: action.machineId,
      action: action.action,
      priority: action.priority,
      reason: action.reason,
      estimated_cost: action.estimatedCost,
      estimated_savings: action.estimatedSavings,
      deadline: action.deadline,
      created_at: action.createdAt,
      executed: action.executed,
    });

  if (error) {
    console.error('[actions.db] insertAction error:', error);
  }
}

/**
 * Mark an action as executed.
 */
export async function markActionExecuted(actionId: string): Promise<void> {
  const { error } = await supabase
    .from('actions')
    .update({ executed: true })
    .eq('id', actionId);

  if (error) {
    console.error('[actions.db] markActionExecuted error:', error);
  }
}

/**
 * Fetch pending actions for a machine.
 */
export async function fetchPendingActions(machineId?: string): Promise<ActionRecommendation[]> {
  let query = supabase
    .from('actions')
    .select('*')
    .eq('executed', false)
    .order('created_at', { ascending: false });

  if (machineId) {
    query = query.eq('machine_id', machineId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[actions.db] fetchPendingActions error:', error);
    return [];
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data || []).map((row: any) => ({
    id: row.id,
    machineId: row.machine_id,
    action: row.action,
    priority: row.priority,
    reason: row.reason,
    estimatedCost: row.estimated_cost,
    estimatedSavings: row.estimated_savings,
    deadline: row.deadline,
    createdAt: row.created_at,
    executed: row.executed,
  }));
}
