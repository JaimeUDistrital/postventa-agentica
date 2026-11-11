"use client";
/**
 * T20 · «Agenda del taller»: cupos de las bahías (bays.json) con las citas de esta demo encima.
 * Solo se importa bays.json (sin PII); el nombre y el vehículo salen de SCENARIOS, como en «Clientes de hoy».
 */
import { CalendarCheck, CalendarClock } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { BaySlot } from "@/core/contracts";
import baysData from "@/core/data/bays.json";
import { SCENARIOS, type DemoBooking } from "@/ui/contracts";
import { formatDia, formatDiaCorto, formatHora } from "@/ui/owner/format";

const CUPOS = z.array(BaySlot).parse(baysData);
const DIAS = [...new Set(CUPOS.map((s) => s.inicio.slice(0, 10)))].sort();
const BAHIAS = [...new Set(CUPOS.map((s) => s.bahia))].sort((a, b) => a - b);
const fecha = (iso: string) => iso.slice(0, 10);
const citasTexto = (n: number) => `${n} ${n === 1 ? "cita" : "citas"}`;

export function WorkshopAgenda({ bookings }: { bookings: DemoBooking[] }) {
  const [elegido, setElegido] = useState<string | null>(null);
  // Sin elección del usuario, abre el día de la última cita de la demo (o el primero).
  const ultima = bookings.at(-1);
  const dia = elegido ?? (ultima ? fecha(ultima.booking.inicio) : DIAS[0]);
  const porCupo = new Map(bookings.map((b) => [b.booking.slotId, b]));
  const cupos = CUPOS.filter((s) => fecha(s.inicio) === dia);
  const horas = [...new Set(cupos.map((s) => s.inicio))].sort();

  return (
    <section aria-labelledby="agenda-titulo" data-testid="workshop-agenda" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <h2 id="agenda-titulo" className="text-base font-semibold text-slate-900">
          Agenda del taller
        </h2>
        <p className="text-xs text-slate-600">
          Cupos de las {BAHIAS.length} bahías. Las citas de esta demo aparecen resaltadas; «Ocupado» son citas de otros clientes.
        </p>
      </div>

      <div role="group" aria-label="Día de la agenda" className="flex flex-wrap gap-1.5">
        {DIAS.map((d) => {
          const sel = d === dia;
          const n = bookings.filter((b) => fecha(b.booking.inicio) === d).length;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={sel}
              onClick={() => setElegido(d)}
              className={`inline-flex min-h-10 flex-col items-center justify-center rounded-lg border px-2.5 py-1 text-xs ${
                sel ? "border-brand bg-brand-soft font-semibold text-brand" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <span className="first-letter:uppercase">{formatDiaCorto(`${d}T00:00`)}</span>
              {n > 0 && <span className="font-semibold text-brand">{citasTexto(n)}</span>}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] table-fixed border-collapse text-xs">
          <caption className="mb-2 text-left text-sm font-semibold text-slate-900 first-letter:uppercase">
            {formatDia(`${dia}T00:00`)}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-24 p-1 text-left font-semibold text-slate-600">
                Hora
              </th>
              {BAHIAS.map((b) => (
                <th key={b} scope="col" className="p-1 text-left font-semibold text-slate-600">
                  Bahía {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horas.map((inicio) => {
              const fila = cupos.filter((s) => s.inicio === inicio);
              return (
                <tr key={inicio} className="align-top">
                  <th scope="row" className="p-1 text-left font-medium whitespace-nowrap text-slate-700">
                    {formatHora(inicio)}
                    <span className="block font-normal text-slate-500">a {formatHora(fila[0]?.fin ?? inicio)}</span>
                  </th>
                  {BAHIAS.map((b) => {
                    const cupo = fila.find((s) => s.bahia === b);
                    const cita = cupo ? porCupo.get(cupo.id) : undefined;
                    return (
                      <td key={b} className="p-1">
                        {!cupo ? (
                          <span className="text-slate-500">Sin cupo</span>
                        ) : cita ? (
                          <Cita cita={cita} />
                        ) : cupo.disponible ? (
                          <span className="block rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-800">Libre</span>
                        ) : (
                          <span className="block rounded-md bg-slate-100 px-2 py-1.5 text-slate-600">Ocupado</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cita({ cita }: { cita: DemoBooking }) {
  const s = SCENARIOS.find((x) => x.id === cita.scenarioId);
  const confirmada = cita.booking.estado === "confirmada";
  const Icono = confirmada ? CalendarCheck : CalendarClock;
  return (
    <div
      data-testid="agenda-cita"
      className={`rounded-md border-2 px-2 py-1.5 ${confirmada ? "border-emerald-600 bg-emerald-50" : "border-brand bg-brand-soft"}`}
    >
      <p className="font-semibold break-words text-slate-900">{s?.cliente ?? s?.label ?? cita.scenarioId}</p>
      {s?.vehiculo && <p className="break-words text-slate-700">{s.vehiculo}</p>}
      <p className="break-all text-slate-600">Ref. {cita.booking.id}</p>
      <p className={`mt-1 inline-flex items-center gap-1 font-semibold ${confirmada ? "text-emerald-800" : "text-brand"}`}>
        <Icono aria-hidden className="size-3.5" />
        {confirmada ? "Confirmada" : "Reservada"}
      </p>
    </div>
  );
}
