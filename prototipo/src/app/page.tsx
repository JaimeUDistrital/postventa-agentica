"use client";
/** Composición de las 3 zonas. Dueño desde Ola 1: T05 (sin cambiar los imports de T06/T12). */
import { AdvisorInbox } from "@/ui/advisor";
import { useDemoSession } from "@/ui/demo";
import { OwnerApp, ScenarioBar } from "@/ui/owner";
import { XrayConsole } from "@/ui/xray";

export default function Home() {
  const session = useDemoSession();
  return (
    <main className="flex min-h-screen flex-col lg:h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-brand">Postventa Agéntica</h1>
            <p className="text-sm text-slate-600">
              Mantenimiento predictivo con IA, con un humano cuando hace falta
            </p>
          </div>
        </div>
        <ScenarioBar session={session} />
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section
          aria-label="App del propietario"
          className="min-h-0 border-b border-slate-200 bg-slate-100 lg:border-r lg:border-b-0"
        >
          <OwnerApp session={session} />
        </section>
        <section
          aria-label="Rayos X del agente y bandeja del asesor"
          className="flex min-h-0 flex-col lg:overflow-y-auto"
        >
          <XrayConsole turns={session.turns} />
          <AdvisorInbox cases={session.cases} onTake={session.takeCase} />
        </section>
      </div>
    </main>
  );
}
