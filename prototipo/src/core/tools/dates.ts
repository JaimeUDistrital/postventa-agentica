/** Utilidades de fecha en "hora de pared" (sin zonas): trabajan en UTC para ser deterministas. */
const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

const toMs = (d: string): number => Date.parse(d.length === 10 ? `${d}T00:00:00Z` : `${d}:00Z`);

/** Días enteros entre dos fechas (solo cuenta la parte de fecha); negativo si `hasta` es anterior. */
export const daysBetween = (desde: string, hasta: string): number =>
  Math.round((toMs(hasta.slice(0, 10)) - toMs(desde.slice(0, 10))) / DAY_MS);

export const addDays = (fecha: string, dias: number): string =>
  new Date(toMs(fecha.slice(0, 10)) + dias * DAY_MS).toISOString().slice(0, 10);

export const addMinutes = (isoLocal: string, minutos: number): string =>
  new Date(toMs(isoLocal) + minutos * MIN_MS).toISOString().slice(0, 16);
