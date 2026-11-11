"use client";
/**
 * T19 · Consola del asesor: clientes de hoy · conversación de WhatsApp · lo que hizo el agente
 * y lo que necesita su acción. El detalle técnico (Rayos X) queda plegado para el jurado.
 */
import { ChevronRight } from "lucide-react";
import { AdvisorInbox } from "@/ui/advisor";
import { AgentActivity, ClientList, ConsoleHeader } from "@/ui/console";
import { SCENARIOS } from "@/ui/contracts";
import { useDemoSession } from "@/ui/demo";
import { OwnerApp } from "@/ui/owner";
import { XrayConsole } from "@/ui/xray";

export default function Home() {
  const session = useDemoSession();
  const cliente = SCENARIOS.find((s) => s.id === session.scenarioId)?.cliente;
  return (
    <main className="flex min-h-screen flex-col bg-slate-50 xl:h-screen">
      <a
        href="#conversacion"
        className="sr-only z-30 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Saltar a la conversación
      </a>
      <ConsoleHeader session={session} />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-[16rem_minmax(0,1fr)_minmax(0,1fr)]">
        <ClientList session={session} className="min-w-0 md:col-span-2 xl:col-span-1 xl:overflow-y-auto" />

        <section id="conversacion" aria-labelledby="chat-titulo" className="flex min-h-0 min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 id="chat-titulo" className="text-base font-semibold text-slate-900">
              <span translate="no">WhatsApp</span> · {cliente ?? "sin cliente elegido"}
            </h2>
            <p className="text-xs text-slate-600">Así lo ve el cliente</p>
          </div>
          <div className="min-h-0 flex-1">
            <OwnerApp session={session} />
          </div>
        </section>

        <section aria-label="Panel del asesor" className="flex min-w-0 flex-col gap-4 xl:overflow-y-auto">
          <AgentActivity turns={session.turns} cliente={cliente} loading={session.loading} />
          <AdvisorInbox cases={session.cases} onTake={session.takeCase} />
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
