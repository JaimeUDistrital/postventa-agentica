"use client";
/** T19 · «Qué hizo el agente»: lista cronológica en lenguaje humano. */
import { Ban, CircleAlert, CircleCheck, Hand, ShieldAlert, UserRoundCheck, type LucideIcon } from "lucide-react";
import type { AgentTurn } from "@/core/contracts";
import { RESULTADO_LABEL, resumirActividad, type Resultado } from "./activity";

const ESTILO: Record<Resultado, { icono: LucideIcon; icls: string; cls: string }> = {
  listo: { icono: CircleCheck, icls: "text-emerald-700", cls: "bg-emerald-50 text-emerald-800" },
  atencion: { icono: CircleAlert, icls: "text-amber-700", cls: "bg-amber-100 text-amber-900" },
  asesor: { icono: UserRoundCheck, icls: "text-amber-700", cls: "bg-amber-100 text-amber-900" },
  bloqueado: { icono: ShieldAlert, icls: "text-red-700", cls: "bg-red-50 text-red-800" },
  pausado: { icono: Hand, icls: "text-slate-600", cls: "bg-slate-100 text-slate-700" },
  error: { icono: Ban, icls: "text-red-700", cls: "bg-red-50 text-red-800" },
};

export function AgentActivity({ turns, cliente, loading }: { turns: AgentTurn[]; cliente?: string; loading: boolean }) {
  const items = resumirActividad(turns);
  return (
    <section aria-labelledby="actividad-titulo" data-testid="agent-activity" className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 id="actividad-titulo" className="text-base font-semibold text-slate-900">
        Qué hizo el agente
      </h2>
      {cliente && <p className="text-xs text-slate-600">Con {cliente}</p>}
      <div aria-live="polite" className="mt-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-600">
            {loading ? "El agente está trabajando…" : "Elija un cliente para ver lo que hizo el agente."}
          </p>
        ) : (
          <ol className="space-y-2">
            {items.map((a) => {
              const { icono: Icono, icls, cls } = ESTILO[a.resultado];
              return (
                <li key={a.id} data-testid="activity-item" className="flex items-start gap-2 text-sm">
                  <Icono aria-hidden className={`mt-0.5 size-4 shrink-0 ${icls}`} />
                  <span className="min-w-0 flex-1 text-slate-800">
                    {a.texto}
                    {a.veces > 1 && <span className="text-slate-600"> ({a.veces} veces)</span>}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
                    {RESULTADO_LABEL[a.resultado]}
                  </span>
                </li>
              );
            })}
            {loading && <li className="text-sm text-slate-600">El agente está trabajando…</li>}
          </ol>
        )}
      </div>
    </section>
  );
}
