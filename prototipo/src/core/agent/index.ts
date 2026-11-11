/**
 * Orquestador del agente (T08). API pública:
 * - `runTurn(request)`: turno con fixtures + puertos mock NUEVOS por turno (el estado vive en
 *   el token firmado, apto para serverless) + planner Gemini o determinista + DEMO_NOW.
 * - `createAgent(deps)`: inyección de dependencias (tests, evals).
 */
import type { AgentRequest, AgentTurn } from "@/core/contracts";
import type { Planner } from "@/core/ports";
import { DEMO_NOW } from "@/core/config";
import { createMockPorts } from "@/core/adapters/mock";
import { fixtures } from "@/core/data";
import { LIMITES_DEMO, llmHabilitado } from "./acceso";
import { selectPlanner, type GeminiClientLike } from "./llm";
import { createAgent } from "./orchestrator";
import { plannerDeterminista } from "./planner-determinista";
import { resolverSecreto, verificarSesion } from "./session";
import { evento } from "./trace";

export { createAgent, type Agent, type AgentDeps } from "./orchestrator";
export { plannerDeterminista } from "./planner-determinista";
export { ConfiguracionError, SesionInvalidaError } from "./session";

/**
 * Turno con el entorno inyectado (tests). Gemini solo si `llmHabilitado` (ADR 0006); si no, determinista.
 * `client` permite simular Gemini en tests.
 */
export async function runTurnConEntorno(
  request: AgentRequest,
  env: Record<string, string | undefined>,
  client?: GeminiClientLike,
): Promise<AgentTurn> {
  const secret = resolverSecreto(env);
  const acceso = llmHabilitado({ accessCode: request.accessCode, env });
  // Nunca se reenvía el código: se quita de la petición antes de entrar al orquestador.
  const { accessCode: _codigo, ...peticion } = request;

  if (request.tipo !== "inicio" && request.stateToken) {
    const { turnos } = verificarSesion(request.stateToken, {
      secret,
      sessionId: request.sessionId,
      scenarioId: request.scenarioId,
      nowMs: Date.now(),
    });
    if (turnos >= LIMITES_DEMO.maxTurnosSesion) return turnoBloqueadoPorTope(peticion, secret);
  }

  const planner = acceso.habilitado
    ? selectPlanner({ env, fallback: plannerDeterminista, client })
    : plannerDeterminista;
  const turno = await createAgent({ ports: createMockPorts(fixtures), planner, now: DEMO_NOW, secret }).runTurn(peticion);
  if (acceso.habilitado || acceso.motivo === "sin_clave") return turno;
  return {
    ...turno,
    trace: [
      evento({
        kind: "policy",
        agent: "Guardián",
        name: "llm.acceso",
        system: "LLM",
        status: "ok",
        detalle: "Modo determinista: Gemini solo se activa con el código del jurado",
        payload: { modo: "determinista", motivo: acceso.motivo },
      }),
      ...turno.trace,
    ],
  };
}

/** Sin planner ni herramientas: el agente determinista no se invoca con mensaje; solo se reutiliza su envoltorio de turno. */
async function turnoBloqueadoPorTope(request: AgentRequest, secret: string): Promise<AgentTurn> {
  const texto = `La demo alcanzó el límite de ${LIMITES_DEMO.maxTurnosSesion} turnos. Use el botón «Reiniciar».`;
  const sinLlamadas: Planner = {
    mode: "deterministic",
    next: async ({ session }) => ({ step: { kind: "final", text: texto, nextState: session.state, showCards: [] } }),
  };
  // Mensaje vacío: el Guardián no dispara bloqueos ni escalamientos y el planner nulo no llama herramientas.
  const turno = await createAgent({ ports: createMockPorts(fixtures), planner: sinLlamadas, now: DEMO_NOW, secret }).runTurn({
    ...request,
    tipo: "mensaje",
    message: "",
    accion: undefined,
  });
  const { handoff: _h, ...resto } = turno;
  return {
    ...resto,
    reply: { text: texto, cards: [{ type: "bloqueo", motivo: texto }] },
    trace: [
      ...turno.trace.filter((e) => e.kind !== "tool_call" && e.kind !== "tool_result"),
      evento({
        kind: "policy",
        agent: "Guardián",
        name: "limite_turnos",
        system: "Guardián",
        status: "blocked",
        detalle: `Tope de ${LIMITES_DEMO.maxTurnosSesion} turnos por sesión alcanzado: no se llama al planner ni a herramientas.`,
        payload: { maxTurnosSesion: LIMITES_DEMO.maxTurnosSesion },
      }),
    ],
  };
}

export function runTurn(request: AgentRequest): Promise<AgentTurn> {
  return runTurnConEntorno(request, process.env);
}
