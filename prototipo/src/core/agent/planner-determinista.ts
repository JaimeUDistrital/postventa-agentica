/**
 * Planner determinista (sin LLM): intención por acción de botón o palabras clave y una
 * secuencia fija de herramientas por intención. Solo PROPONE: la política y el Guardián
 * deciden en el orquestador. Nunca escribe precios ni reservas (usa `showCards`).
 */
import { createHash } from "node:crypto";
import { AgendarBahiaOutput, ConsultarContextoOutput, type ToolName, type ToolResult } from "@/core/contracts";
import type { CardKind, Planner, PlannerInput, PlannerResult, PlannerStep } from "@/core/ports";
import { encodeQuoteId, parseQuoteId, type QuoteParams } from "@/core/tools";
import { detectarIntencion, extraVentaCruzada, type Intencion } from "./intencion";
import { evento } from "./trace";

/** Hasta 60k devuelve el hito exacto (el tarifario los cubre). Por encima, cicla 4 hitos (70k → 30k…). */
export function hitoTarifario(proximoHitoKm: number): number {
  if (proximoHitoKm <= 60_000) return proximoHitoKm;
  const n = Math.max(1, Math.round(proximoHitoKm / 10_000));
  return (((n - 1) % 4) + 1) * 10_000;
}

/** Clave de idempotencia estable por sesión y cotización (reintentos no duplican reservas). */
export const claveIdempotencia = (sessionId: string, quoteId: string): string =>
  `idem-${createHash("sha256").update(`${sessionId}|${quoteId}`).digest("hex").slice(0, 24)}`;

const ultimo = (rs: ToolResult[], tool: ToolName) => rs.filter((r) => r.tool === tool).at(-1);
const llamada = (tool: ToolName, args: unknown, rationale: string): PlannerStep => ({
  kind: "tool_calls",
  rationale,
  calls: [{ id: `det-${tool}`, tool, args }],
});
const final = (
  input: PlannerInput,
  text: string,
  showCards: CardKind[],
  nextState = input.session.state,
  handoff?: Extract<PlannerStep, { kind: "final" }>["handoff"],
): PlannerStep => ({ kind: "final", text, nextState, showCards, ...(handoff ? { handoff } : {}) });

function contexto(input: PlannerInput) {
  const r = ultimo(input.toolResults, "consultar_contexto_vehiculo");
  const p = r?.ok ? ConsultarContextoOutput.safeParse(r.output) : undefined;
  return p?.success ? p.data : input.context;
}

/** Parámetros de cotización: de la cotización de la sesión o del contexto del vehículo. */
function paramsBase(input: PlannerInput): QuoteParams | null {
  const deSesion = input.session.quoteId ? parseQuoteId(input.session.quoteId) : null;
  if (deSesion) return deSesion;
  const ctx = contexto(input);
  return ctx
    ? { vehicleId: input.session.vehicleId, hitoKm: hitoTarifario(ctx.proximoHitoKm), extras: [], descuentoPct: 0 }
    : null;
}

const SIN_PERMISO = "Su caso ya está en manos de un asesor humano, que le contactará en breve.";

/** Pide contexto si falta; si ya se pidió y no llegó, cierra con un texto seguro. */
function necesitaContexto(input: PlannerInput): PlannerStep {
  if (ultimo(input.toolResults, "consultar_contexto_vehiculo"))
    return final(input, "No pude consultar los datos de su vehículo. Un asesor puede ayudarle.", []);
  return llamada("consultar_contexto_vehiculo", { vehicleId: input.session.vehicleId }, "Falta el contexto del vehículo");
}

function cotizar(input: PlannerInput, params: QuoteParams, intencion: Intencion): PlannerStep {
  const allowed = input.allowedTools.includes("verificar_stock_y_precio");
  if (!ultimo(input.toolResults, "verificar_stock_y_precio")) {
    if (!allowed) return final(input, SIN_PERMISO, []);
    return llamada("verificar_stock_y_precio", { ...params }, "Cotizar desde el tarifario con stock real");
  }
  const ctx = contexto(input);
  const cards: CardKind[] = ultimo(input.toolResults, "consultar_contexto_vehiculo")?.ok ? ["alerta_km", "cotizacion"] : ["cotizacion"];
  const conExtras = params.extras.length > 0;
  const texto =
    intencion === "inicio" && ctx
      ? `Hola ${ctx.clienteAlias}, su ${ctx.vehicle.marca} ${ctx.vehicle.modelo} está cerca de su mantenimiento de ${ctx.proximoHitoKm.toLocaleString("es-CO")} km. Le comparto la cotización del tarifario oficial; puede agendar en un clic.`
      : conExtras
        ? "Listo, agregué el paquete a su cotización. Estos son los valores del tarifario oficial."
        : "Esta es su cotización con los valores del tarifario oficial.";
  return final(input, texto, cards, conExtras ? "VENTA_CRUZADA" : "COTIZACION");
}

function agendar(input: PlannerInput, params: QuoteParams, confirmar: boolean): PlannerStep {
  const r = ultimo(input.toolResults, "agendar_bahia_taller");
  if (!r) {
    if (!input.allowedTools.includes("agendar_bahia_taller"))
      return final(input, input.session.state === "CERRADO" ? "Su reserva ya quedó registrada. ¡Le esperamos!" : SIN_PERMISO, []);
    const quoteId = input.session.quoteId ?? encodeQuoteId(params);
    return llamada(
      "agendar_bahia_taller",
      {
        vehicleId: params.vehicleId,
        quoteId,
        preferencia: "valle",
        idempotencyKey: claveIdempotencia(input.session.sessionId, quoteId),
        confirmadoPorCliente: true,
      },
      "El cliente pidió agendar de forma explícita",
    );
  }
  const out = r.ok ? AgendarBahiaOutput.safeParse(r.output) : undefined;
  if (!out?.success) return final(input, "No pude completar la reserva. Un asesor revisará su solicitud.", []);
  const o = out.data;
  if (o.estado === "reservada")
    return confirmar
      ? final(input, "¡Su cita quedó confirmada! Le esperamos en el taller con sus repuestos apartados.", ["reserva"], "CERRADO")
      : final(input, "Le aparté un cupo en horario valle con sus repuestos. ¿Confirma la reserva?", ["reserva"], "CONFIRMACION");
  if (o.estado === "sin_stock")
    return final(
      input,
      "Uno de los repuestos de su mantenimiento está agotado. Le propongo fechas posteriores a su reposición y un asesor le confirmará la cita.",
      ["alternativas"],
      "HANDOFF",
      { motivo: "sin_stock", prioridad: "media", resumen: "Repuesto agotado: agendar tras la reposición" },
    );
  return final(input, "Ese horario ya no está disponible; estas son las franjas libres más cercanas.", ["alternativas"], "CONFIRMACION");
}

function seguros(input: PlannerInput): PlannerStep {
  const r = ultimo(input.toolResults, "cotizar_aliados_seguros");
  if (!r) {
    if (!input.allowedTools.includes("cotizar_aliados_seguros")) return final(input, SIN_PERMISO, []);
    return llamada("cotizar_aliados_seguros", { vehicleId: input.session.vehicleId }, "El cliente pregunta por seguros");
  }
  return final(input, "Estas son las opciones de nuestras aseguradoras aliadas. Usted decide si le interesa alguna.", r.ok ? ["seguro"] : []);
}

export function planificar(input: PlannerInput): PlannerStep {
  const intencion = detectarIntencion(input.request, input.maskedMessage);
  if (intencion === "asesor")
    return final(input, "Con gusto. Un asesor humano revisará su caso y le contactará en breve.", [], "HANDOFF", {
      motivo: "cliente_molesto",
      prioridad: "media",
      resumen: "El cliente pide hablar con un asesor",
    });
  if (intencion === "seguros") return seguros(input);

  const base = paramsBase(input);
  if (intencion === "otro" && input.session.quoteId)
    return final(input, "Puedo ayudarle a agendar, agregar el paquete de desgaste o ver seguros. ¿Qué prefiere?", []);
  if (!base) return necesitaContexto(input);

  switch (intencion) {
    case "venta_cruzada": {
      const extra = extraVentaCruzada(input.maskedMessage);
      const extras = base.extras.includes(extra) ? base.extras : [...base.extras, extra];
      return cotizar(input, { ...base, extras }, intencion);
    }
    case "rechazar_venta_cruzada":
      return base.extras.length > 0
        ? cotizar(input, { ...base, extras: [] }, intencion)
        : final(input, "Entendido, mantenemos solo el mantenimiento. ¿Le agendo la cita?", [], "COTIZACION");
    case "agendar":
    case "confirmar":
      return agendar(input, base, intencion === "confirmar");
    default:
      return cotizar(input, base, intencion);
  }
}

export const plannerDeterminista: Planner = {
  mode: "deterministic",
  next: async (input: PlannerInput): Promise<PlannerResult> => {
    const step = planificar(input);
    const intencion = detectarIntencion(input.request, input.maskedMessage);
    const tools = step.kind === "tool_calls" ? step.calls.map((c) => c.tool) : [];
    return {
      step,
      trace: [
        evento({
          kind: "llm",
          agent: "Postventa",
          name: "planner.determinista",
          system: "LLM",
          status: "ok",
          detalle: `Planner determinista (sin LLM): intención «${intencion}» → ${step.kind === "tool_calls" ? `propone ${tools.join(", ")}` : `respuesta final (${step.nextState})`}`,
          payload: { intencion, iteration: input.iteration, paso: step.kind, tools },
        }),
      ],
    };
  },
};
