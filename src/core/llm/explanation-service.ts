// src/core/llm/explanation-service.ts
// Phase 4: Full Groq LLM integration for operator-grade explanations

import Groq from 'groq-sdk';
import { store } from '@/core/state/store';
import { orchestrator, type OrchestratorResult } from '@/core/agents/agent-orchestrator';
import { getAllMachines } from '@/core/state/machine-store';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS = 512;
const TEMPERATURE = 0.3; // Low temperature for factual, consistent explanations

// ─── Explanation cache (30s TTL) ───
const explanationCache = new Map<string, { text: string; timestamp: number }>();
const CACHE_TTL_MS = 30_000;

// ─── Fleet summary cache (60s TTL) ───
let fleetSummaryCache: { text: string; timestamp: number } | null = null;
const FLEET_CACHE_TTL_MS = 60_000;

/**
 * LLM Explanation Service — uses Groq's llama-3.3-70b-versatile model
 * to generate operator-grade natural language explanations.
 *
 * Features:
 * - Single machine analysis with full context (sensors, risk, cascade, cost, action)
 * - Fleet-wide summarization with trend detection
 * - 30s explanation cache to avoid rate limiting
 * - Graceful fallback to action agent's reason string on failure
 */
export class ExplanationService {
  /**
   * Generate a natural language explanation for a single machine.
   * Uses the full orchestrator result as context for the LLM.
   */
  async explain(machineId: string): Promise<string> {
    // Check cache first
    const cached = explanationCache.get(machineId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.text;
    }

    const machine = store.machines.get(machineId);
    if (!machine) return 'Machine not found.';

    // Get orchestrator result (may have been computed already)
    let analysis = orchestrator.getLastResult(machineId);
    if (!analysis) {
      analysis = orchestrator.run(machineId);
    }

    const prompt = this.buildMachinePrompt(analysis);

    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are GearShift AI, an industrial predictive maintenance assistant. You analyze machine sensor data, risk scores, cascade impacts, and cost projections to provide clear, actionable explanations to factory operators. Be concise, factual, and specific. Use plain English — no jargon. Structure your response with: 1) Current Status, 2) Key Concerns, 3) Impact Assessment, 4) Recommended Action. Keep your response under 200 words.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      });

      const text = completion.choices[0]?.message?.content ?? this.fallbackExplanation(analysis);

      // Cache the result
      explanationCache.set(machineId, { text, timestamp: Date.now() });

      return text;
    } catch (err) {
      console.error('[explanation-service] Groq API error:', err);
      return this.fallbackExplanation(analysis);
    }
  }

  /**
   * Generate a fleet-wide summary with trend detection.
   */
  async summarizeFleet(): Promise<string> {
    // Check cache
    if (fleetSummaryCache && Date.now() - fleetSummaryCache.timestamp < FLEET_CACHE_TTL_MS) {
      return fleetSummaryCache.text;
    }

    const machines = getAllMachines();
    const pendingActions = store.actions.filter(a => !a.executed);
    const prompt = this.buildFleetPrompt(machines, pendingActions);

    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are GearShift AI, an industrial fleet health analyst. Summarize the overall state of a factory's machine fleet for a shift supervisor. Be concise and actionable. Highlight the most critical issues first. Include: 1) Fleet Health Overview, 2) Critical Alerts, 3) Trending Concerns, 4) Recommended Priorities. Keep your response under 250 words.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      });

      const text = completion.choices[0]?.message?.content ?? 'Fleet summary unavailable.';

      fleetSummaryCache = { text, timestamp: Date.now() };

      return text;
    } catch (err) {
      console.error('[explanation-service] Groq fleet summary error:', err);
      return this.fallbackFleetSummary(machines);
    }
  }

  /**
   * Clear all caches (useful after major state changes like fixes).
   */
  clearCache(machineId?: string): void {
    if (machineId) {
      explanationCache.delete(machineId);
    } else {
      explanationCache.clear();
    }
    fleetSummaryCache = null;
  }

  // ─── Prompt Builders ───

  private buildMachinePrompt(analysis: OrchestratorResult): string {
    const { prediction, causality, cost, action } = analysis.pipeline;
    const machine = store.machines.get(analysis.machineId);
    if (!machine) return 'No machine data available.';

    const mlExplained = prediction.mlExplained;

    return `Analyze this machine's condition:

MACHINE: ${machine.name} (${machine.type}, ID: ${machine.id})

SENSOR READINGS:
- Temperature: ${machine.temperature.toFixed(1)}°C (normal: 40-70°C)
- Vibration: ${machine.vibration.toFixed(2)} mm/s (normal: 0-4 mm/s)
- Load: ${machine.load.toFixed(1)}% (normal: 0-60%)

RISK ASSESSMENT:
- Rule-based risk: ${(prediction.ruleRisk * 100).toFixed(1)}%
- ML model risk: ${(prediction.mlRisk * 100).toFixed(1)}%
- Final fused risk: ${(prediction.finalRisk * 100).toFixed(1)}%
- Status: ${prediction.status}
- Estimated time to failure: ${prediction.timeToFailure} hours
${mlExplained ? `
ML MODEL DETAILS:
- Temperature contribution: ${mlExplained.featureContributions.temperature.contribution.toFixed(3)} (${mlExplained.featureContributions.temperature.direction})
- Vibration contribution: ${mlExplained.featureContributions.vibration.contribution.toFixed(3)} (${mlExplained.featureContributions.vibration.direction})
- Load contribution: ${mlExplained.featureContributions.load.contribution.toFixed(3)} (${mlExplained.featureContributions.load.direction})
- Risk level: ${mlExplained.prediction.riskLevel}
` : ''}
CASCADE IMPACT: ${causality.length > 0 ? causality.map(c =>
      `${c.machineName} (+${(c.addedRisk * 100).toFixed(1)}% risk via ${c.connectionType}, depth ${c.depth})`
    ).join(', ') : 'No downstream machines affected'}

COST ANALYSIS:
- Direct cost: $${cost.directCost.toLocaleString()}
- Cascade cost: $${cost.cascadeCost.toLocaleString()}
- Total exposure: $${cost.totalCost.toLocaleString()}
- Future cost if delayed: $${cost.futureCost.toLocaleString()}
- Savings if fixed now: $${cost.savingsIfFixedNow.toLocaleString()}

${action ? `RECOMMENDED ACTION: ${action.action} (${action.priority} priority)
Reason: ${action.reason}` : 'No action recommended at this time.'}`;
  }

  private buildFleetPrompt(
    machines: { id: string; name: string; type: string; status: string; finalRisk: number; temperature: number; vibration: number; load: number; timeToFailure: number }[],
    pendingActions: { machineId: string; action: string; priority: string; estimatedCost: number; reason: string }[]
  ): string {
    const totalMachines = machines.length;
    const healthy = machines.filter(m => m.status === 'HEALTHY').length;
    const warning = machines.filter(m => m.status === 'WARNING').length;
    const critical = machines.filter(m => m.status === 'CRITICAL').length;
    const failed = machines.filter(m => m.status === 'FAILED').length;
    const avgRisk = machines.reduce((s, m) => s + m.finalRisk, 0) / totalMachines;
    const topRisks = [...machines].sort((a, b) => b.finalRisk - a.finalRisk).slice(0, 5);

    return `Summarize this factory fleet status:

FLEET OVERVIEW:
- Total machines: ${totalMachines}
- Healthy: ${healthy}, Warning: ${warning}, Critical: ${critical}, Failed: ${failed}
- Average fleet risk: ${(avgRisk * 100).toFixed(1)}%
- Overall health score: ${Math.round((1 - avgRisk) * 100)}%
- Simulation tick: ${store.simulation.currentTick}

TOP 5 HIGHEST RISK MACHINES:
${topRisks.map(m =>
      `- ${m.name} (${m.type}): ${m.status}, risk=${(m.finalRisk * 100).toFixed(1)}%, TTF=${m.timeToFailure}hrs, temp=${m.temperature.toFixed(1)}°C, vib=${m.vibration.toFixed(1)}mm/s`
    ).join('\n')}

PENDING ACTIONS (${pendingActions.length}):
${pendingActions.length > 0
        ? pendingActions.slice(0, 5).map(a =>
          `- ${a.machineId}: ${a.action} (${a.priority}) — $${a.estimatedCost.toLocaleString()}`
        ).join('\n')
        : '- None'}

TOTAL ESTIMATED EXPOSURE: $${pendingActions.reduce((s, a) => s + a.estimatedCost, 0).toLocaleString()}`;
  }

  // ─── Fallback (no LLM) ───

  private fallbackExplanation(analysis: OrchestratorResult): string {
    const { prediction, cost, action } = analysis.pipeline;
    const machine = store.machines.get(analysis.machineId);
    const name = machine?.name ?? analysis.machineId;

    let text = `${name} is currently ${prediction.status} with a risk score of ${(prediction.finalRisk * 100).toFixed(1)}%.`;

    if (prediction.finalRisk >= 0.6) {
      text += ` Estimated time to failure: ${prediction.timeToFailure} hours.`;
      text += ` Total cost exposure: $${cost.totalCost.toLocaleString()}.`;
    }

    if (action) {
      text += ` Recommended action: ${action.action} (${action.priority} priority).`;
      text += ` ${action.reason}`;
    }

    return text;
  }

  private fallbackFleetSummary(machines: { status: string; finalRisk: number }[]): string {
    const total = machines.length;
    const healthy = machines.filter(m => m.status === 'HEALTHY').length;
    const failed = machines.filter(m => m.status === 'FAILED').length;
    const avgRisk = machines.reduce((s, m) => s + m.finalRisk, 0) / total;

    return `Fleet Status: ${healthy}/${total} machines healthy. ${failed} failed. Average risk: ${(avgRisk * 100).toFixed(1)}%. Health score: ${Math.round((1 - avgRisk) * 100)}%.`;
  }
}

export const explanationService = new ExplanationService();
