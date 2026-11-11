"use client";
/**
 * T22 · 0: aviso del motor de reglas en la columna de la conversación (plegable; se recuerda por visitante).
 * ADR 0007: la IA atiende a todos; «deterministic» significa que se usó el respaldo (Gemini falló,
 * se agotó la cuota o se activó el interruptor).
 */
import { Info } from "lucide-react";
import { useId } from "react";
import type { DemoSession } from "@/ui/contracts";
import { crearPreferencia } from "@/ui/preferencias";

const useAvisoMotor = crearPreferencia("postventa.avisoMotor", "abierto", ["abierto", "plegado"] as const);

export function EngineNotice({ mode }: { mode: DemoSession["mode"] }) {
  const [estado, setEstado] = useAvisoMotor();
  const id = useId();
  if (mode !== "deterministic") return null;
  const boton = "inline-flex min-h-10 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-brand hover:bg-white";
  if (estado === "plegado")
    return (
      <button type="button" aria-expanded={false} onClick={() => setEstado("abierto")} className={`${boton} gap-1.5 self-start`}>
        <Info aria-hidden className="size-4" />
        Ver aviso del motor de reglas
      </button>
    );
  return (
    <div data-testid="aviso-motor" className="flex items-start gap-2 rounded-lg border border-brand/20 bg-brand-soft/60 px-3 py-1.5 text-xs text-slate-700">
      <Info aria-hidden className="mt-2 size-4 shrink-0 text-brand" />
      <p id={id} role="note" className="flex-1 py-1.5">
        <strong className="font-semibold text-slate-900">Motor de reglas (respaldo):</strong> la IA no está disponible en este
        momento. El agente responde a intenciones conocidas por palabras clave y, si no entiende, le pasa el caso a un asesor.
      </p>
      <button type="button" aria-expanded aria-controls={id} onClick={() => setEstado("plegado")} className={boton}>
        Ocultar aviso
      </button>
    </div>
  );
}
