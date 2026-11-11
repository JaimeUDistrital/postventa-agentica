"use client";
/**
 * T22 · 4: «Auditoría» de la conversación del cliente elegido: quién respondió (IA, asesor, cliente o
 * sistema), cuándo y, para la IA, con qué motor, qué herramientas llamó y qué decidió el Guardián.
 * Los datos salen de la memoria de la demo (en producción irían a una base de datos, Fase 2).
 */
import { Download } from "lucide-react";
import type { AgentTurn, GuardrailVerdict, ScenarioId } from "@/core/contracts";
import type { ChatMessage } from "@/ui/contracts";
import { formatHoraReloj } from "@/ui/owner/format";

export interface EntradaAuditoria {
  id: string;
  /** Instante ISO en que entró en la conversación. */
  ts: string | null;
  autor: "IA" | "Asesor" | "Cliente" | "Sistema";
  /** Solo en mensajes y llamadas del asesor: los escribió una persona de la agencia. */
  humano?: true;
  nombre?: string;
  texto: string;
  /** Solo si el mensaje sale de un turno del agente. */
  motor?: "reglas" | "Gemini";
  herramientas?: string[];
  guardian?: { entrada: string; salida?: string };
  tarjetas?: string[];
}

const AUTOR: Record<ChatMessage["rol"], EntradaAuditoria["autor"]> = {
  agente: "IA",
  asesor: "Asesor",
  cliente: "Cliente",
  sistema: "Sistema",
};

const ACCION: Record<GuardrailVerdict["action"], string> = {
  permitir: "Permitió",
  enmascarar: "Enmascaró datos personales",
  bloquear: "Bloqueó",
  escalar: "Escaló a un asesor",
};
const veredicto = (v: GuardrailVerdict) => (v.categorias.length ? `${ACCION[v.action]} (${v.categorias.join(", ")})` : ACCION[v.action]);

export function construirAuditoria(messages: ChatMessage[], turns: AgentTurn[]): EntradaAuditoria[] {
  const porTurno = new Map(turns.map((t) => [t.turnId, t]));
  return messages.map((m) => {
    const e: EntradaAuditoria = { id: m.id, ts: m.ts ?? null, autor: AUTOR[m.rol], texto: m.texto };
    if (m.rol === "asesor") Object.assign(e, { humano: true, nombre: m.autor });
    const turn = m.turnId ? porTurno.get(m.turnId) : undefined;
    if (turn) {
      e.motor = turn.mode === "llm" ? "Gemini" : "reglas";
      e.herramientas = [...new Set(turn.trace.filter((t) => t.kind === "tool_call").map((t) => t.name))];
      e.guardian = { entrada: veredicto(turn.guardrail.entrada), ...(turn.guardrail.salida ? { salida: veredicto(turn.guardrail.salida) } : {}) };
      if (m.cards.length) e.tarjetas = m.cards.map((c) => c.type);
    }
    return e;
  });
}

const CHIP: Record<EntradaAuditoria["autor"], string> = {
  IA: "bg-slate-100 text-slate-800",
  Asesor: "bg-emerald-100 text-emerald-900",
  Cliente: "bg-brand-soft text-brand",
  Sistema: "bg-slate-200 text-slate-700",
};

interface Props {
  scenarioId: ScenarioId | null;
  cliente?: string;
  messages: ChatMessage[];
  turns: AgentTurn[];
}

export function AuditTimeline({ scenarioId, cliente, messages, turns }: Props) {
  const entradas = construirAuditoria(messages, turns);

  const descargar = () => {
    const datos = { cliente: cliente ?? null, escenario: scenarioId, generadoEn: new Date().toISOString(), entradas };
    const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-${scenarioId ?? "demo"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <section aria-labelledby="auditoria-titulo" data-testid="audit-timeline" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="auditoria-titulo" className="text-base font-semibold text-slate-900">
            Auditoría de la conversación
          </h2>
          <p className="text-xs text-slate-600">
            {scenarioId
              ? `Con ${cliente ?? scenarioId}: quién respondió (la IA o una persona), cuándo y cómo.`
              : "Elija un cliente para ver su auditoría."}
          </p>
        </div>
        <button
          type="button"
          disabled={entradas.length === 0}
          onClick={descargar}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download aria-hidden className="size-4" />
          Descargar auditoría (JSON)
        </button>
      </div>

      {scenarioId && entradas.length === 0 && <p className="text-sm text-slate-600">Aún no hay mensajes con este cliente.</p>}
      {entradas.length > 0 && (
        <ol aria-label="Línea de tiempo" className="space-y-2">
          {entradas.map((e) => (
            <li key={e.id} data-testid="auditoria-entrada" data-autor={e.autor} className="rounded-lg border border-slate-200 p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <time dateTime={e.ts ?? undefined} className="font-semibold tabular-nums text-slate-700">
                  {e.ts ? formatHoraReloj(e.ts) : "—"}
                </time>
                <span className={`rounded-full px-2 py-0.5 font-semibold ${CHIP[e.autor]}`}>{e.autor}</span>
                {e.humano && (
                  <span className="rounded-full border border-emerald-300 px-2 py-0.5 font-semibold text-emerald-800">
                    humano · {e.nombre}
                  </span>
                )}
              </div>
              <p className="mt-1 break-words text-slate-900">{e.texto}</p>
              {e.motor && (
                <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs text-slate-700">
                  <dt className="font-semibold">Motor</dt>
                  <dd>{e.motor === "Gemini" ? "Gemini" : "Reglas"}</dd>
                  <dt className="font-semibold">Herramientas</dt>
                  <dd className="font-mono break-all">{e.herramientas?.length ? e.herramientas.join(", ") : "ninguna"}</dd>
                  <dt className="font-semibold">Guardián</dt>
                  <dd>
                    {e.guardian?.entrada}
                    {e.guardian?.salida && ` · salida: ${e.guardian.salida}`}
                  </dd>
                  {e.tarjetas && (
                    <>
                      <dt className="font-semibold">Tarjetas</dt>
                      <dd className="font-mono">{e.tarjetas.join(", ")}</dd>
                    </>
                  )}
                </dl>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
