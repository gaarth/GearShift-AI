// GET /api/insights — enhanced fleet analytics with AI summary and trend detection
import { ensureInitialized, getAllMachines } from '@/core/state/machine-store';
import { store } from '@/core/state/store';
import { explanationService } from '@/core/llm/explanation-service';
import { getClientCount } from '@/core/realtime/sse-manager';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  await ensureInitialized();

  const url = new URL(request.url);
  const includeAI = url.searchParams.get('ai') !== 'false'; // default: include AI summary

  const machines = getAllMachines();
  const pendingActions = store.actions.filter(a => !a.executed);
  const totalRisk = machines.length > 0
    ? machines.reduce((s, m) => s + m.finalRisk, 0) / machines.length
    : 0;

  // Trend detection: compare current vs 10-tick-ago snapshot
  const trend = computeTrend();

  // Fleet AI summary (async, cached — only if requested)
  let fleetSummary: string | null = null;
  if (includeAI) {
    try {
      fleetSummary = await explanationService.summarizeFleet();
    } catch {
      fleetSummary = null;
    }
  }

  const insights = {
    overallHealthScore: Math.round((1 - totalRisk) * 100),
    totalMachines: machines.length,
    statusBreakdown: {
      healthy: machines.filter(m => m.status === 'HEALTHY').length,
      warning: machines.filter(m => m.status === 'WARNING').length,
      critical: machines.filter(m => m.status === 'CRITICAL').length,
      failed: machines.filter(m => m.status === 'FAILED').length,
    },
    topRisks: machines
      .sort((a, b) => b.finalRisk - a.finalRisk)
      .slice(0, 5)
      .map(m => ({
        id: m.id,
        name: m.name,
        risk: m.finalRisk,
        status: m.status,
        timeToFailure: m.timeToFailure,
        temperature: m.temperature,
        vibration: m.vibration,
        load: m.load,
      })),
    pendingActions: pendingActions.slice(0, 10),
    simulationTick: store.simulation.currentTick,
    estimatedTotalLoss: pendingActions.reduce((s, a) => s + a.estimatedCost, 0),
    estimatedTotalSavings: pendingActions.reduce((s, a) => s + a.estimatedSavings, 0),
    trend,
    fleetSummary,
    sseClients: getClientCount(),
    eventQueueSize: store.simulation.eventQueue.length,
    totalEventsProcessed: store.events.length,
  };

  return Response.json(insights);
}

/**
 * Compare current fleet state with the state 10 ticks ago.
 * Returns trend direction and magnitude.
 */
function computeTrend(): {
  direction: 'improving' | 'degrading' | 'stable';
  riskDelta: number;
  failedDelta: number;
  details: string;
} {
  const history = store.simulation.history;
  const currentTick = store.simulation.currentTick;

  if (history.length < 2 || currentTick < 10) {
    return {
      direction: 'stable',
      riskDelta: 0,
      failedDelta: 0,
      details: 'Insufficient simulation history for trend analysis.',
    };
  }

  // Find snapshot from ~10 ticks ago
  const targetTick = currentTick - 10;
  const pastSnapshot = history.find(s => s.tick >= targetTick) ?? history[0];
  const currentSnapshot = history[history.length - 1];

  // Compute average risk delta
  const pastStates = Object.values(pastSnapshot.machineStates);
  const currentStates = Object.values(currentSnapshot.machineStates);

  const pastAvgRisk = pastStates.reduce((s, m) => s + m.finalRisk, 0) / pastStates.length;
  const currentAvgRisk = currentStates.reduce((s, m) => s + m.finalRisk, 0) / currentStates.length;
  const riskDelta = +(currentAvgRisk - pastAvgRisk).toFixed(4);

  const pastFailed = pastStates.filter(m => m.status === 'FAILED').length;
  const currentFailed = currentStates.filter(m => m.status === 'FAILED').length;
  const failedDelta = currentFailed - pastFailed;

  let direction: 'improving' | 'degrading' | 'stable';
  if (riskDelta > 0.02) direction = 'degrading';
  else if (riskDelta < -0.02) direction = 'improving';
  else direction = 'stable';

  const details = direction === 'degrading'
    ? `Fleet risk increased by ${(riskDelta * 100).toFixed(1)}% over the last 10 ticks. ${failedDelta > 0 ? `${failedDelta} additional machine(s) have failed.` : ''}`
    : direction === 'improving'
      ? `Fleet risk decreased by ${(Math.abs(riskDelta) * 100).toFixed(1)}% over the last 10 ticks.`
      : 'Fleet risk is stable over the last 10 ticks.';

  return { direction, riskDelta, failedDelta, details };
}
