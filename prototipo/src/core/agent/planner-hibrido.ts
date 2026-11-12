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
import { normalizar } from "./intencion";
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
    detalle: `La IA propuso «${tool}», que en su ruta no tiene permitida o ya usó en este turno: se descarta.`,
    payload: { tool },
  });

/**
 * Duración («cuatro horas», «2 h», «3 días») o precio («$ 200.000», «200 mil pesos», «COP 200.000»)
 * afirmados en texto libre. Falla hacia lo seguro: una cifra legítima del contexto también se reemplaza.
 */
const DATO_NO_VERIFICADO = new RegExp(
  [
    String.raw`\b\d+(?:[.,]\d+)?\s*(?:horas?|hrs?|h|minutos?|mins?|dias?|semanas?)\b`,
    String.raw`\b(?:un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|media|medio)\s+(?:horas?|hrs?|minutos?|dias?|semanas?)\b`,
    String.raw`\$\s?\d`,
    String.raw`\b(?:cop|usd)\s?\$?\s?\d`,
    String.raw`\b\d[\d.,]*\s*(?:mil|millones?)?\s*(?:de\s+)?(?:pesos|cop|usd|dolares)\b`,
  ].join("|"),
);
const TEXTO_SIN_DATO =
  "Ese dato no lo tengo confirmado en el sistema. Puedo mostrarle la cotización, agendar su cita o pasarle con un asesor (escriba «asesor»).";

const eventoDatoNoVerificado = () =>
  evento({
    kind: "policy",
    agent: "Guardián",
    name: "ia.dato_no_verificado",
    system: "Guardián",
    status: "blocked",
    detalle: "La IA afirmó una duración o un precio que no viene de una herramienta: se reemplazó por un texto seguro.",
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

      // Cada consulta, una vez por turno: en vivo Gemini repetía la misma hasta agotar las iteraciones.
      const usadas = new Set(input.toolResults.map((t) => t.tool));
      const permitidas = input.allowedTools.filter((t) => TOOLS_IA.includes(t) && !usadas.has(t));
      const r = await ia.next({ ...input, allowedTools: permitidas });
      // Si la IA falló, ya respondió el motor de reglas (respaldo): su respuesta se respeta tal cual.
      if (r.fallback) return conTraza(r, traza);
      if (r.step.kind === "tool_calls") {
        // Defensa propia: no depende de que el planner de IA respete la lista reducida.
        const calls = r.step.calls.filter((c) => permitidas.includes(c.tool));
        const descartes = r.step.calls.filter((c) => !permitidas.includes(c.tool)).map((c) => eventoHerramienta(c.tool));
        if (calls.length) return conTraza({ ...r, step: { ...r.step, calls } }, [...traza, ...descartes]);
        return conTraza(await reglas.next(input), [...traza, ...(r.trace ?? []), ...descartes]);
      }
      const { handoff } = r.step;
      if (handoff && !PASES_IA.includes(handoff.motivo)) {
        const deReglas = await reglas.next(input);
        return conTraza(deReglas, [...traza, ...(r.trace ?? []), eventoDescarte(handoff.motivo)]);
      }
      // Duraciones y precios solo salen de herramientas verificadas: si la IA los afirma, no se envían.
      const inventado = !handoff && DATO_NO_VERIFICADO.test(normalizar(r.step.text));
      const text = inventado ? TEXTO_SIN_DATO : r.step.text;
      const trace = [...(r.trace ?? []), ...(inventado ? [eventoDatoNoVerificado()] : [])];
      return conTraza({ ...r, trace, step: { ...r.step, text, nextState: input.session.state, showCards: [] } }, traza);
    },
  };
}
