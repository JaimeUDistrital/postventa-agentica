"use client";
/** T06 · Bandeja del asesor: casos escalados por el agente. */
import type { HandoffCase, HandoffReason } from "@/core/contracts";
import type { AdvisorInboxProps } from "@/ui/contracts";

const MOTIVO: Record<HandoffReason, string> = {
  sintoma_critico: "Síntoma crítico",
  sin_stock: "Repuesto sin stock",
  adversarial: "Intento de manipulación",
  garantia: "Consulta de garantía",
  cliente_molesto: "Cliente molesto",
};

const PRIORIDAD: Record<HandoffCase["prioridad"], { label: string; cls: string }> = {
  alta: { label: "Prioridad alta", cls: "border-red-500 bg-red-900 text-red-100" },
  media: { label: "Prioridad media", cls: "border-amber-500 bg-amber-900 text-amber-100" },
  baja: { label: "Prioridad baja", cls: "border-emerald-500 bg-emerald-900 text-emerald-100" },
};

/** Fecha determinista (sin zona del navegador): ISO recortado a «YYYY-MM-DD HH:mm». */
function fmtDate(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

function Card({ c, onTake }: { c: HandoffCase; onTake: (id: string) => void }) {
  const p = PRIORIDAD[c.prioridad];
  const taken = c.estado !== "abierto";
  return (
    <article
      data-testid="handoff-card"
      aria-label={`Caso ${c.id}`}
      className="space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${p.cls}`}>{p.label}</span>
        <span className="font-semibold">{MOTIVO[c.motivo]}</span>
        <span className="ml-auto text-xs text-slate-300">
          {taken ? "Tomado" : "Abierto"} · {fmtDate(c.creadoEn)}
        </span>
      </div>
      <p>{c.resumen}</p>
      <dl className="space-y-0.5 text-xs">
        <Row k="Cliente" v={c.contexto.clienteAlias} />
        <Row k="Vehículo" v={c.contexto.vehiculo} />
        <Row k="Km estimado" v={`${c.contexto.kmEstimado} km`} />
        <Row k="Síntomas" v={c.contexto.sintomas.length ? c.contexto.sintomas.join(", ") : "ninguno"} />
        <Row k="Último mensaje" v={c.contexto.ultimoMensaje || "—"} />
        <Row k="Siguiente paso sugerido" v={c.siguientePasoSugerido} />
      </dl>
      <button
        type="button"
        disabled={taken}
        onClick={() => onTake(c.id)}
        className="rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
      >
        Tomar caso
      </button>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-slate-400">{k}:</dt>
      <dd className="break-words">{v}</dd>
    </div>
  );
}

export function AdvisorInbox({ cases, onTake }: AdvisorInboxProps) {
  return (
    <div data-testid="advisor-inbox" className="min-h-full space-y-3 bg-slate-950 p-4 text-slate-100">
      <h2 className="text-base font-semibold">Bandeja del asesor</h2>
      {cases.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-600 p-4 text-sm text-slate-300">
          Sin casos escalados por ahora. Cuando el agente derive uno, aparecerá aquí.
        </p>
      ) : (
        cases.map((c) => <Card key={c.id} c={c} onTake={onTake} />)
      )}
    </div>
  );
}
