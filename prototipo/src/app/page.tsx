"use client";
/**
 * T19 · Consola del asesor: clientes de hoy · conversación de WhatsApp · lo que hizo el agente
 * y lo que necesita su acción. El detalle técnico (Rayos X) queda plegado para el jurado.
 * T20: en xl la consola ocupa el alto visible y cada columna tiene su propio scroll;
 * la columna central alterna «Conversación» y «Agenda del taller» (pestañas).
 * T22: aviso del motor de reglas, pestaña «Auditoría» y acciones del asesor en el caso tomado.
 */
import { ChevronRight } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { AdvisorInbox } from "@/ui/advisor";
import { WorkshopAgenda } from "@/ui/agenda";
import { AuditTimeline } from "@/ui/audit";
import { AgentActivity, ClientList, ConsoleHeader, EngineNotice } from "@/ui/console";
import { SCENARIOS } from "@/ui/contracts";
import { useDemoSession } from "@/ui/demo";
import { OwnerApp } from "@/ui/owner";
import { XrayConsole } from "@/ui/xray";

const VISTAS = [
  ["chat", "Conversación"],
  ["agenda", "Agenda del taller"],
  ["auditoria", "Auditoría"],
] as const;
type Vista = (typeof VISTAS)[number][0];
const TECLAS: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_i, n) => n - 1,
};

export default function Home() {
  const session = useDemoSession();
  const cliente = SCENARIOS.find((s) => s.id === session.scenarioId)?.cliente;
  const [vista, setVista] = useState<Vista>("chat");
  const pestanas = useRef<Partial<Record<Vista, HTMLButtonElement | null>>>({});
  const citas = session.bookings?.length ?? 0;

  // Pestañas accesibles: flechas izquierda/derecha (e Inicio/Fin) cambian de pestaña y mueven el foco.
  const teclaPestana = (ev: KeyboardEvent<HTMLButtonElement>) => {
    const mover = TECLAS[ev.key];
    if (!mover) return;
    ev.preventDefault();
    const v = VISTAS[mover(VISTAS.findIndex(([x]) => x === vista), VISTAS.length)][0];
    setVista(v);
    pestanas.current[v]?.focus();
  };

  return (
    <main className="flex min-h-dvh flex-col bg-slate-50 xl:h-dvh xl:overflow-hidden">
      <a
        href="#conversacion"
        className="sr-only z-30 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Saltar a la conversación
      </a>
      <ConsoleHeader session={session} />
      <div
        data-testid="console-grid"
        className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-[16rem_minmax(0,1fr)_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]"
      >
        <ClientList session={session} className="min-w-0 md:col-span-2 xl:col-span-1 xl:min-h-0 xl:overflow-y-auto xl:p-1" />

        <section
          id="conversacion"
          aria-label="Conversación y agenda del taller"
          className="flex min-w-0 flex-col gap-2 xl:min-h-0 xl:overflow-y-auto xl:p-1"
        >
          <div role="tablist" aria-label="Vista central" className="flex gap-1 border-b border-slate-200">
            {VISTAS.map(([v, texto]) => {
              const sel = vista === v;
              return (
                <button
                  key={v}
                  ref={(el) => {
                    pestanas.current[v] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`pestana-${v}`}
                  aria-selected={sel}
                  aria-controls={`panel-${v}`}
                  tabIndex={sel ? 0 : -1}
                  onClick={() => setVista(v)}
                  onKeyDown={teclaPestana}
                  className={`-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold ${
                    sel ? "border-brand text-brand" : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {texto}
                  {v === "agenda" && (
                    <span
                      data-testid="agenda-contador"
                      className={`rounded-full px-1.5 text-xs tabular-nums ${citas ? "bg-brand text-white" : "bg-slate-100 text-slate-700"}`}
                    >
                      {citas}
                      <span className="sr-only"> {citas === 1 ? "cita" : "citas"} de la demo</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id="panel-chat"
            aria-labelledby="pestana-chat"
            hidden={vista !== "chat"}
            className={vista === "chat" ? "flex min-h-0 flex-1 flex-col gap-2" : "hidden"}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 id="chat-titulo" className="text-base font-semibold text-slate-900">
                <span translate="no">WhatsApp</span> · {cliente ?? "sin cliente elegido"}
              </h2>
              <p className="text-xs text-slate-600">Así lo ve el cliente</p>
            </div>
            <EngineNotice mode={session.mode} />
            <div className="min-h-0 flex-1">
              <OwnerApp session={session} />
            </div>
          </div>

          <div
            role="tabpanel"
            id="panel-agenda"
            aria-labelledby="pestana-agenda"
            hidden={vista !== "agenda"}
            className={vista === "agenda" ? "min-h-0 flex-1" : "hidden"}
          >
            <WorkshopAgenda bookings={session.bookings ?? []} />
          </div>

          <div
            role="tabpanel"
            id="panel-auditoria"
            aria-labelledby="pestana-auditoria"
            hidden={vista !== "auditoria"}
            className={vista === "auditoria" ? "min-h-0 flex-1" : "hidden"}
          >
            <AuditTimeline scenarioId={session.scenarioId} cliente={cliente} messages={session.messages} turns={session.turns} />
          </div>
        </section>

        <section aria-label="Panel del asesor" className="flex min-w-0 flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:p-1">
          <AgentActivity turns={session.turns} cliente={cliente} loading={session.loading} />
          <AdvisorInbox cases={session.cases} onTake={session.takeCase} onReply={session.replyAsAdvisor} onCall={session.logCall} />
          <details className="group rounded-xl border border-slate-200 bg-white">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
              Ver detalle técnico (para el jurado)
            </summary>
            <div className="overflow-hidden rounded-b-xl">
              <XrayConsole turns={session.turns} />
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
