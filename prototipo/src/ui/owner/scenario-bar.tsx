"use client";
import { CheckCircle2, RotateCcw, TriangleAlert } from "lucide-react";
import { SCENARIOS, type OwnerAppProps } from "@/ui/contracts";

const MODOS = { deterministic: "Determinista", llm: "Gemini" } as const;

/** Barra de escenarios de 1 clic, insignia de modo y reinicio. */
export function ScenarioBar({ session }: OwnerAppProps) {
  const modo = session.mode ? MODOS[session.mode] : "—";
  return (
    <nav aria-label="Escenarios de la demo" className="mt-3 flex flex-wrap items-center gap-2">
      {SCENARIOS.map((s) => {
        const activo = session.scenarioId === s.id;
        const feliz = s.tipo === "feliz";
        const Icono = feliz ? CheckCircle2 : TriangleAlert;
        const tono = feliz
          ? activo
            ? "border-brand bg-brand text-white"
            : "border-brand/40 bg-white text-brand hover:bg-brand-soft"
          : activo
            ? "border-amber-700 bg-amber-100 text-amber-950"
            : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100";
        return (
          <button
            key={s.id}
            type="button"
            data-testid={`scenario-btn-${s.id}`}
            aria-pressed={activo}
            aria-label={`${s.label} (${feliz ? "caso feliz" : "caso de falla"})`}
            onClick={() => session.selectScenario(s.id)}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${tono}`}
          >
            <Icono aria-hidden className="size-4" />
            {s.label}
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-2">
        {session.accessCodeActive && (
          <span data-testid="access-code-note" className="text-xs text-slate-600">
            Código del jurado activo
          </span>
        )}
        <span
          data-testid="mode-badge"
          aria-label={`Modo del agente: ${modo}`}
          className="inline-flex min-h-10 items-center rounded-full bg-slate-100 px-3 text-xs font-semibold tracking-wide text-slate-700 uppercase"
        >
          {modo}
        </span>
        <button
          type="button"
          onClick={() => session.reset()}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw aria-hidden className="size-4" />
          Reiniciar demo
        </button>
      </div>
    </nav>
  );
}
