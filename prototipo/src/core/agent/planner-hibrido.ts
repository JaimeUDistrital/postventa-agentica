/**
 * Enrutador híbrido (ADR 0009). El motor de reglas resuelve lo que debe ser exacto: aviso inicial,
 * botones, intenciones conocidas, casos en manos de un asesor y cita confirmada. La IA responde solo
 * lo que las reglas no entienden (`fueraDeReglas`), con guardarraíles:
 * - solo herramientas de consulta (no cotiza, no agenda, no ofrece seguros, no escala por herramienta);
 * - responde en texto: sin tarjetas y sin mover el estado;
 * - solo puede pasar a un humano por síntoma crítico, cliente molesto o no resuelto.
 */
import type { HandoffReason, ToolName } from "@/core/contracts";
import type { Planner, PlannerInput, PlannerResult } from "@/core/ports";
import { fueraDeReglas, plannerDeterminista } from "./planner-determinista";
import { evento } from "./trace";

export interface Ruta {
  ruta: "reglas" | "ia";
  motivo: string;
}

const TOOLS_IA: readonly ToolName[] = ["consultar_contexto_vehiculo"];
/**
 * Sin stock, seguro y adversarial salen de herramientas verificadas, de las reglas o del Guardián;
 * no_resuelto lo decide el motor de reglas (2 mensajes seguidos sin entender, ADR 0008).
 */
const PASES_IA: readonly HandoffReason[] = ["sintoma_critico", "cliente_molesto"];

export function elegirRuta(input: PlannerInput): Ruta {
  const { request, session } = input;
  if (request.tipo === "inicio") return { ruta: "reglas", motivo: "aviso proactivo" };
  if (request.accion) return { ruta: "reglas", motivo: `botón «${request.accion}»` };
  if (!input.maskedMessage.trim()) return { ruta: "reglas", motivo: "mensaje vacío" };
  if (fueraDeReglas(input)) return { ruta: "ia", motivo: "pregunta abierta que las reglas no cubren" };
  const motivo =
    session.state === "HANDOFF"
      ? "caso en manos de un asesor"
      : session.state === "CERRADO"
        ? "cita confirmada"
        : !session.quoteId
          ? "primero la cotización"
          : "intención conocida";
  return { ruta: "reglas", motivo };
}

const eventoRuta = (r: Ruta) =>
  evento({
    kind: "llm",
    agent: "Postventa",
    name: "planner.ruta",
    system: "LLM",
    status: "ok",
    detalle: r.ruta === "ia" ? `Ruta: IA (${r.motivo})` : `Ruta: motor de reglas (${r.motivo})`,
    payload: { ruta: r.ruta, motivo: r.motivo },
  });

const eventoDescarte = (motivo: HandoffReason) =>
  evento({
    kind: "policy",
    agent: "Guardián",
    name: "ia.pase_descartado",
    system: "Guardián",
    status: "blocked",
    detalle: `La IA propuso pasar a un asesor por «${motivo}», que no le corresponde: responde el motor de reglas.`,
    payload: { motivo },
  });

const eventoHerramienta = (tool: ToolName) =>
  evento({
    kind: "policy",
    agent: "Guardián",
    name: "ia.herramienta_descartada",
    system: "Guardián",
    status: "blocked",
    detalle: `La IA propuso «${tool}», que en su ruta no tiene permitida: se descarta.`,
    payload: { tool },
  });

const conTraza = (r: PlannerResult, antes: PlannerResult["trace"] = []): PlannerResult => ({
  ...r,
  trace: [...antes, ...(r.trace ?? [])],
});

export function createPlannerHibrido(ia: Planner, reglas: Planner = plannerDeterminista): Planner {
  return {
    mode: ia.mode,
    ...(ia.model ? { model: ia.model } : {}),
    async next(input) {
      const ruta = elegirRuta(input);
      const traza = input.iteration === 0 ? [eventoRuta(ruta)] : [];
      if (ruta.ruta === "reglas") return conTraza(await reglas.next(input), traza);

      const r = await ia.next({ ...input, allowedTools: input.allowedTools.filter((t) => TOOLS_IA.includes(t)) });
      if (r.step.kind === "tool_calls") {
        // Defensa propia: no depende de que el planner de IA respete la lista reducida.
        const calls = r.step.calls.filter((c) => TOOLS_IA.includes(c.tool));
        const descartes = r.step.calls.filter((c) => !TOOLS_IA.includes(c.tool)).map((c) => eventoHerramienta(c.tool));
        if (calls.length) return conTraza({ ...r, step: { ...r.step, calls } }, [...traza, ...descartes]);
        return conTraza(await reglas.next(input), [...traza, ...(r.trace ?? []), ...descartes]);
      }
      const { handoff } = r.step;
      if (handoff && !PASES_IA.includes(handoff.motivo)) {
        const deReglas = await reglas.next(input);
        return conTraza(deReglas, [...traza, ...(r.trace ?? []), eventoDescarte(handoff.motivo)]);
      }
      return conTraza({ ...r, step: { ...r.step, nextState: input.session.state, showCards: [] } }, traza);
    },
  };
}
