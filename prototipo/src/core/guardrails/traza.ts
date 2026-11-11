/** Fábrica de eventos de traza del Guardián (Rayos X). Todo pasa por el enmascarado. */
import type { Autonomy, GuardrailCategory, TraceEvent } from "@/core/contracts";
import { maskPayload, maskPII } from "./pii";

export interface DatosEvento {
  kind: "guardrail" | "policy";
  name: string;
  status: TraceEvent["status"];
  detalle: string;
  payload: Record<string, unknown>;
  inicioMs?: number;
  autonomy?: Autonomy;
}

export function eventoGuardian(d: DatosEvento): TraceEvent {
  const latencia = d.inicioMs === undefined ? 0 : performance.now() - d.inicioMs;
  return {
    id: `guardian-${crypto.randomUUID()}`,
    ts: new Date().toISOString(),
    kind: d.kind,
    agent: "Guardián",
    name: d.name,
    system: "Guardián",
    ...(d.autonomy ? { autonomy: d.autonomy } : {}),
    payload: maskPayload(d.payload),
    latencyMs: Math.max(0, Math.round(latencia * 100) / 100),
    status: d.status,
    detalle: maskPII(d.detalle).masked,
  };
}

/** Peso de riesgo por categoría; el riskScore es el máximo + 0,1 por cada bloqueo adicional. */
const PESO: Readonly<Record<GuardrailCategory, number>> = {
  inyeccion: 0.9,
  fraude: 0.8,
  limite_intentos: 0.9,
  salida_invalida: 0.9,
  sintoma_critico: 0.6,
  sin_consentimiento: 0.5,
  pii: 0.2,
};

export function riskScore(categorias: readonly GuardrailCategory[]): number {
  if (categorias.length === 0) return 0;
  const max = Math.max(...categorias.map((c) => PESO[c]));
  const bloqueos = categorias.filter((c) => c === "inyeccion" || c === "fraude").length;
  const score = max + 0.1 * Math.max(0, bloqueos - 1);
  return Math.min(1, Math.round(score * 100) / 100);
}
