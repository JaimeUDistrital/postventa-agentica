import { trmCopUsd } from "@/core/config";

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const miles = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/** USD del contrato → COP con la TRM de config. */
export const formatCop = (valorUsd: number) => cop.format(Math.round(valorUsd * trmCopUsd));
export const formatUsd = (valorUsd: number) => usd.format(valorUsd);
export const formatKm = (km: number) => `${miles.format(km)} km`;

/** "YYYY-MM-DDTHH:mm" (hora local) → "jueves 12 de noviembre, 9:00 a. m.". Determinista: sin zona horaria del equipo. */
export function formatFechaHora(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const dia = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(date);
  const hora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(date);
  return `${dia}, ${hora}`;
}
