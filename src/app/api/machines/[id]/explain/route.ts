// GET /api/machines/[id]/explain — generate LLM explanation for a machine
import { ensureInitialized, getMachine } from '@/core/state/machine-store';
import { orchestrator } from '@/core/agents/agent-orchestrator';
import { explanationService } from '@/core/llm/explanation-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureInitialized();

  const { id } = await params;
  const machine = getMachine(id);

  if (!machine) {
    return Response.json({ error: 'Machine not found' }, { status: 404 });
  }

  // Ensure we have a fresh orchestrator result
  const analysis = orchestrator.run(id);

  // Generate LLM explanation
  const explanation = await explanationService.explain(id);

  return Response.json({
    machineId: id,
    machineName: machine.name,
    status: machine.status,
    finalRisk: machine.finalRisk,
    explanation,
    analysis: {
      prediction: analysis.pipeline.prediction,
      causalityImpacts: analysis.pipeline.causality.length,
      totalCost: analysis.pipeline.cost.totalCost,
      recommendedAction: analysis.pipeline.action?.action ?? null,
      actionPriority: analysis.pipeline.action?.priority ?? null,
    },
    mlExplained: analysis.pipeline.prediction.mlExplained,
  });
}
