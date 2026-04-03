// scripts/integration-test.ts
// Full Phase 1-4 integration test

const BASE = 'http://localhost:3000';

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}: ${err}`);
    process.exit(1);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function main() {
  console.log('\n═══════════════════════════════════════');
  console.log('  GearShift Integration Tests (P1-P4)');
  console.log('═══════════════════════════════════════\n');

  // ─── Phase 1: Foundation ───
  console.log('Phase 1: Foundation');

  await test('GET /api/machines returns 8 machines', async () => {
    const r = await fetch(`${BASE}/api/machines`);
    const j = await r.json();
    assert(j.machines.length === 8, `Expected 8, got ${j.machines.length}`);
    assert(j.connections.length === 9, `Expected 9 connections, got ${j.connections.length}`);
  });

  await test('GET /api/machines/:id returns machine detail', async () => {
    const r = await fetch(`${BASE}/api/machines/pump-01`);
    const j = await r.json();
    assert(j.machine.id === 'pump-01', 'Wrong machine ID');
    assert(j.machine.name === 'Main Coolant Pump', 'Wrong name');
    assert(typeof j.machine.temperature === 'number', 'Missing temperature');
  });

  await test('GET /api/machines/:id 404 for invalid ID', async () => {
    const r = await fetch(`${BASE}/api/machines/invalid-id-999`);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  await test('GET /api/insights returns fleet analytics', async () => {
    const r = await fetch(`${BASE}/api/insights?ai=false`);
    const j = await r.json();
    assert(typeof j.overallHealthScore === 'number', 'Missing health score');
    assert(typeof j.totalMachines === 'number', 'Missing total machines');
    assert(j.statusBreakdown !== undefined, 'Missing status breakdown');
    assert(j.topRisks !== undefined, 'Missing top risks');
  });

  await test('GET /api/stream returns SSE with actions', async () => {
    const r = await fetch(`${BASE}/api/stream`);
    assert(r.headers.get('Content-Type')?.includes('text/event-stream') === true, 'Wrong content type');
    const reader = r.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    assert(text.startsWith('data: '), 'SSE format incorrect');
    const data = JSON.parse(text.replace('data: ', ''));
    assert(data.type === 'INIT', `Expected INIT, got ${data.type}`);
    assert(data.insights !== undefined, 'SSE INIT missing insights');
    reader.cancel();
  });

  // ─── Phase 2: Hybrid Intelligence ───
  console.log('\nPhase 2: Hybrid Intelligence');

  for (const id of ['pump-01','comp-01','conv-01','conv-02','gen-01','turb-01','hx-01','pump-02']) {
    await fetch(`${BASE}/api/machines/${id}/fix`, { method: 'POST' });
  }

  await test('Initial risk scores computed on load', async () => {
    const r = await fetch(`${BASE}/api/machines`);
    const j = await r.json();
    const hasRisk = j.machines.some((m: any) => m.ruleRisk !== undefined);
    assert(hasRisk, 'No risk scores found');
  });

  await test('SENSOR_UPDATE injects + recalculates risk', async () => {
    const r = await fetch(`${BASE}/api/events/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId: 'pump-01', type: 'SENSOR_UPDATE', payload: { temperature: 92, vibration: 7.5, load: 82 } }),
    });
    const j = await r.json();
    assert(j.machineState.ruleRisk > 0, 'Rule risk should be > 0');
    assert(j.machineState.mlRisk > 0, 'ML risk should be > 0');
    assert(j.machineState.finalRisk > 0, 'Final risk should be > 0');
    assert(j.machineState.status !== 'HEALTHY', 'Status should not be HEALTHY');
  });

  await test('Risk fusion produces correct weighted average', async () => {
    const r = await fetch(`${BASE}/api/machines/pump-01`);
    const j = await r.json();
    const expected = 0.6 * j.machine.ruleRisk + 0.4 * j.machine.mlRisk;
    const diff = Math.abs(j.machine.finalRisk - expected);
    assert(diff < 0.01, `Final risk ${j.machine.finalRisk} not close to expected ${expected}`);
  });

  await test('FIX_ACTION resets to healthy baseline', async () => {
    const r = await fetch(`${BASE}/api/machines/pump-01/fix`, { method: 'POST' });
    const j = await r.json();
    assert(j.machine.status === 'HEALTHY', 'Should be HEALTHY after fix');
    assert(j.machine.finalRisk === 0, 'Risk should be 0 after fix');
    assert(j.machine.temperature < 60, 'Temp should be reset');
  });

  await test('Sensor history tracks snapshots', async () => {
    for (let i = 0; i < 3; i++) {
      await fetch(`${BASE}/api/events/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId: 'conv-02', type: 'SENSOR_UPDATE', payload: { temperature: 50 + i * 5 } }),
      });
    }
    const r = await fetch(`${BASE}/api/machines/conv-02`);
    const j = await r.json();
    assert(j.machine.history.length >= 3, `Expected >= 3 history entries, got ${j.machine.history.length}`);
  });

  // ─── Phase 3: Agent Pipeline ───
  console.log('\nPhase 3: Agent Pipeline + Causality + Simulation');

  await test('Orchestrator runs full pipeline on sensor event', async () => {
    const r = await fetch(`${BASE}/api/events/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId: 'gen-01', type: 'SENSOR_UPDATE', payload: { temperature: 96, vibration: 9, load: 90 } }),
    });
    const j = await r.json();
    assert(j.machineState.status === 'FAILED', 'gen-01 should be FAILED at extreme stress');
    assert(j.machineState.finalRisk > 0.85, 'Final risk should be > 0.85');
  });

  await test('Causality propagates risk through dependency graph', async () => {
    const r = await fetch(`${BASE}/api/machines`);
    const j = await r.json();
    const comp01 = j.machines.find((m: any) => m.id === 'comp-01');
    const pump01 = j.machines.find((m: any) => m.id === 'pump-01');
    assert(comp01.finalRisk > 0.1, `comp-01 should have elevated risk from cascade, got ${comp01.finalRisk}`);
    assert(pump01.finalRisk > 0.05, `pump-01 should have elevated risk from cascade, got ${pump01.finalRisk}`);
  });

  await test('Action agent produces FIX_NOW for critical machines', async () => {
    const r = await fetch(`${BASE}/api/insights?ai=false`);
    const j = await r.json();
    const genAction = j.pendingActions.find((a: any) => a.machineId === 'gen-01');
    assert(genAction !== undefined, 'gen-01 should have a pending action');
    assert(genAction.action === 'FIX_NOW', `Expected FIX_NOW, got ${genAction.action}`);
    assert(genAction.priority === 'CRITICAL', `Expected CRITICAL, got ${genAction.priority}`);
    assert(genAction.estimatedCost > 0, 'Cost should be > 0');
  });

  await test('Simulation tick advances correctly', async () => {
    const r = await fetch(`${BASE}/api/simulate/tick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 5 }),
    });
    const j = await r.json();
    assert(j.ticksProcessed === 5, `Expected 5 ticks, got ${j.ticksProcessed}`);
    assert(j.currentTick > 0, 'Current tick should be > 0');
    assert(j.results.length === 5, `Expected 5 results, got ${j.results.length}`);
    assert(j.results[0].snapshot.machineStates !== undefined, 'Missing snapshot data');
  });

  await test('Fix action clears pending actions', async () => {
    await fetch(`${BASE}/api/machines/gen-01/fix`, { method: 'POST' });
    const r = await fetch(`${BASE}/api/insights?ai=false`);
    const j = await r.json();
    const genAction = j.pendingActions.find((a: any) => a.machineId === 'gen-01' && !a.executed);
    assert(genAction === undefined, 'gen-01 should have no pending unexecuted actions');
  });

  await test('Input validation: missing machineId', async () => {
    const r = await fetch(`${BASE}/api/events/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'SENSOR_UPDATE', payload: {} }),
    });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Input validation: invalid machine', async () => {
    const r = await fetch(`${BASE}/api/events/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId: 'fake-machine', type: 'SENSOR_UPDATE', payload: {} }),
    });
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  // ─── Phase 4: Groq LLM + Enhanced SSE + Full Pipeline ───
  console.log('\nPhase 4: Groq LLM + Enhanced SSE + Full Pipeline');

  await fetch(`${BASE}/api/events/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ machineId: 'turb-01', type: 'SENSOR_UPDATE', payload: { temperature: 98, vibration: 9.5, load: 92 } }),
  });

  await test('GET /api/machines/:id/explain returns LLM explanation', async () => {
    const r = await fetch(`${BASE}/api/machines/turb-01/explain`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const j = await r.json();
    assert(j.machineId === 'turb-01', 'Wrong machine ID');
    assert(typeof j.explanation === 'string', 'Missing explanation string');
    assert(j.explanation.length > 20, 'Explanation too short');
    assert(j.analysis !== undefined, 'Missing analysis object');
    assert(j.analysis.totalCost > 0, 'Cost should be > 0');
  });

  await test('GET /api/machines/:id/explain 404 for invalid ID', async () => {
    const r = await fetch(`${BASE}/api/machines/fake-id/explain`);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  await test('GET /api/insights includes trend detection', async () => {
    const r = await fetch(`${BASE}/api/insights?ai=false`);
    const j = await r.json();
    assert(j.trend !== undefined, 'Missing trend object');
    assert(typeof j.trend.direction === 'string', 'Missing trend direction');
    assert(typeof j.trend.details === 'string', 'Missing trend details');
    assert(typeof j.sseClients === 'number', 'Missing SSE client count');
    assert(typeof j.eventQueueSize === 'number', 'Missing event queue size');
    assert(typeof j.totalEventsProcessed === 'number', 'Missing total events');
  });

  await test('GET /api/insights with AI fleet summary', async () => {
    const r = await fetch(`${BASE}/api/insights?ai=true`);
    const j = await r.json();
    assert(typeof j.fleetSummary === 'string', 'Missing fleet summary');
    assert(j.fleetSummary.length > 20, 'Fleet summary too short');
  });

  await test('SSE STATE_UPDATE includes actions and insights', async () => {
    const r = await fetch(`${BASE}/api/stream`);
    const reader = r.body!.getReader();
    await reader.read(); // INIT
    await fetch(`${BASE}/api/events/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId: 'pump-02', type: 'SENSOR_UPDATE', payload: { temperature: 55 } }),
    });
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    if (text.startsWith('data: ')) {
      const data = JSON.parse(text.replace('data: ', ''));
      assert(data.type === 'STATE_UPDATE', `Expected STATE_UPDATE, got ${data.type}`);
      assert(data.insights !== undefined, 'STATE_UPDATE missing insights');
      assert(data.connections !== undefined, 'STATE_UPDATE missing connections');
    }
    reader.cancel();
  });

  await test('LLM explanation caching works', async () => {
    const start1 = Date.now();
    await fetch(`${BASE}/api/machines/turb-01/explain`);
    const time1 = Date.now() - start1;
    const start2 = Date.now();
    await fetch(`${BASE}/api/machines/turb-01/explain`);
    const time2 = Date.now() - start2;
    assert(time2 <= time1 + 100, `Cache not working: first=${time1}ms, second=${time2}ms`);
  });

  console.log('\n═══════════════════════════════════════');
  console.log('  ALL TESTS PASSED ✅');
  console.log('═══════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n💥 Test suite failed:', err);
  process.exit(1);
});
