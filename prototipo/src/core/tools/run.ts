/**
 * Envoltorio común de las herramientas: valida entrada/salida con Zod, emite la traza
 * (tool_call + tool_result) y convierte cualquier fallo en ok:false (nunca lanza).
 */
import type { z } from "zod";
import {
  TOOL_META,
  TOOL_SCHEMAS,
  type AgentName,
  type SystemName,
  type ToolName,
  type ToolResult,
  type TraceEvent,
} from "@/core/contracts";
import type { ToolContext } from "@/core/ports";

/** Latencia simulada y determinista por sistema (no se espera de verdad). */
export const LATENCY_MS: Record<SystemName, number> = {
  CRM: 120,
  Inventario: 180,
  Tarifario: 90,
  Taller: 220,
  Aseguradoras: 350,
  Guardián: 5,
  LLM: 0,
};

type TraceStatus = TraceEvent["status"];

export class ToolFailure extends Error {
  constructor(
    readonly code: string,
    readonly detalle: string,
    readonly status: "blocked" | "error" = "error",
  ) {
    super(code);
  }
}

export interface Summary {
  system: SystemName;
  payload: Record<string, unknown>;
  detalle: string;
  status?: TraceStatus;
}

export interface Handled<T> {
  output: T;
  summaries: Summary[];
}

export type In<N extends ToolName> = z.output<(typeof TOOL_SCHEMAS)[N]["input"]>;
export type Out<N extends ToolName> = z.output<(typeof TOOL_SCHEMAS)[N]["output"]>;
export type Handler<N extends ToolName> = (ctx: ToolContext, input: In<N>) => Promise<Handled<Out<N>>>;

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : { args: v };

function event(
  tool: ToolName,
  kind: "tool_call" | "tool_result",
  s: { system: SystemName; payload: Record<string, unknown>; detalle: string; status: TraceStatus },
): TraceEvent {
  return {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    kind,
    agent: tool === "consultar_contexto_vehiculo" ? "Proactivo" : ("Postventa" satisfies AgentName),
    name: tool,
    system: s.system,
    autonomy: TOOL_META[tool].autonomy,
    payload: s.payload,
    latencyMs: kind === "tool_call" ? 0 : LATENCY_MS[s.system],
    status: s.status,
    detalle: s.detalle,
  };
}

export async function runTool<N extends ToolName>(
  name: N,
  ctx: ToolContext,
  args: unknown,
  handler: Handler<N>,
): Promise<ToolResult> {
  const system = TOOL_META[name].system;
  const call = event(name, "tool_call", {
    system,
    payload: asRecord(args),
    detalle: `El agente invoca ${name} (${TOOL_META[name].autonomy}) en ${system}`,
    status: "ok",
  });
  const fail = (error: string, detalle: string, status: TraceStatus): ToolResult => ({
    tool: name,
    ok: false,
    error,
    trace: [call, event(name, "tool_result", { system, payload: { error }, detalle, status })],
  });

  const parsed = TOOL_SCHEMAS[name].input.safeParse(args);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; ");
    return fail(`entrada_invalida: ${msg}`, `Entrada rechazada por el esquema: ${msg}`, "error");
  }
  try {
    const h = await handler(ctx, parsed.data as In<N>);
    const output = TOOL_SCHEMAS[name].output.parse(h.output);
    const results = h.summaries.map((s) => event(name, "tool_result", { status: "ok", ...s }));
    return { tool: name, ok: true, output, trace: [call, ...results] };
  } catch (e) {
    if (e instanceof ToolFailure) return fail(e.code, e.detalle, e.status);
    return fail(`error_interno: ${e instanceof Error ? e.message : String(e)}`, "Fallo inesperado en la herramienta", "error");
  }
}
