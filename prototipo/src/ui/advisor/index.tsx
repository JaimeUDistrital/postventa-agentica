"use client";
/** T06 · Bandeja del asesor; T19: «Necesita su acción», tema claro y lenguaje sin jerga. */
import { CircleCheck, Headset, TriangleAlert } from "lucide-react";
import type { HandoffCase, HandoffReason } from "@/core/contracts";
import type { AdvisorInboxProps } from "@/ui/contracts";
import { formatKm } from "@/ui/owner/format";

const MOTIVO: Record<HandoffReason, string> = {
  sintoma_critico: "Riesgo de seguridad en el vehículo",
  sin_stock: "Falta un repuesto",
  adversarial: "Posible intento de fraude",
  garantia: "Consulta de garantía",
  cliente_molesto: "Cliente molesto",
};

const PRIORIDAD: Record<HandoffCase["prioridad"], { label: string; cls: string }> = {
  alta: { label: "Prioridad alta · atender ya", cls: "bg-amber-100 text-amber-900 ring-amber-300" },
  media: { label: "Prioridad media · hoy", cls: "bg-amber-50 text-amber-900 ring-amber-200" },
  baja: { label: "Prioridad baja", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
};

const PESO: Record<HandoffCase["prioridad"], number> = { alta: 0, media: 1, baja: 2 };

/** T20 · B: prioridad (alta > media > baja) y, dentro de la misma, el más reciente primero. */
export function ordenarCasos(cases: HandoffCase[]): HandoffCase[] {
  return [...cases].sort(
    (a, b) => PESO[a.prioridad] - PESO[b.prioridad] || Date.parse(b.creadoEn) - Date.parse(a.creadoEn),
  );
}

function Card({ c, onTake }: { c: HandoffCase; onTake: (id: string) => void }) {
  const p = PRIORIDAD[c.prioridad];
  const taken = c.estado !== "abierto";
  return (
    <article
      data-testid="handoff-card"
      aria-label={`Caso de ${c.contexto.clienteAlias}: ${MOTIVO[c.motivo]}`}
      className={`space-y-2 rounded-xl border p-3 text-sm ${taken ? "border-slate-200 bg-slate-50" : "border-amber-300 bg-amber-50/60"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${p.cls}`}>
          <TriangleAlert aria-hidden className="size-3.5" />
          {p.label}
        </span>
        <span className="font-semibold text-slate-900">{MOTIVO[c.motivo]}</span>
      </div>
      <p className="font-medium text-slate-900">
        {c.contexto.clienteAlias} · {c.contexto.vehiculo}
        <span className="font-normal text-slate-600"> · {formatKm(c.contexto.kmEstimado)}</span>
      </p>
      <dl className="space-y-1 text-slate-800">
        <Row k="Qué pasó" v={c.resumen} />
        {c.contexto.ultimoMensaje && <Row k="El cliente escribió" v={`“${c.contexto.ultimoMensaje}”`} />}
        <Row k="Siguiente paso sugerido" v={c.siguientePasoSugerido} />
      </dl>
      {taken ? (
        <p className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-emerald-800">
          <CircleCheck aria-hidden className="size-4" />
          Caso tomado por usted
        </p>
      ) : null}
      <button
        type="button"
        disabled={taken}
        onClick={() => onTake(c.id)}
        className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
      >
        <Headset aria-hidden className="size-4" />
        Tomar caso
      </button>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-600">{k}</dt>
      <dd className="break-words">{v}</dd>
    </div>
  );
}

export function AdvisorInbox({ cases, onTake }: AdvisorInboxProps) {
  const abiertos = cases.filter((c) => c.estado === "abierto").length;
  return (
    <section
      data-testid="advisor-inbox"
      aria-labelledby="bandeja-titulo"
      className={`space-y-3 rounded-xl border bg-white p-4 ${abiertos ? "border-amber-300" : "border-slate-200"}`}
    >
      <h2 id="bandeja-titulo" className="flex items-center gap-2 text-base font-semibold text-slate-900">
        Necesita su acción
        {abiertos > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-900">
            {abiertos} {abiertos === 1 ? "pendiente" : "pendientes"}
          </span>
        )}
      </h2>
      <div aria-live="polite" className="space-y-3">
        {cases.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-700" />
            Nada pendiente: el agente lo está resolviendo.
          </p>
        ) : (
          ordenarCasos(cases).map((c) => <Card key={c.id} c={c} onTake={onTake} />)
        )}
      </div>
    </section>
  );
}
