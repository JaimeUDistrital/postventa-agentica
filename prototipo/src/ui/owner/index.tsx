"use client";
/** App del propietario: marco de teléfono con chat estilo WhatsApp y tarjetas de respuesta. */
import { Bot, EyeOff, Headset, Phone, Play, Send } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ASESOR_DEMO, type ChatMessage, type OwnerAppProps } from "@/ui/contracts";
import { RE_ELECCION_SEGURO, ReplyCardView, TARJETAS_ACCIONABLES } from "./cards";

/** Igual que `AgentRequest.message` (máx. 1000): la API rechaza con 400 los mensajes más largos. */
const MAX_MENSAJE = 1000;

/**
 * T22 · 4b: estado de cada tarjeta de seguros. Solo la más reciente admite elegir, y se cierra en cuanto
 * el cliente elige («Quiero la opción N: …») o llega una tarjeta de handoff (el caso ya va a un asesor).
 */
function estadoSeguros(messages: ChatMessage[]) {
  const out = new Map<string, { cerrada: boolean; elegida: number | null }>();
  let ultima = "";
  messages.forEach((m, idx) =>
    m.cards.forEach((c, i) => {
      if (c.type !== "seguro") return;
      ultima = `${m.id}-${i}`;
      let elegida: number | null = null;
      let handoff = false;
      for (const d of messages.slice(idx + 1)) {
        const r = d.rol === "cliente" ? RE_ELECCION_SEGURO.exec(d.texto) : null;
        if (r && elegida === null) elegida = Number(r[1]);
        if (d.cards.some((x) => x.type === "handoff")) handoff = true;
      }
      out.set(ultima, { cerrada: elegida !== null || handoff, elegida });
    }),
  );
  for (const [k, v] of out) if (k !== ultima) out.set(k, { ...v, cerrada: true });
  return out;
}

/** T22 · 3: nota del sistema (el cliente no la ve). La de consentimiento conserva su texto de T20. */
const tituloNota = (m: ChatMessage) =>
  !m.evento || m.evento === "consentimiento" ? "Nota interna · no se envió nada al cliente" : "Nota interna · el cliente no la ve";

function Mensaje({ m }: { m: ChatMessage }) {
  if (m.rol === "sistema")
    return (
      <div
        role="note"
        data-testid="nota-interna"
        className="w-full max-w-[90%] rounded-lg border border-dashed border-slate-400 bg-slate-200/70 px-3 py-2 text-center text-xs text-slate-700"
      >
        <p className="flex items-center justify-center gap-1.5 font-semibold text-slate-800">
          <EyeOff aria-hidden className="size-3.5" />
          {tituloNota(m)}
        </p>
        <p className="mt-0.5">{m.texto}</p>
      </div>
    );
  if (m.rol === "asesor" && m.evento === "llamada")
    return (
      <p
        data-testid="evento-llamada"
        className="inline-flex max-w-[90%] items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-center text-xs text-emerald-900"
      >
        <Phone aria-hidden className="size-3.5 shrink-0" />
        {m.texto}
      </p>
    );
  if (m.rol === "asesor")
    return (
      <div
        data-testid="mensaje-asesor"
        className="max-w-[85%] rounded-2xl rounded-bl-sm border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm leading-snug text-emerald-950 shadow-sm"
      >
        <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
          <Headset aria-hidden className="size-3.5" />
          Asesor · {m.autor ?? ASESOR_DEMO}
        </p>
        <p>{m.texto}</p>
      </div>
    );
  if (m.rol === "cliente")
    return (
      <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3.5 py-2 text-sm leading-snug text-white shadow-sm">
        <span className="sr-only">Cliente: </span>
        {m.texto}
      </p>
    );
  return <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-sm leading-snug text-slate-900 shadow-sm">{m.texto}</p>;
}

export function OwnerApp({ session }: OwnerAppProps) {
  const [texto, setTexto] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const ayudaId = useId();

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session.messages.length, session.loading]);

  // T20 · A2: solo la tarjeta accionable más reciente conserva sus botones.
  let ultimaAccionable = "";
  for (const m of session.messages)
    m.cards.forEach((c, i) => {
      if (TARJETAS_ACCIONABLES.has(c.type)) ultimaAccionable = `${m.id}-${i}`;
    });

  const seguros = estadoSeguros(session.messages);
  const haySeguro = seguros.size > 0;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || session.loading) return;
    session.send(t);
    setTexto("");
  };

  return (
    <div data-testid="owner-chat" className="flex h-full items-start justify-center">
      <div className="flex h-[640px] w-full max-w-[400px] flex-col overflow-hidden rounded-[2rem] border-[6px] border-slate-800 bg-slate-100 shadow-xl xl:h-full xl:max-h-[760px]">
        <div className="flex items-center gap-3 bg-brand px-4 py-3 text-white">
          <span aria-hidden className="grid size-9 place-items-center rounded-full bg-white/15">
            <Bot className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Asistente de Postventa</p>
            <p className="text-xs text-blue-100">
              {session.aiPaused ? `Le atiende ${ASESOR_DEMO} (asesor)` : session.loading ? "escribiendo…" : "en línea"}
            </p>
          </div>
        </div>

        <div ref={scroller} role="log" aria-label="Conversación" aria-live="polite" className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
          {session.messages.length === 0 && (
            <p className="mt-8 text-center text-sm text-slate-600">Elija un cliente de la lista para ver la conversación.</p>
          )}
          {session.messages.map((m) => (
            <div
              key={m.id}
              data-autor={m.rol === "agente" ? "ia" : m.rol}
              className={`flex flex-col gap-2 ${
                m.rol === "cliente" ? "items-end" : m.rol === "sistema" || m.evento === "llamada" ? "items-center" : "items-start"
              }`}
            >
              {m.rol === "agente" && (
                <p className="-mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <Bot aria-hidden className="size-3.5" />
                  <span data-testid="autor-ia">IA</span>
                </p>
              )}
              {m.texto && <Mensaje m={m} />}
              {m.cards.map((c, i) => (
                <ReplyCardView
                  key={`${m.id}-${i}`}
                  card={c}
                  act={session.act}
                  send={session.send}
                  disabled={session.loading || !!session.aiPaused}
                  anterior={TARJETAS_ACCIONABLES.has(c.type) && `${m.id}-${i}` !== ultimaAccionable}
                  ofrecerSeguros={!haySeguro}
                  seguro={seguros.get(`${m.id}-${i}`)}
                />
              ))}
            </div>
          ))}
          {session.loading && (
            <p data-testid="typing" className="inline-block rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-sm text-slate-600 shadow-sm">
              escribiendo…
            </p>
          )}
        </div>

        {session.error && (
          <p role="alert" className="border-t border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {session.error}
          </p>
        )}

        {session.nextScript && session.demoMode !== "libre" && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 bg-brand-soft px-2.5 py-2">
            <button
              type="button"
              data-testid="script-next"
              aria-describedby={ayudaId}
              onClick={() => session.nextScript?.()}
              disabled={
                !session.scenarioId || session.loading || (session.scriptStep ?? 0) >= (session.scriptTotal ?? 0)
              }
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700"
            >
              <Play aria-hidden className="size-4" />
              Siguiente mensaje del cliente
              <span className="tabular-nums font-normal">
                ({session.scriptStep ?? 0}/{session.scriptTotal ?? 0})
              </span>
            </button>
            <p id={ayudaId} className="text-xs text-slate-700">
              Simula lo que escribe el cliente
            </p>
          </div>
        )}

        <form onSubmit={enviar} className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white p-2.5">
          <label className="sr-only" htmlFor="mensaje">
            Escriba su mensaje
          </label>
          <input
            id="mensaje"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
            maxLength={MAX_MENSAJE}
            placeholder="Escriba como si fuera el cliente…"
            className="min-h-10 min-w-0 flex-1 rounded-full border border-slate-300 bg-slate-50 px-4 text-base text-slate-900 sm:text-sm placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={session.loading}
            aria-label="Enviar mensaje"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            <Send aria-hidden className="size-4" />
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
