"use client";
/** STUB T00 · T06 lo reemplaza manteniendo `AdvisorInbox(props: AdvisorInboxProps)` y los data-testid. */
import type { AdvisorInboxProps } from "@/ui/contracts";

export function AdvisorInbox({ cases, onTake }: AdvisorInboxProps) {
  return (
    <div data-testid="advisor-inbox" className="p-4">
      <h2 className="font-semibold">Bandeja del asesor</h2>
      {cases.length === 0 && <p className="text-sm">Sin casos escalados.</p>}
      {cases.map((c) => (
        <article key={c.id} data-testid="handoff-card" className="rounded border p-2 text-sm">
          <p>
            {c.motivo} · {c.prioridad} · {c.estado}
          </p>
          <p>{c.resumen}</p>
          <button onClick={() => onTake(c.id)} className="rounded border px-2">
            Tomar caso
          </button>
        </article>
      ))}
    </div>
  );
}
