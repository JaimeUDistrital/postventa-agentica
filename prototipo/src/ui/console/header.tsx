"use client";
/** T19 · Cabecera de la consola: título, 3 pasos, ayuda, motor, código del jurado y reinicio. T20: Demo guiada / Modo libre. */
import { Bot, Cog, RotateCcw } from "lucide-react";
import type { DemoMode, DemoSession } from "@/ui/contracts";
import { HowItWorks } from "./how-it-works";

const PASOS = ["Elija un cliente", "Vea la conversación", "Atienda lo que el agente le pase"] as const;
const MODOS: readonly [DemoMode, string][] = [
  ["guiada", "Demo guiada"],
  ["libre", "Modo libre"],
];

/** Paso actual: sin cliente → 1; conversación en curso → 2; hay un caso abierto → 3. */
export function pasoActual(session: Pick<DemoSession, "scenarioId" | "cases">): 1 | 2 | 3 {
  if (session.cases.some((c) => c.estado === "abierto")) return 3;
  return session.scenarioId ? 2 : 1;
}

export function modoLabel(mode: DemoSession["mode"]): string {
  if (mode === "llm") return "IA Gemini activa";
  if (mode === "deterministic") return "Motor: reglas";
  return "En espera";
}

export function ConsoleHeader({ session }: { session: DemoSession }) {
  const paso = pasoActual(session);
  const modo = modoLabel(session.mode);
  const Icono = session.mode === "llm" ? Bot : Cog;
  const guiada = session.demoMode !== "libre";
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-lg font-bold tracking-tight text-slate-900">
          <span translate="no" className="text-brand">
            Postventa Agéntica
          </span>{" "}
          <span className="font-semibold text-slate-700">· Consola del asesor</span>
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {session.accessCodeActive && (
            <span data-testid="access-code-note" className="text-xs text-slate-600">
              Código del jurado activo
            </span>
          )}
          {session.setDemoMode && (
            <div role="group" aria-label="Modo de la demo" className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5">
              {MODOS.map(([id, texto]) => {
                const sel = (session.demoMode ?? "guiada") === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => session.setDemoMode?.(id)}
                    className={`min-h-9 rounded-md px-3 text-sm font-medium ${
                      sel ? "bg-white text-brand shadow-sm" : "text-slate-700 hover:bg-white/60 hover:text-slate-900"
                    }`}
                  >
                    {texto}
                  </button>
                );
              })}
            </div>
          )}
          <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700">
            <Icono aria-hidden className="size-4" />
            <span className="sr-only">Motor del agente: </span>
            <span data-testid="mode-badge">{modo}</span>
          </span>
          <HowItWorks />
          <button
            type="button"
            onClick={() => session.reset()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50"
          >
            <RotateCcw aria-hidden className="size-4" />
            Reiniciar
          </button>
        </div>
      </div>
      {guiada && (
        <ol aria-label="Pasos para usar la consola" className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {PASOS.map((texto, i) => {
            const n = i + 1;
            const activo = n === paso;
            return (
              <li
                key={texto}
                aria-current={activo ? "step" : undefined}
                data-testid={`paso-${n}`}
                className={`flex items-center gap-2 ${activo ? "font-semibold text-brand" : "text-slate-600"}`}
              >
                <span
                  aria-hidden
                  className={`grid size-6 place-items-center rounded-full text-xs font-bold tabular-nums ${
                    activo ? "bg-brand text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {n}
                </span>
                {texto}
                {activo && <span className="sr-only"> (paso actual)</span>}
              </li>
            );
          })}
        </ol>
      )}
    </header>
  );
}
