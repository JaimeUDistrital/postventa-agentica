"use client";
/** T19 · «¿Cómo funciona?»: panel propio (sin diálogos nativos), se cierra con Esc o «Cerrar». */
import { CircleHelp, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const FRASES = [
  "El agente vigila el kilometraje de cada vehículo y escribe por WhatsApp solo a los clientes que dieron permiso.",
  "Cotiza únicamente con los precios del tarifario de la agencia.",
  "Si detecta un riesgo de seguridad, un posible fraude o falta un repuesto, le pasa el caso a usted.",
  "Usted revisa el caso y decide el siguiente paso.",
];

export function HowItWorks() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const tituloId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const cerrarBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cerrarBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const cerrar = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50"
      >
        <CircleHelp aria-hidden className="size-4 text-brand" />
        ¿Cómo funciona?
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={tituloId}
          className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-lg"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 id={tituloId} className="text-base font-semibold text-slate-900">
              Cómo funciona
            </h2>
            <button
              ref={cerrarBtn}
              type="button"
              onClick={cerrar}
              aria-label="Cerrar «Cómo funciona»"
              className="-mt-1 -mr-1 inline-grid size-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5">
            {FRASES.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-600">Pulse Esc para cerrar.</p>
        </div>
      )}
    </div>
  );
}
