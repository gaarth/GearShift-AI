// src/core/state/machine-store.ts

import { store } from './store';
import type { Machine } from '@/models/machine';
import { SEED_MACHINES } from '@/data/seed-machines';
import { SEED_CONNECTIONS } from '@/data/seed-connections';
import { fetchAllMachines, upsertMachine } from '@/db/machines.db';
import { MAX_TIME_TO_FAILURE_HOURS } from '@/lib/constants';
import { computeRuleRisk } from '@/core/engine/rule-engine';
import { computeMLRisk } from '@/core/engine/ml-model';
import { fuseRisk, estimateTimeToFailure, deriveStatus } from '@/core/engine/risk-fusion';

/**
 * Get a single machine from in-memory cache.
 */
export function getMachine(id: string): Machine | undefined {
  return store.machines.get(id);
}

/**
 * Get all machines from in-memory cache.
 */
export function getAllMachines(): Machine[] {
  return Array.from(store.machines.values());
}

/**
 * Update a machine in the store (partial update).
 * Also triggers async Supabase write.
 */
export function updateMachine(id: string, partial: Partial<Machine>): Machine | null {
  const machine = store.machines.get(id);
  if (!machine) return null;

  const updated: Machine = {
    ...machine,
    ...partial,
    lastUpdated: Date.now(),
  };

  store.machines.set(id, updated);

  // Async dual-write to Supabase (fire and forget)
  upsertMachine(updated).catch(err => {
    console.error('[machine-store] Async Supabase write failed:', err);
  });

  return updated;
}

/**
 * Reset a machine to healthy baseline.
 */
export function resetMachine(id: string): Machine | null {
  return updateMachine(id, {
    temperature: 45 + Math.random() * 10,  // 45-55°C
    vibration: 1.5 + Math.random() * 1.5,  // 1.5-3.0 mm/s
    load: 30 + Math.random() * 15,          // 30-45%
    ruleRisk: 0,
    mlRisk: 0,
    finalRisk: 0,
    failureProbability: 0,
    timeToFailure: MAX_TIME_TO_FAILURE_HOURS,
    status: 'HEALTHY',
  });
}

/**
 * Ensure the store is initialized.
 * Loads from Supabase first; if empty, seeds from defaults.
 * Runs initial risk calculation on all machines after loading.
 */
export async function ensureInitialized(): Promise<void> {
  if (store.initialized) return;

  console.log('[machine-store] Initializing store...');

  // Try to load from Supabase first
  try {
    const dbMachines = await fetchAllMachines();

    if (dbMachines.length > 0) {
      console.log(`[machine-store] Loaded ${dbMachines.length} machines from Supabase`);
      for (const machine of dbMachines) {
        store.machines.set(machine.id, machine);
      }
    } else {
      console.log('[machine-store] No machines in Supabase — seeding from defaults');
      seedFromDefaults();
    }
  } catch (err) {
    console.warn('[machine-store] Supabase fetch failed, seeding from defaults:', err);
    seedFromDefaults();
  }

  // Load connections
  store.connections = [...SEED_CONNECTIONS];

  // Compute initial risk scores for all machines
  // This ensures machines have correct risk values from their initial sensor readings
  computeInitialRisks();

  store.initialized = true;
  console.log(`[machine-store] Store initialized with ${store.machines.size} machines and ${store.connections.length} connections`);
}

/**
 * Seed the in-memory store from hardcoded defaults.
 */
function seedFromDefaults(): void {
  for (const seed of SEED_MACHINES) {
    const machine: Machine = {
      ...seed,
      ruleRisk: 0,
      mlRisk: 0,
      finalRisk: 0,
      failureProbability: 0,
      timeToFailure: MAX_TIME_TO_FAILURE_HOURS,
      lastUpdated: Date.now(),
      history: [],
    };
    store.machines.set(machine.id, machine);
  }
}

/**
 * Compute initial risk scores for all machines based on their current sensor values.
 * This ensures the hybrid intelligence pipeline produces valid scores on first load,
 * rather than having all machines show 0 risk despite elevated sensor readings.
 */
function computeInitialRisks(): void {
  for (const [id, machine] of store.machines) {
    const ruleRisk = computeRuleRisk(machine);
    const mlRisk = computeMLRisk(machine);
    const finalRisk = fuseRisk(ruleRisk, mlRisk);
    const status = deriveStatus(finalRisk);
    const timeToFailure = estimateTimeToFailure(finalRisk);

    // Update in-memory only (no Supabase write on init — we read FROM Supabase)
    store.machines.set(id, {
      ...machine,
      ruleRisk,
      mlRisk,
      finalRisk,
      failureProbability: finalRisk,
      timeToFailure,
      status,
      lastUpdated: Date.now(),
    });
  }

  console.log('[machine-store] Initial risk scores computed for all machines');
}
