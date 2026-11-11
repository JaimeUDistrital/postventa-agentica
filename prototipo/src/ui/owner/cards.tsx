"use client";
import { CalendarCheck, CircleCheck, Gauge, Headset, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { useId, type ReactNode } from "react";
import type { InsuranceOffer, PriceQuote, ReplyCard, UserAction } from "@/core/contracts";
import { parseQuoteId } from "@/core/tools/quote";
import { formatCop, formatFechaHora, formatKm, formatUsd } from "./format";

interface Props {
  card: ReplyCard;
  act: (accion: UserAction) => void;
  disabled?: boolean;
  /** T20: ya hay una tarjeta accionable más reciente; esta no ofrece botones (evita bucles). */
  anterior?: boolean;
  /** T22: envía un mensaje normal del cliente (elegir un seguro). */
  send?: (texto: string) => void;
  /** T22: la cotización ofrece «Ver seguros» mientras no haya una tarjeta de seguros en la conversación. */
  ofrecerSeguros?: boolean;
  /** T22 · 4b: la tarjeta de seguros ya no admite elección (se eligió una opción o hay otra más reciente). */
  seguro?: { cerrada: boolean; elegida: number | null };
}

/** T22 · 4b: texto del mensaje del cliente al elegir la oferta n (1, 2, 3…). */
export const textoEleccionSeguro = (n: number, o: Pick<InsuranceOffer, "aseguradora" | "producto">): string =>
  `Quiero la opción ${n}: ${o.aseguradora} · ${o.producto}`;
export const RE_ELECCION_SEGURO = /^Quiero la opción (\d+):/;

/** Tarjetas con botones de acción: solo la más reciente de la conversación los muestra (T20 · A2). */
export const TARJETAS_ACCIONABLES: ReadonlySet<ReplyCard["type"]> = new Set(["cotizacion", "reserva"]);

/**
 * T20 · A1: la cotización incluye un paquete de venta cruzada (VC-PAS-01, VC-BAT-01, VC-ALI-01).
 * Se lee del id de la cotización, que codifica los extras; la alineación no tiene SKU en sus líneas.
 */
export const incluyePaquete = (q: PriceQuote): boolean => (parseQuoteId(q.id)?.extras.length ?? 0) > 0;

function NotaAnterior({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{children}</p>;
}

const base = "w-full rounded-2xl border bg-white p-3.5 text-sm shadow-sm";
const btnPrimario =
  "inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60";
const btnSecundario =
  "inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-brand/40 bg-white px-4 text-sm font-semibold text-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60";
const btnTerciario =
  "inline-flex min-h-10 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-brand underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60";

function Titulo({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
      <span aria-hidden className="text-brand">
        {icono}
      </span>
      {children}
    </h3>
  );
}

export function ReplyCardView({ card, act, disabled, anterior = false, send, ofrecerSeguros = false, seguro }: Props) {
  switch (card.type) {
    case "alerta_km":
      return (
        <article aria-label="Alerta de kilometraje" data-testid="card-alerta_km" className="w-full rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Gauge aria-hidden className="size-4" />
            Su vehículo se acerca al mantenimiento
          </h3>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Dato etiqueta="Km estimado" valor={formatKm(card.kmEstimado)} />
            <Dato etiqueta="Próximo hito" valor={formatKm(card.proximoHitoKm)} />
            <Dato etiqueta="Días restantes" valor={`${card.diasParaHito}`} />
          </dl>
        </article>
      );
    case "cotizacion": {
      const q = card.quote;
      const conPaquete = incluyePaquete(q);
      return (
        <article aria-label="Cotización" data-testid="card-cotizacion" className={base + " border-slate-200"}>
          <Titulo icono={<Clock className="size-4" />}>Cotización de {formatKm(q.hitoKm)}</Titulo>
          {conPaquete && (
            <p
              data-testid="paquete-incluido"
              className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"
            >
              <CircleCheck aria-hidden className="size-3.5" />
              Paquete de desgaste incluido
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {q.items.map((l, i) => (
              <li key={`${l.sku ?? l.concepto}-${i}`} className="flex justify-between gap-3 py-1.5">
                <span className="text-slate-700">
                  {l.concepto}
                  {l.cantidad > 1 && <span className="text-slate-500"> × {l.cantidad}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-slate-900">{formatCop(l.totalUsd)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1 border-t border-slate-200 pt-2">
            <Fila etiqueta="Subtotal" valor={formatCop(q.subtotalUsd)} />
            {q.descuentoPct > 0 && (
              <Fila etiqueta={`Descuento (${Math.round(q.descuentoPct * 100)} %)`} valor={`− ${formatCop(q.subtotalUsd - q.totalUsd)}`} />
            )}
            <div className="flex items-baseline justify-between pt-1">
              <dt className="font-semibold text-slate-900">Total</dt>
              <dd className="text-right">
                <span data-testid="cotizacion-total" className="text-lg font-bold tabular-nums text-brand">
                  {formatCop(q.totalUsd)}
                </span>
                <span className="block text-xs text-slate-600">{formatUsd(q.totalUsd)} USD</span>
              </dd>
            </div>
          </dl>
          {anterior ? (
            <NotaAnterior>Cotización anterior · use la más reciente de la conversación.</NotaAnterior>
          ) : (
            <div className="mt-3 grid gap-2">
              <button type="button" disabled={disabled} onClick={() => act("aceptar_mantenimiento")} className={btnPrimario}>
                Agendar
              </button>
              {conPaquete ? (
                <button type="button" disabled={disabled} onClick={() => act("rechazar_venta_cruzada")} className={btnSecundario}>
                  Quitar paquete
                </button>
              ) : (
                <button type="button" disabled={disabled} onClick={() => act("agregar_venta_cruzada")} className={btnSecundario}>
                  Agregar paquete de desgaste
                </button>
              )}
              {ofrecerSeguros && (
                <button type="button" disabled={disabled} onClick={() => act("ver_seguros")} className={btnTerciario}>
                  Ver seguros
                </button>
              )}
            </div>
          )}
        </article>
      );
    }
    case "reserva": {
      const b = card.booking;
      const confirmada = b.estado === "confirmada";
      return (
        <article aria-label="Reserva" data-testid="card-reserva" className={base + " border-slate-200"}>
          <Titulo icono={<CalendarCheck className="size-4" />}>{confirmada ? "Reserva confirmada" : "Reserva pendiente de confirmar"}</Titulo>
          <p className="font-medium text-slate-900 first-letter:uppercase">{formatFechaHora(b.inicio)}</p>
          <p className="text-slate-600">Bahía {b.bahia} · Referencia {b.id}</p>
          {!confirmada &&
            (anterior ? (
              <NotaAnterior>Reserva anterior · use la tarjeta más reciente de la conversación.</NotaAnterior>
            ) : (
              <>
                <p className="mt-1 text-xs text-slate-600">Apartamos su cupo hasta {formatFechaHora(b.holdHasta)}.</p>
                <button type="button" disabled={disabled} onClick={() => act("confirmar_reserva")} className={btnPrimario + " mt-3"}>
                  Confirmar reserva
                </button>
              </>
            ))}
        </article>
      );
    }
    case "alternativas":
      return (
        <article aria-label="Horarios alternativos" data-testid="card-alternativas" className={base + " border-slate-200"}>
          <Titulo icono={<CalendarCheck className="size-4" />}>Otros horarios disponibles</Titulo>
          <p className="mb-2 text-slate-700">{card.motivo}</p>
          <ul className="space-y-1">
            {card.slots.map((s) => (
              <li key={s.id} className="rounded-lg bg-slate-50 px-3 py-2 text-slate-800">
                <span className="first-letter:uppercase">{formatFechaHora(s.inicio)}</span>
                <span className="text-slate-500"> · Bahía {s.bahia}</span>
              </li>
            ))}
          </ul>
        </article>
      );
    case "seguro":
      return (
        <SeguroCard
          ofertas={card.ofertas}
          send={send}
          disabled={disabled || !!seguro?.cerrada}
          elegida={seguro?.elegida ?? null}
        />
      );
    case "handoff":
      return (
        <article aria-label="Atención por un asesor" data-testid="card-handoff" className="w-full rounded-2xl border border-brand/30 bg-brand-soft p-3.5 text-sm shadow-sm">
          <Titulo icono={<Headset className="size-4" />}>Un asesor humano tomará su caso</Titulo>
          <p className="text-slate-800">{card.mensaje}</p>
          <p className="mt-1 text-xs text-slate-600">Caso {card.casoId}</p>
        </article>
      );
    case "bloqueo":
      return (
        <article aria-label="Solicitud no atendida" data-testid="card-bloqueo" className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3.5 text-sm shadow-sm">
          <Titulo icono={<ShieldAlert className="size-4" />}>No podemos continuar con esta solicitud</Titulo>
          <p className="text-slate-700">{card.motivo}</p>
        </article>
      );
  }
}

/** T22 · 4b: ofertas numeradas; nunca se muestra `comisionAgenciaUsd` (es interna de la agencia). */
function SeguroCard({
  ofertas,
  send,
  disabled,
  elegida,
}: {
  ofertas: InsuranceOffer[];
  send?: (texto: string) => void;
  disabled?: boolean;
  elegida: number | null;
}) {
  const idBase = useId();
  return (
    <article aria-label="Seguros" data-testid="card-seguro" className={base + " border-slate-200"}>
      <Titulo icono={<ShieldCheck className="size-4" />}>Seguros para su vehículo</Titulo>
      <ol className="space-y-2">
        {ofertas.map((o, i) => {
          const n = i + 1;
          const id = `${idBase}-${n}`;
          return (
            <li key={o.id} className="flex gap-2.5 rounded-lg bg-slate-50 px-3 py-2">
              <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                {n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3">
                  <span id={id} className="font-medium text-slate-900">
                    {o.aseguradora} · {o.producto}
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-brand">{formatCop(o.primaAnualUsd)}/año</span>
                </div>
                <p className="text-xs text-slate-600">{o.coberturaResumen}</p>
                {elegida === n && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">
                    <CircleCheck aria-hidden className="size-3.5" />
                    Elegida
                  </p>
                )}
                {send && (
                  <button
                    type="button"
                    aria-describedby={id}
                    disabled={disabled}
                    onClick={() => send(textoEleccionSeguro(n, o))}
                    className={btnSecundario + " mt-2"}
                  >
                    Elegir este seguro
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg bg-white/70 px-1 py-1.5">
      <dt className="text-[11px] text-amber-900">{etiqueta}</dt>
      <dd className="font-bold tabular-nums">{valor}</dd>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between text-slate-700">
      <dt>{etiqueta}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}
