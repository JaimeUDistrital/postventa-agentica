"use client";
/** STUB T00 · T06 lo reemplaza manteniendo `XrayConsole(props: XrayConsoleProps)` y los data-testid. */
import type { XrayConsoleProps } from "@/ui/contracts";

export function XrayConsole({ turns }: XrayConsoleProps) {
  const last = turns.at(-1);
  return (
    <div data-testid="xray-console" className="p-4">
      <h2 className="font-semibold">Rayos X del agente</h2>
      <ol className="space-y-1 text-xs">
        {turns.flatMap((t) =>
          t.trace.map((e) => (
            <li key={e.id} data-testid="trace-event">
              [{e.agent} · {e.system}] {e.name} · {e.status}
            </li>
          )),
        )}
      </ol>
      <pre data-testid="memory-panel" className="mt-2 text-xs">
        {last ? JSON.stringify(last.memory, null, 2) : "Sin memoria aún"}
      </pre>
    </div>
  );
}
