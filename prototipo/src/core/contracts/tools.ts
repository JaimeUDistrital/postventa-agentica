/**
 * Contratos de las herramientas del agente: nombre, sistema, nivel de autonomía y E/S.
 * T03 las implementa, T08 las orquesta, T09 las expone a Gemini (function calling).
 * Dueño: Orquestador (PLAN.md §4).
 */
import { z } from "zod";
import { Autonomy, HandoffCase, HandoffReason, SystemName, TraceEvent } from "./agent";
import {
  BaySlot,
  Booking,
  Consent,
  InsuranceOffer,
  IsoDate,
  PriceQuote,
  ServiceRecord,
  Vehicle,
} from "./domain";

export const ToolName = z.enum([
  "consultar_contexto_vehiculo",
  "verificar_stock_y_precio",
  "agendar_bahia_taller",
  "cotizar_aliados_seguros",
  "escalar_asesor_humano",
]);

// 1 · CRM + estimador de km (informar)
export const ConsultarContextoInput = z.object({ vehicleId: z.string().min(1) });
export const ConsultarContextoOutput = z.object({
  vehicle: Vehicle,
  /** Alias sin PII, p. ej. "Laura G." */
  clienteAlias: z.string().min(1),
  consentimientos: z.array(Consent),
  contactosUltimos30Dias: z.number().int().nonnegative(),
  kmEstimado: z.number().nonnegative(),
  proximoHitoKm: z.number().int().positive(),
  diasParaHito: z.number().int(),
  enGarantia: z.boolean(),
  historial: z.array(ServiceRecord),
});

// 2 · Inventario + Tarifario (informar)
export const VerificarStockInput = z.object({
  vehicleId: z.string().min(1),
  hitoKm: z.number().int().positive(),
  /** Ids de TariffItem de venta cruzada a sumar a la cotización. */
  extras: z.array(z.string()).default([]),
  descuentoPct: z.number().min(0).max(1).default(0),
});
export const VerificarStockOutput = z.object({
  disponibilidad: z.array(
    z.object({
      sku: z.string(),
      descripcion: z.string(),
      requerido: z.number().int().positive(),
      stock: z.number().int().nonnegative(),
      disponible: z.boolean(),
      fechaReposicion: IsoDate.nullable(),
    }),
  ),
  todosDisponibles: z.boolean(),
  cotizacion: PriceQuote,
  ventaCruzadaSugerida: z.array(
    z.object({ tariffId: z.string(), descripcion: z.string(), precioUsd: z.number() }),
  ),
  /** Horas de taller del mantenimiento más los extras (tarifario). */
  duracionHoras: z.number().nonnegative(),
});

// 3 · Taller (ejecutar; requiere confirmación explícita del cliente)
export const AgendarBahiaInput = z.object({
  vehicleId: z.string().min(1),
  quoteId: z.string().min(1),
  slotId: z.string().optional(),
  preferencia: z.enum(["valle", "cualquiera"]).default("valle"),
  idempotencyKey: z.string().min(8),
  confirmadoPorCliente: z.boolean(),
});
export const AgendarBahiaOutput = z.object({
  estado: z.enum(["reservada", "requiere_confirmacion", "sin_disponibilidad", "sin_stock"]),
  booking: Booking.nullable(),
  alternativas: z.array(BaySlot),
});

// 4 · Aseguradoras aliadas (recomendar)
export const CotizarSegurosInput = z.object({ vehicleId: z.string().min(1) });
export const CotizarSegurosOutput = z.object({
  vencimientoSoat: IsoDate,
  vencimientoPoliza: IsoDate.nullable(),
  diasParaVencimientoSoat: z.number().int(),
  ofertas: z.array(InsuranceOffer),
});

// 5 · Handoff a asesor humano (ejecutar)
export const EscalarAsesorInput = z.object({
  vehicleId: z.string().min(1),
  motivo: HandoffReason,
  prioridad: z.enum(["alta", "media", "baja"]),
  resumen: z.string().min(1),
  sintomas: z.array(z.string()).default([]),
  ultimoMensaje: z.string().default(""),
  trazaIds: z.array(z.string()).default([]),
});
export const EscalarAsesorOutput = z.object({ caso: HandoffCase });

/** Metadatos que la UI y la política de autonomía usan para cada herramienta. */
export const TOOL_META = {
  consultar_contexto_vehiculo: { system: "CRM", autonomy: "informar" },
  verificar_stock_y_precio: { system: "Inventario", autonomy: "informar" },
  agendar_bahia_taller: { system: "Taller", autonomy: "ejecutar" },
  cotizar_aliados_seguros: { system: "Aseguradoras", autonomy: "recomendar" },
  escalar_asesor_humano: { system: "CRM", autonomy: "ejecutar" },
} as const satisfies Record<
  z.infer<typeof ToolName>,
  { system: z.infer<typeof SystemName>; autonomy: z.infer<typeof Autonomy> }
>;

export const TOOL_SCHEMAS = {
  consultar_contexto_vehiculo: { input: ConsultarContextoInput, output: ConsultarContextoOutput },
  verificar_stock_y_precio: { input: VerificarStockInput, output: VerificarStockOutput },
  agendar_bahia_taller: { input: AgendarBahiaInput, output: AgendarBahiaOutput },
  cotizar_aliados_seguros: { input: CotizarSegurosInput, output: CotizarSegurosOutput },
  escalar_asesor_humano: { input: EscalarAsesorInput, output: EscalarAsesorOutput },
} as const;

/** Resultado uniforme de ejecutar una herramienta (lo que ve el orquestador). */
export const ToolResult = z.object({
  tool: ToolName,
  ok: z.boolean(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  trace: z.array(TraceEvent),
});

export type ToolName = z.infer<typeof ToolName>;
export type ConsultarContextoInput = z.infer<typeof ConsultarContextoInput>;
export type ConsultarContextoOutput = z.infer<typeof ConsultarContextoOutput>;
export type VerificarStockInput = z.input<typeof VerificarStockInput>;
export type VerificarStockOutput = z.infer<typeof VerificarStockOutput>;
export type AgendarBahiaInput = z.input<typeof AgendarBahiaInput>;
export type AgendarBahiaOutput = z.infer<typeof AgendarBahiaOutput>;
export type CotizarSegurosInput = z.infer<typeof CotizarSegurosInput>;
export type CotizarSegurosOutput = z.infer<typeof CotizarSegurosOutput>;
export type EscalarAsesorInput = z.input<typeof EscalarAsesorInput>;
export type EscalarAsesorOutput = z.infer<typeof EscalarAsesorOutput>;
export type ToolResult = z.infer<typeof ToolResult>;
