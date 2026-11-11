"use client";
/** T19 · «Clientes de hoy»: una tarjeta por escenario con su situación y estado en palabras. */
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  Clock,
  MessageCircle,
  ShieldAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { SCENARIOS, type DemoSession } from "@/ui/contracts";
import { ESTADO_CLIENTE_LABEL, estadoCliente, type EstadoCliente } from "./status";

const ESTILO: Record<EstadoCliente, { icono: LucideIcon; cls: string }> = {
  pendiente: { icono: Clock, cls: "bg-slate-100 text-slate-700" },
  conversando: { icono: MessageCircle, cls: "bg-brand-soft text-brand" },
  cita_apartada: { icono: CalendarClock, cls: "bg-brand-soft text-brand" },
  cita_confirmada: { icono: CalendarCheck, cls: "bg-emerald-50 text-emerald-800" },
  necesita_asesor: { icono: TriangleAlert, cls: "bg-amber-100 text-amber-900" },
  bloqueado: { icono: ShieldAlert, cls: "bg-red-50 text-red-800" },
  sin_permiso: { icono: Ban, cls: "bg-slate-100 text-slate-700" },
};

export function EstadoChip({ estado }: { estado: EstadoCliente }) {
  const { icono: Icono, cls } = ESTILO[estado];
  return (
    <span data-testid="client-status" className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icono aria-hidden className="size-3.5" />
      {ESTADO_CLIENTE_LABEL[estado]}
    </span>
  );
}

export function ClientList({ session, className = "" }: { session: DemoSession; className?: string }) {
  const activo = SCENARIOS.find((s) => s.id === session.scenarioId);
  return (
    <nav aria-labelledby="clientes-titulo" className={className}>
      <h2 id="clientes-titulo" className="mb-2 text-xs font-semibold tracking-wide text-slate-600 uppercase">
        Clientes de hoy
      </h2>
      <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0">
        {SCENARIOS.map((s) => {
          const sel = session.scenarioId === s.id;
          const estado = estadoCliente(session.clients?.[s.id]);
          return (
            <li key={s.id} className="w-60 shrink-0 snap-start xl:w-auto">
              <button
                type="button"
                data-testid={`scenario-btn-${s.id}`}
                aria-pressed={sel}
                onClick={() => session.selectScenario(s.id)}
                className={`flex min-h-10 w-full flex-col items-start gap-1 rounded-xl border bg-white p-3 text-left transition-colors ${
                  sel ? "border-brand ring-2 ring-brand/30" : "border-slate-200 hover:border-slate-400"
                }`}
              >
                <span className="font-semibold text-slate-900">{s.cliente ?? s.label}</span>
                {s.vehiculo && <span className="text-xs text-slate-600">{s.vehiculo}</span>}
                {s.situacion && <span className="text-sm text-slate-800">{s.situacion}</span>}
                <EstadoChip estado={estado} />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {activo ? `${activo.cliente ?? activo.label}: ${ESTADO_CLIENTE_LABEL[estadoCliente(session.clients?.[activo.id])]}` : ""}
      </p>
    </nav>
  );
}
