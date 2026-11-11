"use client";
/** Composición de las 3 zonas. Dueño desde Ola 1: T05 (sin cambiar los imports de T06/T12). */
import { AdvisorInbox } from "@/ui/advisor";
import { useDemoSession } from "@/ui/demo";
import { OwnerApp } from "@/ui/owner";
import { XrayConsole } from "@/ui/xray";

export default function Home() {
  const session = useDemoSession();
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section aria-label="App del propietario" className="border-b lg:border-r lg:border-b-0">
        <OwnerApp session={session} />
      </section>
      <section aria-label="Rayos X del agente y bandeja del asesor" className="flex flex-col">
        <XrayConsole turns={session.turns} />
        <AdvisorInbox cases={session.cases} onTake={session.takeCase} />
      </section>
    </main>
  );
}
