import { trmCopUsd } from "@/core/config";

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const miles = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/** USD del contrato → COP con la TRM de config. */
export const formatCop = (valorUsd: number) => cop.format(Math.round(valorUsd * trmCopUsd));
export const formatUsd = (valorUsd: number) => usd.format(valorUsd);
export const formatKm = (km: number) => `${miles.format(km)} km`;

// Fechas "YYYY-MM-DDTHH:mm" en hora local de la agencia. Deterministas: se formatean en UTC, sin la zona del equipo.
const RE_FECHA_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const dia = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const diaCorto = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const hora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });

function aFecha(iso: string): Date | null {
  const m = RE_FECHA_HORA.exec(iso);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi));
}
const con = (f: Intl.DateTimeFormat) => (iso: string): string => {
  const fecha = aFecha(iso);
  return fecha ? f.format(fecha) : iso;
};

const fechaLarga = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** "YYYY-MM-DD" → "15 de enero de 2027". */
export function formatFecha(isoDia: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDia);
  return m ? fechaLarga.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))) : isoDia;
}

/** → "jueves, 12 de noviembre". */
export const formatDia = con(dia);
/** → "jue, 12 de nov". */
export const formatDiaCorto = con(diaCorto);
/** → "9:00 a. m.". */
export const formatHora = con(hora);

/** "YYYY-MM-DDTHH:mm" → "jueves, 12 de noviembre, 9:00 a. m.". */
export function formatFechaHora(iso: string): string {
  return aFecha(iso) ? `${formatDia(iso)}, ${formatHora(iso)}` : iso;
}

const reloj = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Bogota" });

/** T22: instante ISO con zona (p. ej. de `new Date().toISOString()`) → "HH:MM" en hora de Colombia. */
export function formatHoraReloj(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : reloj.format(d);
}
