/**
 * Precios de Gemini por 1M de tokens (USD). Fuente: https://aistudio.google.com/docs/pricing
 * (consultada 2026-11-11, PLAN.md §2). Nivel de pago, texto.
 */
export interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
}

export interface PricingEntry {
  fuente: string;
  consultadoEl: string;
  vigente: ModelPrice;
  /** Si el precio cambia en una fecha, desde ella (ISO `YYYY-MM-DD`) rige `despues`. */
  cambiaEl?: string;
  despues?: ModelPrice;
}

const FUENTE = "https://aistudio.google.com/docs/pricing";

export const MODEL_PRICING: Record<string, PricingEntry> = {
  "gemini-3.5-flash-lite": {
    fuente: FUENTE,
    consultadoEl: "2026-11-11",
    vigente: { inputPerM: 0.3, outputPerM: 2.5 },
  },
  "gemini-3.6-flash": {
    fuente: FUENTE,
    consultadoEl: "2026-11-11",
    vigente: { inputPerM: 0.75, outputPerM: 3.75 },
    // USD 0,75 / 3,75 hasta 2026-12-31; desde 2027 USD 1,50 / 7,50 (PLAN.md §2).
    cambiaEl: "2027-01-01",
    despues: { inputPerM: 1.5, outputPerM: 7.5 },
  },
};

/** Precio aplicable a `model` en la fecha `isoDate`; `undefined` si el modelo no está en la tabla. */
export function priceFor(model: string, isoDate: string): ModelPrice | undefined {
  const e = MODEL_PRICING[model];
  if (!e) return undefined;
  if (e.cambiaEl && e.despues && isoDate.slice(0, 10) >= e.cambiaEl) return e.despues;
  return e.vigente;
}

/** Costo estimado en USD (8 decimales). Modelo desconocido → 0 (se marca en la traza). */
export function estimateCostUsd(model: string, isoDate: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model, isoDate);
  if (!p) return 0;
  const usd = (inputTokens * p.inputPerM + outputTokens * p.outputPerM) / 1_000_000;
  return Math.round(usd * 1e8) / 1e8;
}
