/**
 * Configuración del prototipo derivada de la fuente única `data/assumptions.json`
 * (copiada aquí por scripts/sync-assumptions.mjs). Dueño: Orquestador.
 */
import { AssumptionsFile, type AssumptionId } from "@/core/contracts/assumptions";
import raw from "./assumptions.json";

export const assumptions = AssumptionsFile.parse(raw);

/** Valor del escenario base de un supuesto requerido. */
export function base(id: AssumptionId): number {
  const s = assumptions.supuestos.find((a) => a.id === id);
  if (!s) throw new Error(`Supuesto no encontrado: ${id}`);
  return s.base;
}

/** Fecha y hora fijas de la demo: hacen deterministas km estimados, agenda y tests. */
export const DEMO_DATE = "2026-11-12";
export const DEMO_NOW = "2026-11-12T09:00";

export const policy = {
  topeDescuentoPct: base("tope_descuento_pct"),
  maxContactos30Dias: base("max_contactos_30_dias"),
  holdReservaMinutos: base("hold_reserva_minutos"),
  /** Tras este número de mensajes bloqueados, la sesión queda en BLOQUEADO. */
  maxIntentosBloqueados: 2,
} as const;

export const trmCopUsd = base("trm_cop_usd");

export const llmConfig = {
  defaultModel: "gemini-3.5-flash-lite",
  alternativeModel: "gemini-3.6-flash",
  timeoutMs: 8000,
  maxRetries: 1,
  maxToolIterations: 4,
} as const;
