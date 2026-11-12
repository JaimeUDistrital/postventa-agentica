/**
 * Planner determinista (sin LLM): intención por acción de botón o palabras clave y una
 * secuencia fija de herramientas por intención. Solo PROPONE: la política y el Guardián
 * deciden en el orquestador. Nunca escribe precios ni reservas (usa `showCards`).
 */
import { createHash } from "node:crypto";
import {
  AgendarBahiaOutput,
  ConsultarContextoOutput,
  CotizarSegurosOutput,
  VerificarStockOutput,
  type InsuranceOffer,
  type ToolName,
  type ToolResult,
} from "@/core/contracts";
import type { CardKind, Planner, PlannerInput, PlannerResult, PlannerStep } from "@/core/ports";
import { encodeQuoteId, parseQuoteId, type QuoteParams } from "@/core/tools";
import { detectarIntencion, extraVentaCruzada, normalizar, type Intencion } from "./intencion";
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
/** T21: el menú ofrece siempre la salida a una persona; si se repite, el caso pasa a un humano. */
const MENU =
  "Puedo ayudarle a agendar, agregar el paquete de desgaste o ver seguros. ¿Qué prefiere? Si lo desea, escriba «asesor» y le atiende una persona.";
const TEXTO_SEGUROS = "Estas son las opciones de nuestras aseguradoras aliadas. Usted decide si le interesa alguna.";

const ultimoTextoAgente = (input: PlannerInput): string | undefined =>
  input.session.historial.filter((h) => h.rol === "agente").at(-1)?.texto;
const segurosMostrados = (input: PlannerInput): boolean =>
  input.session.historial.some((h) => h.rol === "agente" && h.texto.startsWith(TEXTO_SEGUROS));

/** La 2.ª vez seguida que el agente no entiende, pasa el caso a un humano (no hay bucles). */
const noResuelto = (input: PlannerInput): PlannerStep =>
  final(input, "No logré entender su solicitud. Un asesor humano revisará su conversación y le contactará en breve.", [], "HANDOFF", {
    motivo: "no_resuelto",
    prioridad: "media",
    resumen: "El agente no entendió dos mensajes seguidos del cliente",
  });

/** Con la cita confirmada: no se vuelve a cotizar ni a agendar; los cambios los gestiona una persona. */
function citaCerrada(input: PlannerInput): PlannerStep {
  if (/(cambi|reprogram|mover|cancel|aplaz|otra fecha|otro dia|otra hora)/.test(normalizar(input.maskedMessage)))
    return final(input, "Para cambiar o cancelar su cita le atiende un asesor humano, que le contactará en breve.", [], "HANDOFF", {
      motivo: "no_resuelto",
      prioridad: "media",
      resumen: "El cliente quiere cambiar o cancelar su cita confirmada",
    });
  return final(
    input,
    "Su cita ya está confirmada. Si necesita cambiarla, escriba «cambiar cita»; si prefiere hablar con una persona, escriba «asesor».",
    [],
    "CERRADO",
  );
}

/** Opción de seguro elegida por número, ordinal o nombre; null si el mensaje no elige ninguna. */
function eleccionSeguro(texto: string): number | string | null {
  const t = normalizar(texto);
  const num = /\b(?:opcion|numero|el|la|plan)\s*(?:n[o°º.]?\s*)?([123])\b|^\s*([123])\s*$/.exec(t);
  if (num) return Number(num[1] ?? num[2]);
  const ord = /\b(?:la|el|opcion)\s+(primer|segund|tercer)[oa]?\b(?!\s+vez)/.exec(t);
  if (ord) return ["primer", "segund", "tercer"].indexOf(ord[1]) + 1;
  const producto = /\b(soat|todo riesgo|responsabilidad civil)\b/.exec(t);
  return producto && /\b(quiero|elijo|tomo|me interesa|prefiero)\b/.test(t) ? producto[1] : null;
}

function elegirSeguro(input: PlannerInput, eleccion: number | string): PlannerStep {
  const r = ultimo(input.toolResults, "cotizar_aliados_seguros");
  if (!r) {
    if (!input.allowedTools.includes("cotizar_aliados_seguros")) return final(input, SIN_PERMISO, []);
    return llamada("cotizar_aliados_seguros", { vehicleId: input.session.vehicleId }, "El cliente eligió una oferta de seguro");
  }
  const out = r.ok ? CotizarSegurosOutput.safeParse(r.output) : undefined;
  const ofertas: InsuranceOffer[] = out?.success ? out.data.ofertas : [];
  const o =
    typeof eleccion === "number" ? ofertas[eleccion - 1] : ofertas.find((x) => normalizar(x.producto) === eleccion);
  if (!o) return final(input, "No identifiqué la opción que eligió. Escriba su número, por ejemplo «la 1».", []);
  // El texto no lleva precios (los muestran las tarjetas verificadas); el resumen interno sí, para el asesor.
  return final(
    input,
    `Excelente elección: ${o.producto} de ${o.aseguradora}. Para emitir la póliza, un asesor certificado le contactará para validar sus datos. Mientras tanto, ¿le agendo su mantenimiento?`,
    [],
    input.session.state,
    { motivo: "seguro", prioridad: "media", resumen: `Eligió ${o.producto} de ${o.aseguradora} (prima anual USD ${o.primaAnualUsd})` },
  );
}

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

/** Qué incluye y cuánto dura, con la cotización verificada del tarifario (sin tarjetas ni cambio de estado). */
function detalle(input: PlannerInput, params: QuoteParams): PlannerStep {
  const r = ultimo(input.toolResults, "verificar_stock_y_precio");
  if (!r) {
    if (!input.allowedTools.includes("verificar_stock_y_precio")) return final(input, SIN_PERMISO, []);
    return llamada("verificar_stock_y_precio", { ...params }, "El cliente pregunta qué incluye o cuánto dura el servicio");
  }
  const out = r.ok ? VerificarStockOutput.safeParse(r.output) : undefined;
  if (!out?.success) return final(input, "No pude consultar el detalle ahora. ¿Le ayudo a agendar o prefiere hablar con un asesor?", []);
  const items = out.data.cotizacion.items;
  const servicios = items.filter((l) => !l.sku).map((l) => l.concepto.replace(/^Mano de obra: /, ""));
  const repuestos = items.filter((l) => l.sku).map((l) => l.concepto.toLowerCase());
  const horas = out.data.duracionHoras.toLocaleString("es-CO", { maximumFractionDigits: 1 });
  return final(
    input,
    `Según el tarifario oficial: ${servicios.join("; ")}. Repuestos: ${repuestos.join(", ")}. Tiempo estimado en el taller: ${horas} h. ¿Le agendo la cita?`,
    [],
  );
}

function seguros(input: PlannerInput): PlannerStep {
  const r = ultimo(input.toolResults, "cotizar_aliados_seguros");
  if (!r) {
    if (!input.allowedTools.includes("cotizar_aliados_seguros")) return final(input, SIN_PERMISO, []);
    return llamada("cotizar_aliados_seguros", { vehicleId: input.session.vehicleId }, "El cliente pregunta por seguros");
  }
  return final(input, TEXTO_SEGUROS, r.ok ? ["seguro"] : []);
}

/**
 * Lo que el motor de reglas no entiende (respondería con el menú): intención «otro» con la cotización
 * ya hecha, fuera de HANDOFF y CERRADO y sin elegir un seguro mostrado. En modo híbrido, ahí responde
 * la IA (ADR 0009).
 */
export function fueraDeReglas(input: PlannerInput): boolean {
  const { state, quoteId } = input.session;
  if (state === "HANDOFF" || state === "CERRADO" || !quoteId) return false;
  if (detectarIntencion(input.request, input.maskedMessage) !== "otro") return false;
  return !(segurosMostrados(input) && eleccionSeguro(input.maskedMessage) !== null);
}

export function planificar(input: PlannerInput): PlannerStep {
  const intencion = detectarIntencion(input.request, input.maskedMessage);
  // T21: con el caso en manos de un humano, el agente no ofrece nada más.
  if (input.session.state === "HANDOFF") return final(input, SIN_PERMISO, []);
  if (intencion === "asesor")
    return final(input, "Con gusto. Un asesor humano revisará su caso y le contactará en breve.", [], "HANDOFF", {
      motivo: "cliente_molesto",
      prioridad: "media",
      resumen: "El cliente pide hablar con un asesor",
    });
  const eleccion = segurosMostrados(input) ? eleccionSeguro(input.maskedMessage) : null;
  if (eleccion !== null) return elegirSeguro(input, eleccion);
  if (intencion === "seguros")
    return segurosMostrados(input)
      ? final(input, "Ya le compartí las opciones de nuestras aseguradoras aliadas más arriba. Para elegir una, escriba su número, por ejemplo «la 1».", [])
      : seguros(input);
  if (input.session.state === "CERRADO") return citaCerrada(input);

  const base = paramsBase(input);
  if (fueraDeReglas(input)) return ultimoTextoAgente(input) === MENU ? noResuelto(input) : final(input, MENU, []);
  if (!base) return necesitaContexto(input);

  switch (intencion) {
    case "venta_cruzada": {
      const extra = extraVentaCruzada(input.maskedMessage);
      // T20: si ya está incluido no se vuelve a cotizar lo mismo (evita bucles del botón o del guion).
      if (base.extras.includes(extra))
        return final(input, "El paquete ya está incluido en su cotización. ¿Le agendo la cita?", [], "COTIZACION");
      return cotizar(input, { ...base, extras: [...base.extras, extra] }, intencion);
    }
    case "rechazar_venta_cruzada":
      return base.extras.length > 0
        ? cotizar(input, { ...base, extras: [] }, intencion)
        : final(input, "Entendido, mantenemos solo el mantenimiento. ¿Le agendo la cita?", [], "COTIZACION");
    case "agendar":
    case "confirmar":
      return agendar(input, base, intencion === "confirmar");
    case "detalle":
      return detalle(input, base);
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
