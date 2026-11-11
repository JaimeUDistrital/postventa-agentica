"use client";
/** App del propietario: marco de teléfono con chat estilo WhatsApp y tarjetas de respuesta. */
import { Bot, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OwnerAppProps } from "@/ui/contracts";
import { ReplyCardView } from "./cards";

export { ScenarioBar } from "./scenario-bar";

export function OwnerApp({ session }: OwnerAppProps) {
  const [texto, setTexto] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session.messages.length, session.loading]);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || session.loading) return;
    session.send(t);
    setTexto("");
  };

  return (
    <div data-testid="owner-chat" className="flex h-full items-start justify-center p-3 sm:p-5 lg:items-center">
      <div className="flex h-[640px] w-full max-w-[400px] flex-col overflow-hidden rounded-[2rem] border-[6px] border-slate-800 bg-slate-100 shadow-xl lg:h-full lg:max-h-[760px]">
        <div className="flex items-center gap-3 bg-brand px-4 py-3 text-white">
          <span aria-hidden className="grid size-9 place-items-center rounded-full bg-white/15">
            <Bot className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Asistente de Postventa</p>
            <p className="text-xs text-blue-100">{session.loading ? "escribiendo…" : "en línea"}</p>
          </div>
        </div>

        <div ref={scroller} role="log" aria-label="Conversación" aria-live="polite" className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
          {session.messages.length === 0 && (
            <p className="mt-8 text-center text-sm text-slate-600">Elija un escenario arriba para iniciar la conversación.</p>
          )}
          {session.messages.map((m) => (
            <div key={m.id} className={`flex flex-col gap-2 ${m.rol === "cliente" ? "items-end" : m.rol === "sistema" ? "items-center" : "items-start"}`}>
              {m.texto &&
                (m.rol === "sistema" ? (
                  <p className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">{m.texto}</p>
                ) : (
                  <p
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-snug shadow-sm ${
                      m.rol === "cliente" ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-white text-slate-900"
                    }`}
                  >
                    {m.texto}
                  </p>
                ))}
              {m.cards.map((c, i) => (
                <ReplyCardView key={`${m.id}-${i}`} card={c} act={session.act} disabled={session.loading} />
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

        <form onSubmit={enviar} className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white p-2.5">
          <label className="sr-only" htmlFor="mensaje">
            Escriba su mensaje
          </label>
          <input
            id="mensaje"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
            placeholder="Escriba su mensaje"
            className="min-h-10 min-w-0 flex-1 rounded-full border border-slate-300 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-500"
          />
          {session.nextScript && (
            <button
              type="button"
              data-testid="script-next"
              onClick={() => session.nextScript?.()}
              disabled={
                !session.scenarioId || session.loading || (session.scriptStep ?? 0) >= (session.scriptTotal ?? 0)
              }
              className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-brand/40 bg-white px-3 text-xs font-semibold text-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente paso del guion ({session.scriptStep ?? 0}/{session.scriptTotal ?? 0})
            </button>
          )}
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
