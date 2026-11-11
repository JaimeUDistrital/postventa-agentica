/** Fábrica de eventos de traza del orquestador (estado, memoria, handoff, política). */
import type { AgentName, Autonomy, SystemName, TraceEvent } from "@/core/contracts";

export interface DatosTraza {
  kind: TraceEvent["kind"];
  agent: AgentName;
  name: string;
  system: SystemName;
  status: TraceEvent["status"];
  detalle: string;
  payload?: Record<string, unknown>;
  autonomy?: Autonomy;
}

export function evento(d: DatosTraza): TraceEvent {
  return {
    id: `orq-${crypto.randomUUID()}`,
    ts: new Date().toISOString(),
    kind: d.kind,
    agent: d.agent,
    name: d.name,
    system: d.system,
    ...(d.autonomy ? { autonomy: d.autonomy } : {}),
    payload: d.payload ?? {},
    latencyMs: 0,
    status: d.status,
    detalle: d.detalle,
  };
}
