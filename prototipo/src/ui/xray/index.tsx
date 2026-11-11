"use client";
/** T06 · Consola Rayos X: traza, guardián, máquina de estados y memoria por agente. */
import {
  Bot,
  Boxes,
  Building2,
  Database,
  Receipt,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type {
  AgentState,
  AgentTurn,
  Autonomy,
  GuardrailVerdict,
  MemorySnapshot,
  SystemName,
  TraceEvent,
} from "@/core/contracts";
import type { XrayConsoleProps } from "@/ui/contracts";

const SYSTEM_ICON: Record<SystemName, LucideIcon> = {
  CRM: Database,
  Inventario: Boxes,
  Taller: Wrench,
  Tarifario: Receipt,
  Aseguradoras: Building2,
  Guardián: ShieldCheck,
  LLM: Bot,
};

const STATUS_STYLE: Record<TraceEvent["status"], { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-emerald-900 text-emerald-200 border-emerald-500" },
  blocked: { label: "BLOQUEADO", cls: "bg-red-900 text-red-200 border-red-500" },
  escalated: { label: "ESCALADO", cls: "bg-amber-900 text-amber-100 border-amber-500" },
  error: { label: "ERROR", cls: "bg-pink-900 text-pink-100 border-pink-500" },
};

const AUTONOMY_LABEL: Record<Autonomy, string> = {
  informar: "Informar",
  recomendar: "Recomendar",
  ejecutar: "Ejecutar",
  prohibido: "Prohibido",
};

const STATE_FLOW: AgentState[] = [
  "TRIGGER",
  "CONTACTO",
  "COTIZACION",
  "VENTA_CRUZADA",
  "CONFIRMACION",
  "CERRADO",
];
const STATE_EXITS: AgentState[] = ["HANDOFF", "BLOQUEADO"];

const badge = "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium";

function Panel({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section
      data-testid={testId}
      aria-label={title}
      className="rounded-lg border border-slate-700 bg-slate-900 p-3"
    >
      <h3 className="mb-2 text-sm font-semibold text-slate-100">{title}</h3>
      {children}
    </section>
  );
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (Array.isArray(v)) return v.length === 0 ? "ninguno" : v.map(fmtValue).join("; ");
  if (typeof v === "object")
    return Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${k}: ${fmtValue(x)}`)
      .join(", ");
  return String(v);
}

function Fields({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="space-y-0.5 text-xs">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="shrink-0 text-slate-400">{k}:</dt>
          <dd className="break-words text-slate-100">{fmtValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function EventItem({ e, delay }: { e: TraceEvent; delay?: number }) {
  const Icon = SYSTEM_ICON[e.system];
  const st = STATUS_STYLE[e.status];
  return (
    <li
      data-testid="trace-event"
      style={delay === undefined ? undefined : { animationDelay: `${delay * 120}ms` }}
      className={`${delay === undefined ? "" : "trace-in "}rounded-md border border-slate-700 bg-slate-900 p-2 text-xs`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Icon aria-hidden className="h-4 w-4 text-sky-300" />
        <span className="font-semibold text-slate-100">{e.system}</span>
        <span className="text-slate-400">{e.agent}</span>
        <span className={`${badge} border-slate-500 text-slate-200`}>{e.kind}</span>
        <span className="font-mono text-slate-100">{e.name}</span>
        <span className="ml-auto text-slate-300">{e.latencyMs} ms</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {e.autonomy && (
          <span className={`${badge} border-indigo-400 bg-indigo-950 text-indigo-200`}>
            Autonomía: {AUTONOMY_LABEL[e.autonomy]}
          </span>
        )}
        <span className={`${badge} ${st.cls}`}>{st.label}</span>
      </div>
      {e.detalle && <p className="mt-1 text-slate-200">{e.detalle}</p>}
      <details className="mt-1">
        <summary className="cursor-pointer text-slate-300 rounded focus-visible:outline-2 focus-visible:outline-sky-400">
          Payload JSON
        </summary>
        <pre className="mt-1 overflow-x-auto rounded bg-slate-950 p-2 text-[11px] text-slate-200">
          {JSON.stringify(e.payload, null, 2)}
        </pre>
      </details>
    </li>
  );
}

function VerdictView({ title, v }: { title: string; v: GuardrailVerdict }) {
  return (
    <div className="text-xs">
      <p className="font-medium text-slate-100">{title}</p>
      <Fields
        data={{
          acción: v.action,
          categorías: v.categorias,
          riskScore: v.riskScore,
          razones: v.reasons,
        }}
      />
    </div>
  );
}

function MemoryView({ m }: { m: MemorySnapshot }) {
  const sections: [string, Record<string, unknown>][] = [
    ["proactivo", m.proactivo],
    ["postventa", m.postventa],
    ["guardian", m.guardian],
    ["copiloto", m.copiloto],
  ];
  return (
    <div className="space-y-2">
      {sections.map(([key, data]) => (
        <section key={key} aria-label={`Memoria ${key}`}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-300">{key}</h4>
          <Fields data={data} />
        </section>
      ))}
    </div>
  );
}

export function XrayConsole({ turns }: XrayConsoleProps) {
  const last: AgentTurn | undefined = turns.at(-1);
  const events = turns.flatMap((t) => t.trace);
  const systems = [...new Set(events.map((e) => e.system))];
  const totalMs = events.reduce((s, e) => s + e.latencyMs, 0);

  return (
    <div data-testid="xray-console" className="min-h-full space-y-3 bg-slate-950 p-4 text-slate-100">
      <h2 className="text-base font-semibold">Rayos X del agente</h2>
      {!last ? (
        <p className="rounded-lg border border-dashed border-slate-600 p-4 text-sm text-slate-300">
          Elija un escenario para ver al agente trabajar
        </p>
      ) : (
        <>
          <Panel title="Resumen" testId="xray-summary">
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-slate-400">Eventos</dt><dd>{events.length}</dd></div>
              <div><dt className="text-slate-400">Latencia total</dt><dd>{totalMs} ms</dd></div>
              <div><dt className="text-slate-400">Sistemas tocados</dt><dd>{systems.join(", ") || "ninguno"}</dd></div>
              <div><dt className="text-slate-400">Modo</dt><dd>{last.mode === "llm" ? "LLM" : "Determinista"}</dd></div>
            </dl>
          </Panel>

          <Panel title="Máquina de estados" testId="state-machine">
            <ol className="flex flex-wrap gap-1.5 text-[11px]" aria-label="Flujo principal">
              {STATE_FLOW.map((s) => (
                <StateChip key={s} s={s} current={last.state} />
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-slate-400">Salidas</p>
            <ol className="mt-1 flex flex-wrap gap-1.5 text-[11px]" aria-label="Salidas">
              {STATE_EXITS.map((s) => (
                <StateChip key={s} s={s} current={last.state} />
              ))}
            </ol>
          </Panel>

          <Panel title="Guardián" testId="guardian-panel">
            <div className="space-y-2">
              <VerdictView title="Entrada" v={last.guardrail.entrada} />
              {last.guardrail.salida && <VerdictView title="Salida" v={last.guardrail.salida} />}
            </div>
          </Panel>

          <Panel title="Memoria">
            <div data-testid="memory-panel">
              <MemoryView m={last.memory} />
            </div>
          </Panel>

          <Panel title="Línea de tiempo">
            <style>{`@keyframes trace-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.trace-in{animation:trace-in .3s ease-out both}
@media (prefers-reduced-motion: reduce){.trace-in{animation:none}}`}</style>
            <ol className="space-y-2">
              {events.map((e) => {
                const idx = last.trace.findIndex((x) => x.id === e.id);
                return <EventItem key={e.id} e={e} delay={idx >= 0 ? idx : undefined} />;
              })}
            </ol>
          </Panel>
        </>
      )}
    </div>
  );
}

function StateChip({ s, current }: { s: AgentState; current: AgentState }) {
  const active = s === current;
  return (
    <li
      aria-current={active ? "step" : undefined}
      data-active={active}
      className={`rounded border px-2 py-1 ${
        active ? "border-sky-300 bg-sky-800 font-bold text-white" : "border-slate-600 text-slate-300"
      }`}
    >
      {s}
      {active && <span className="sr-only"> (estado actual)</span>}
    </li>
  );
}
