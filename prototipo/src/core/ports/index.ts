/**
 * Puertos (interfaces) hacia los sistemas de la agencia. Hoy los implementan
 * adaptadores mock (T03); en producción, DMS/CRM/agenda/aseguradoras reales.
 * También define el contrato del Planner (determinista en T08, Gemini en T09).
 * Dueño: Orquestador (PLAN.md §4).
 */
import type {
  AgentRequest,
  AgentState,
  BaySlot,
  Booking,
  ConsultarContextoOutput,
  HandoffCase,
  HandoffReason,
  InsuranceOffer,
  Owner,
  Part,
  ReplyCard,
  ServiceRecord,
  SessionState,
  TariffItem,
  ToolName,
  ToolResult,
  Vehicle,
} from "@/core/contracts";

export interface CrmPort {
  getOwner(id: string): Promise<Owner | undefined>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  getServiceHistory(vehicleId: string): Promise<ServiceRecord[]>;
  /** Bandeja del asesor: crea el caso de handoff. */
  createCase(caso: HandoffCase): Promise<HandoffCase>;
}

export interface InventoryPort {
  getPart(sku: string): Promise<Part | undefined>;
}

export interface PricingPort {
  /** `modelo` es la clave "Marca Modelo". */
  getTariff(modelo: string, hitoKm: number): Promise<TariffItem | undefined>;
  getTariffById(id: string): Promise<TariffItem | undefined>;
  getCrossSell(modelo: string): Promise<TariffItem[]>;
}

export interface WorkshopPort {
  listSlots(opts: { desde: string; franja?: "valle" | "pico"; limite?: number }): Promise<BaySlot[]>;
  /** Idempotente por `idempotencyKey`: la misma clave devuelve la misma reserva. */
  hold(input: {
    vehicleId: string;
    slotId: string;
    quoteId: string;
    repuestos: string[];
    idempotencyKey: string;
  }): Promise<Booking>;
  findByIdempotencyKey(key: string): Promise<Booking | undefined>;
}

export interface InsurerPort {
  listOffers(vehicleId: string): Promise<InsuranceOffer[]>;
}

export interface Ports {
  crm: CrmPort;
  inventory: InventoryPort;
  pricing: PricingPort;
  workshop: WorkshopPort;
  insurers: InsurerPort;
}

/** Contexto que recibe cada herramienta. `now` es la hora fija de la demo (determinismo). */
export interface ToolContext {
  ports: Ports;
  now: string;
}

// ---------------------------------------------------------------- Planner

export interface ToolCall {
  id: string;
  tool: ToolName;
  args: unknown;
}

export type CardKind = Extract<ReplyCard["type"], "alerta_km" | "cotizacion" | "reserva" | "alternativas" | "seguro">;

export interface PlannerInput {
  request: AgentRequest;
  /** Mensaje del cliente ya enmascarado por el Guardián (lo único que ve el LLM). */
  maskedMessage: string;
  session: SessionState;
  context: ConsultarContextoOutput | null;
  toolResults: ToolResult[];
  allowedTools: ToolName[];
  iteration: number;
}

export type PlannerStep =
  | { kind: "tool_calls"; calls: ToolCall[]; rationale: string }
  | {
      kind: "final";
      text: string;
      nextState: AgentState;
      /**
       * Tarjetas que el orquestador construye desde resultados de herramientas
       * verificados. El planner nunca escribe precios ni reservas a mano.
       */
      showCards: CardKind[];
      handoff?: { motivo: HandoffReason; prioridad: "alta" | "media" | "baja"; resumen: string };
    };

export interface PlannerUsage {
  inputTokens: number;
  outputTokens: number;
  costoUsd: number;
}

export interface Planner {
  readonly mode: "deterministic" | "llm";
  readonly model?: string;
  next(input: PlannerInput): Promise<{ step: PlannerStep; usage?: PlannerUsage }>;
}
