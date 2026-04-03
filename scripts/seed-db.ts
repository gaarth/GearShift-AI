// scripts/seed-db.ts
// Run with: npx tsx scripts/seed-db.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load env from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─── Seed Data ───

const SEED_MACHINES = [
  { id: 'pump-01', name: 'Main Coolant Pump', type: 'pump', status: 'HEALTHY', temperature: 55, vibration: 2.1, load: 45, rule_risk: 0, ml_risk: 0, final_risk: 0, failure_probability: 0, time_to_failure: 168, connections: ['hx-01'], position_x: 200, position_y: 300, last_updated: Date.now() },
  { id: 'comp-01', name: 'Air Compressor Alpha', type: 'compressor', status: 'HEALTHY', temperature: 62, vibration: 3.2, load: 58, rule_risk: 0, ml_risk: 0, final_risk: 0, failure_probability: 0, time_to_failure: 168, connections: ['turb-01'], position_x: 400, position_y: 150, last_updated: Date.now() },
  { id: 'conv-01', name: 'Assembly Line Conveyor', type: 'conveyor', status: 'HEALTHY', temperature: 42, vibration: 1.8, load: 52, rule_risk: 0, ml_risk: 0, final_risk: 0, failure_probability: 0, time_to_failure: 168, connections: ['conv-02'], position_x: 600, position_y: 300, last_updated: Date.now() },
  { id: 'conv-02', name: 'Packaging Conveyor', type: 'conveyor', status: 'HEALTHY', temperature: 40, vibration: 1.5, load: 48, rule_risk: 0, ml_risk: 0, final_risk: 0, failure_probability: 0, time_to_failure: 168, connections: [], position_x: 800, position_y: 300, last_updated: Date.now() },
  { id: 'gen-01', name: 'Backup Generator', type: 'generator', status: 'HEALTHY', temperature: 70, vibration: 3.8, load: 35, rule_risk: 0, ml_risk: 0, final_risk: 0, failure_probability: 0, time_to_failure: 168, connections: ['comp-01', 'pump-01'], position_x: 300, position_y: 500, last_updated: Date.now() },
  { id: 'turb-01', name: 'Steam Turbine', type: 'turbine', status: 'HEALTHY', temperature: 78, vibration: 4.2, load: 65, rule_risk: 0, ml_risk: 0, final_risk: 0, failure_probability: 0, time_to_failure: 168, connections: ['gen-01', 'hx-01'], position_x: 500, position_y: 500, last_updated: Date.now() },
  { id: 'hx-01', name: 'Primary Heat Exchanger', type: 'heat-exchanger', status: 'HEALTHY', temperature: 68, vibration: 2.5, load: 55, rule_risk: 0, ml_risk: 0, final_risk: 0, failure_probability: 0, time_to_failure: 168, connections: ['conv-01'], position_x: 700, position_y: 500, last_updated: Date.now() },
  { id: 'pump-02', name: 'Hydraulic Press Pump', type: 'pump', status: 'HEALTHY', temperature: 58, vibration: 2.8, load: 50, rule_risk: 0, ml_risk: 0, final_risk: 0, failure_probability: 0, time_to_failure: 168, connections: ['conv-01'], position_x: 100, position_y: 500, last_updated: Date.now() },
];

const SEED_CONNECTIONS = [
  { id: 'c1', source_id: 'gen-01', target_id: 'comp-01', dependency_strength: 0.9, type: 'power' },
  { id: 'c2', source_id: 'gen-01', target_id: 'pump-01', dependency_strength: 0.8, type: 'power' },
  { id: 'c3', source_id: 'comp-01', target_id: 'turb-01', dependency_strength: 0.7, type: 'material' },
  { id: 'c4', source_id: 'turb-01', target_id: 'gen-01', dependency_strength: 0.5, type: 'power' },
  { id: 'c5', source_id: 'turb-01', target_id: 'hx-01', dependency_strength: 0.6, type: 'cooling' },
  { id: 'c6', source_id: 'pump-01', target_id: 'hx-01', dependency_strength: 0.85, type: 'cooling' },
  { id: 'c7', source_id: 'hx-01', target_id: 'conv-01', dependency_strength: 0.4, type: 'cooling' },
  { id: 'c8', source_id: 'conv-01', target_id: 'conv-02', dependency_strength: 0.95, type: 'material' },
  { id: 'c9', source_id: 'pump-02', target_id: 'conv-01', dependency_strength: 0.6, type: 'control' },
];

// Simulation state initial row
const SIMULATION_STATE = {
  id: 1,
  is_running: false,
  current_tick: 0,
  tick_interval_ms: 1000,
  speed: 1,
  event_queue: [],
};

async function seed() {
  console.log('🌱 Seeding Supabase...\n');

  // Seed machines
  console.log('  ⚙ Inserting machines...');
  const { error: machineError } = await supabase
    .from('machines')
    .upsert(SEED_MACHINES, { onConflict: 'id' });

  if (machineError) {
    console.error('  ❌ Machine insert failed:', machineError);
  } else {
    console.log(`  ✅ ${SEED_MACHINES.length} machines seeded`);
  }

  // Seed connections
  console.log('  🔗 Inserting connections...');
  const { error: connError } = await supabase
    .from('connections')
    .upsert(SEED_CONNECTIONS, { onConflict: 'id' });

  if (connError) {
    console.error('  ❌ Connection insert failed:', connError);
  } else {
    console.log(`  ✅ ${SEED_CONNECTIONS.length} connections seeded`);
  }

  // Seed simulation state
  console.log('  🔄 Inserting simulation state...');
  const { error: simError } = await supabase
    .from('simulation_state')
    .upsert(SIMULATION_STATE, { onConflict: 'id' });

  if (simError) {
    console.error('  ❌ Simulation state insert failed:', simError);
  } else {
    console.log('  ✅ Simulation state seeded');
  }

  console.log('\n✅ Seeding complete!');
}

seed().catch(console.error);
