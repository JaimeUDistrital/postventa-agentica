/**
 * Contratos del agente: turno, traza (Rayos X), guardrails, handoff y memoria por agente.
 * Dueño: Orquestador (PLAN.md §4).
 */
import { z } from "zod";
import { BaySlot, Booking, InsuranceOffer, IsoDate, PriceQuote } from "./domain";

export const ScenarioId = z.enum([
  "feliz",
  "sintoma_critico",
  "sin_stock",
  "adversarial",
  "sin_consentimiento",
]);

export const AgentState = z.enum([
  "TRIGGER",
  "CONTACTO",
  "COTIZACION",
  "VENTA_CRUZADA",
  "CONFIRMACION",
  "CERRADO",
  "HANDOFF",
  "BLOQUEADO",
]);

/** Agentes del producto (PLAN.md §3). */
export const AgentName = z.enum(["Proactivo", "Postventa", "Guardián", "Copiloto"]);

export const SystemName = z.enum([
  "CRM",
  "Inventario",
  "Taller",
  "Tarifario",
  "Aseguradoras",
  "Guardián",
  "LLM",
]);

export const Autonomy = z.enum(["informar", "recomendar", "ejecutar", "prohibido"]);

export const TraceKind = z.enum([
  "guardrail",
  "tool_call",
  "tool_result",
  "policy",
  "llm",
  "handoff",
  "state",
  "memory",
]);

export const TraceStatus = z.enum(["ok", "blocked", "error", "escalated"]);

export const TraceEvent = z.object({
  id: z.string().min(1),
  /** ISO 8601. Se genera en el servidor (API), nunca durante el render. */
  ts: z.string().min(1),
  kind: TraceKind,
  agent: AgentName,
  name: z.string().min(1),
  system: SystemName,
  autonomy: Autonomy.optional(),
  /** Siempre con PII enmascarada (Guardián/auditoría). */
  payload: z.record(z.string(), z.unknown()),
  latencyMs: z.number().nonnegative(),
  status: TraceStatus,
  /** Explicación de una línea para el jurado. */
  detalle: z.string().optional(),
});

export const GuardrailCategory = z.enum([
  "inyeccion",
  "fraude",
  "sintoma_critico",
  "pii",
  "sin_consentimiento",
  "limite_intentos",
  "salida_invalida",
]);

export const GuardrailVerdict = z.object({
  allow: z.boolean(),
  action: z.enum(["permitir", "enmascarar", "bloquear", "escalar"]),
  categorias: z.array(GuardrailCategory),
  reasons: z.array(z.string()),
  /** Texto con PII enmascarada (lo único que puede ver el LLM y la traza). */
  maskedInput: z.string(),
  riskScore: z.number().min(0).max(1),
});

export const HandoffReason = z.enum([
  "sintoma_critico",
  "sin_stock",
  "adversarial",
  "garantia",
  "cliente_molesto",
  /** El cliente eligió un seguro: lo emite un asesor certificado. No bloquea la conversación (T21). */
  "seguro",
  /** El agente no entendió dos mensajes seguidos y pasa el caso a un humano (T21). */
  "no_resuelto",
]);

export const HandoffCase = z.object({
  id: z.string().min(1),
  motivo: HandoffReason,
  prioridad: z.enum(["alta", "media", "baja"]),
  resumen: z.string().min(1),
  contexto: z.object({
    clienteAlias: z.string().min(1),
    vehiculo: z.string().min(1),
    kmEstimado: z.number().nonnegative(),
    sintomas: z.array(z.string()).default([]),
    ultimoMensaje: z.string(),
  }),
  siguientePasoSugerido: z.string().min(1),
  trazaIds: z.array(z.string()),
  creadoEn: z.string().min(1),
  estado: z.enum(["abierto", "tomado"]).default("abierto"),
});

/** Memoria visible por agente (panel «Memoria» del Rayos X). */
export const MemorySnapshot = z.object({
  proactivo: z.object({
    contactosUltimos30Dias: z.number().int().nonnegative(),
    optInWhatsapp: z.boolean(),
    motivoContacto: z.string().nullable(),
  }),
  postventa: z.object({
    turnos: z.number().int().nonnegative(),
    estado: AgentState,
    perfilVehiculo: z.object({
      descripcion: z.string(),
      kmEstimado: z.number().nonnegative(),
      proximoHitoKm: z.number().int().nonnegative(),
    }),
    historialServicios: z.array(
      z.object({ fecha: IsoDate, km: z.number(), servicio: z.string(), enAgencia: z.boolean() }),
    ),
    cotizacionId: z.string().nullable(),
    reservaId: z.string().nullable(),
  }),
  guardian: z.object({
    intentosBloqueados: z.number().int().nonnegative(),
    alertas: z.array(z.string()),
  }),
  copiloto: z.object({
    casoAbiertoId: z.string().nullable(),
  }),
});

export const ReplyCard = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("alerta_km"),
    kmEstimado: z.number(),
    proximoHitoKm: z.number(),
    diasParaHito: z.number(),
  }),
  z.object({ type: z.literal("cotizacion"), quote: PriceQuote }),
  z.object({ type: z.literal("reserva"), booking: Booking }),
  z.object({ type: z.literal("alternativas"), slots: z.array(BaySlot), motivo: z.string() }),
  z.object({ type: z.literal("seguro"), ofertas: z.array(InsuranceOffer) }),
  z.object({ type: z.literal("handoff"), casoId: z.string(), mensaje: z.string() }),
  z.object({ type: z.literal("bloqueo"), motivo: z.string() }),
]);

/** Acciones de 1 clic que la UI envía como mensaje estructurado. */
export const UserAction = z.enum([
  "aceptar_mantenimiento",
  "agregar_venta_cruzada",
  "rechazar_venta_cruzada",
  "confirmar_reserva",
  "ver_seguros",
  "hablar_con_asesor",
]);

export const AgentRequest = z.object({
  sessionId: z.string().min(1).max(64),
  scenarioId: ScenarioId,
  tipo: z.enum(["inicio", "mensaje", "accion"]).default("mensaje"),
  message: z.string().max(1000).default(""),
  accion: UserAction.optional(),
  /** Memoria de sesión firmada (HMAC) devuelta en el turno anterior. */
  stateToken: z.string().max(8000).optional(),
  /** «Código del jurado»: habilita el planner Gemini (ADR 0006). Sin él, modo determinista. */
  accessCode: z.string().max(64).optional(),
});

export const AgentTurn = z.object({
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  state: AgentState,
  reply: z.object({ text: z.string(), cards: z.array(ReplyCard) }),
  trace: z.array(TraceEvent),
  handoff: HandoffCase.optional(),
  guardrail: z.object({ entrada: GuardrailVerdict, salida: GuardrailVerdict.optional() }),
  mode: z.enum(["deterministic", "llm"]),
  memory: MemorySnapshot,
  stateToken: z.string().min(1),
});

/** Carga útil del token firmado. Nunca contiene PII sin enmascarar. */
export const SessionState = z.object({
  sessionId: z.string().min(1),
  scenarioId: ScenarioId,
  vehicleId: z.string().min(1),
  state: AgentState,
  turnos: z.number().int().nonnegative(),
  intentosBloqueados: z.number().int().nonnegative(),
  quoteId: z.string().nullable(),
  bookingId: z.string().nullable(),
  ventaCruzada: z.enum(["pendiente", "aceptada", "rechazada"]),
  casoAbiertoId: z.string().nullable(),
  historial: z
    .array(z.object({ rol: z.enum(["cliente", "agente"]), texto: z.string() }))
    .max(12),
});

export type ScenarioId = z.infer<typeof ScenarioId>;
export type AgentState = z.infer<typeof AgentState>;
export type AgentName = z.infer<typeof AgentName>;
export type SystemName = z.infer<typeof SystemName>;
export type Autonomy = z.infer<typeof Autonomy>;
export type TraceEvent = z.infer<typeof TraceEvent>;
export type GuardrailCategory = z.infer<typeof GuardrailCategory>;
export type GuardrailVerdict = z.infer<typeof GuardrailVerdict>;
export type HandoffReason = z.infer<typeof HandoffReason>;
export type HandoffCase = z.infer<typeof HandoffCase>;
export type MemorySnapshot = z.infer<typeof MemorySnapshot>;
export type ReplyCard = z.infer<typeof ReplyCard>;
export type UserAction = z.infer<typeof UserAction>;
export type AgentRequest = z.infer<typeof AgentRequest>;
export type AgentTurn = z.infer<typeof AgentTurn>;
export type SessionState = z.infer<typeof SessionState>;
