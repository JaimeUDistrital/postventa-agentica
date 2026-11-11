/**
 * Orquestador del agente (T08). API pública:
 * - `runTurn(request)`: turno con fixtures + puertos mock NUEVOS por turno (el estado vive en
 *   el token firmado, apto para serverless) + planner Gemini o determinista + DEMO_NOW.
 * - `createAgent(deps)`: inyección de dependencias (tests, evals).
 */
import type { AgentRequest, AgentTurn } from "@/core/contracts";
import { DEMO_NOW } from "@/core/config";
import { createMockPorts } from "@/core/adapters/mock";
import { fixtures } from "@/core/data";
import { selectPlanner } from "./llm";
import { createAgent } from "./orchestrator";
import { plannerDeterminista } from "./planner-determinista";
import { resolverSecreto } from "./session";

export { createAgent, type Agent, type AgentDeps } from "./orchestrator";
export { plannerDeterminista } from "./planner-determinista";
export { ConfiguracionError, SesionInvalidaError } from "./session";

export async function runTurn(request: AgentRequest): Promise<AgentTurn> {
  const secret = resolverSecreto(process.env);
  const planner = selectPlanner({ env: process.env, fallback: plannerDeterminista });
  return createAgent({ ports: createMockPorts(fixtures), planner, now: DEMO_NOW, secret }).runTurn(request);
}
