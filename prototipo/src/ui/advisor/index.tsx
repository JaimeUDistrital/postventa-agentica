"use client";
/** T06 · Bandeja del asesor; T19: «Necesita su acción», tema claro y lenguaje sin jerga. T22: responder y llamar. */
import { CircleCheck, Headset, Phone, Send, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import type { HandoffCase, HandoffReason } from "@/core/contracts";
import { ASESOR_DEMO, RESULTADO_LLAMADA_LABEL, type AdvisorInboxProps, type ResultadoLlamada } from "@/ui/contracts";
import { formatKm } from "@/ui/owner/format";

const MOTIVO: Record<HandoffReason, string> = {
  sintoma_critico: "Riesgo de seguridad en el vehículo",
  sin_stock: "Falta un repuesto",
  adversarial: "Posible intento de fraude",
  garantia: "Consulta de garantía",
  cliente_molesto: "Cliente molesto",
  seguro: "Quiere contratar un seguro",
  no_resuelto: "El agente no pudo resolver",
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

const MAX_RESPUESTA = 1000;
const MAX_NOTA_LLAMADA = 200;
const RESULTADOS = Object.keys(RESULTADO_LLAMADA_LABEL) as ResultadoLlamada[];
const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 sm:text-sm placeholder:text-slate-500";
const btnAccion =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-brand/40 bg-white px-4 text-sm font-semibold text-brand hover:bg-brand-soft";

/** T22 · 2: lo que el asesor hace en un caso tomado (todo queda en la conversación del cliente). */
function AccionesAsesor({ id, onReply, onCall }: { id: string } & Pick<AdvisorInboxProps, "onReply" | "onCall">) {
  const uid = useId();
  const [respuesta, setRespuesta] = useState("");
  const [resultado, setResultado] = useState<ResultadoLlamada>("contesto");
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState("");

  const responder = (e: React.FormEvent) => {
    e.preventDefault();
    const t = respuesta.trim();
    if (!t || !onReply) return;
    onReply(id, t);
    setRespuesta("");
    setAviso("Respuesta enviada al cliente.");
  };
  const registrar = (e: React.FormEvent) => {
    e.preventDefault();
    onCall?.(id, resultado, nota.trim());
    setNota("");
    setAviso("Llamada registrada en la conversación.");
  };

  return (
    <div className="space-y-3 border-t border-slate-200 pt-3">
      {onReply && (
        <form onSubmit={responder} className="space-y-1.5">
          <label htmlFor={`${uid}-respuesta`} className="block text-xs font-semibold text-slate-700">
            Responder como asesor
          </label>
          <textarea
            id={`${uid}-respuesta`}
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            maxLength={MAX_RESPUESTA}
            rows={2}
            placeholder={`Escriba como ${ASESOR_DEMO}…`}
            className={campo}
          />
          <button type="submit" className={btnAccion}>
            <Send aria-hidden className="size-4" />
            Enviar respuesta
          </button>
        </form>
      )}
      {onCall && (
        <form onSubmit={registrar} className="space-y-1.5">
          <fieldset>
            <legend className="text-xs font-semibold text-slate-700">Resultado de la llamada</legend>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {RESULTADOS.map((r) => (
                <label key={r} className="inline-flex min-h-10 items-center gap-1.5 text-sm text-slate-800">
                  <input
                    type="radio"
                    name={`${uid}-resultado`}
                    value={r}
                    checked={resultado === r}
                    onChange={() => setResultado(r)}
                    className="size-4 accent-brand"
                  />
                  {RESULTADO_LLAMADA_LABEL[r]}
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor={`${uid}-nota`} className="block text-xs font-semibold text-slate-700">
            Nota de la llamada
          </label>
          <input
            id={`${uid}-nota`}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={MAX_NOTA_LLAMADA}
            autoComplete="off"
            placeholder="Opcional, p. ej. «Lo llevan en grúa»"
            className={campo}
          />
          <button type="submit" className={btnAccion}>
            <Phone aria-hidden className="size-4" />
            Registrar llamada
          </button>
        </form>
      )}
      <p role="status" className="text-xs text-emerald-800">
        {aviso}
      </p>
    </div>
  );
}

function Card({ c, onTake, onReply, onCall }: { c: HandoffCase } & Pick<AdvisorInboxProps, "onTake" | "onReply" | "onCall">) {
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
      {taken && (onReply || onCall) && <AccionesAsesor id={c.id} onReply={onReply} onCall={onCall} />}
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

export function AdvisorInbox({ cases, onTake, onReply, onCall }: AdvisorInboxProps) {
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
          ordenarCasos(cases).map((c) => <Card key={c.id} c={c} onTake={onTake} onReply={onReply} onCall={onCall} />)
        )}
      </div>
    </section>
  );
}
