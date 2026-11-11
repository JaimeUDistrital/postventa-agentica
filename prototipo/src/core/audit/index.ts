/**
 * Auditoría (T04): registro en memoria de eventos de traza, siempre enmascarados.
 * Lo guardado y lo exportado nunca contiene PII (se enmascara al registrar).
 */
import type { TraceEvent } from "@/core/contracts";
import { maskPayload, maskPII } from "@/core/guardrails";

export interface Auditoria {
  /** Guarda una copia enmascarada del evento (el original no se modifica ni se referencia). */
  registrar: (evento: TraceEvent) => void;
  /** Copia de los eventos registrados, en orden de llegada. */
  exportar: () => TraceEvent[];
}

function enmascararEvento(e: TraceEvent): TraceEvent {
  return {
    ...e,
    name: maskPII(e.name).masked,
    payload: maskPayload(e.payload),
    ...(e.detalle !== undefined ? { detalle: maskPII(e.detalle).masked } : {}),
  };
}

export function crearAuditoria(): Auditoria {
  const eventos: TraceEvent[] = [];
  return {
    registrar: (evento) => {
      eventos.push(enmascararEvento(evento));
    },
    exportar: () => structuredClone(eventos),
  };
}
