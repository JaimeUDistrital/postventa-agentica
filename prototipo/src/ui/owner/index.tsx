"use client";
/** STUB T00 · T05 lo reemplaza manteniendo `OwnerApp(props: OwnerAppProps)` y los data-testid. */
import { useState } from "react";
import { SCENARIOS, type OwnerAppProps } from "@/ui/contracts";

export function OwnerApp({ session }: OwnerAppProps) {
  const [texto, setTexto] = useState("");
  return (
    <div data-testid="owner-chat" className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            data-testid={`scenario-btn-${s.id}`}
            onClick={() => session.selectScenario(s.id)}
            className="rounded border px-2 py-1 text-sm"
          >
            {s.label}
          </button>
        ))}
        <span data-testid="mode-badge" className="ml-auto text-xs">
          {session.mode ?? "—"}
        </span>
      </div>
      <ul className="flex-1 space-y-2 overflow-auto">
        {session.messages.map((m) => (
          <li key={m.id} className="text-sm">
            <b>{m.rol}:</b> {m.texto}
          </li>
        ))}
      </ul>
      {session.error && <p role="alert">{session.error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          session.send(texto);
          setTexto("");
        }}
        className="flex gap-2"
      >
        <label className="sr-only" htmlFor="mensaje">
          Mensaje
        </label>
        <input id="mensaje" value={texto} onChange={(e) => setTexto(e.target.value)} className="flex-1 rounded border px-2" />
        <button type="submit" disabled={session.loading} className="rounded border px-3">
          Enviar
        </button>
      </form>
    </div>
  );
}
