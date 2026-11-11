/**
 * Tarjetas de la respuesta: se construyen SOLO desde resultados verificados de herramientas
 * de este turno. El total de la cotización se recalcula de forma independiente desde el
 * tarifario para que el Guardián de salida lo compare.
 */
import type { z } from "zod";
import {
  AgendarBahiaOutput,
  ConsultarContextoOutput,
  CotizarSegurosOutput,
  VerificarStockOutput,
  type Booking,
  type PriceQuote,
  type ReplyCard,
  type ToolName,
  type ToolResult,
} from "@/core/contracts";
import type { CardKind, Ports } from "@/core/ports";
import { parseQuoteId } from "@/core/tools";

const round2 = (n: number): number => Math.round(n * 100) / 100;

function salida<T>(rs: ToolResult[], tool: ToolName, schema: z.ZodType<T>): T | undefined {
  const r = rs.filter((x) => x.tool === tool && x.ok).at(-1);
  if (!r) return undefined;
  const p = schema.safeParse(r.output);
  return p.success ? p.data : undefined;
}

export const contextoDe = (rs: ToolResult[]) => salida(rs, "consultar_contexto_vehiculo", ConsultarContextoOutput);
export const cotizacionDe = (rs: ToolResult[]): PriceQuote | undefined =>
  salida(rs, "verificar_stock_y_precio", VerificarStockOutput)?.cotizacion;
export const agendaDe = (rs: ToolResult[]) => salida(rs, "agendar_bahia_taller", AgendarBahiaOutput);

/** Total recalculado desde tarifario + inventario a partir del id de la cotización. */
export async function recalcularTotal(ports: Ports, quote: PriceQuote): Promise<number | undefined> {
  const p = parseQuoteId(quote.id);
  const v = p ? await ports.crm.getVehicle(p.vehicleId) : undefined;
  if (!p || !v) return undefined;
  const base = await ports.pricing.getTariff(`${v.marca} ${v.modelo}`, p.hitoKm);
  if (!base) return undefined;
  let subtotal = 0;
  for (const id of [base.id, ...p.extras]) {
    const t = id === base.id ? base : await ports.pricing.getTariffById(id);
    if (!t) return undefined;
    subtotal += t.manoObraUsd;
    for (const r of t.repuestos) {
      const part = await ports.inventory.getPart(r.sku);
      if (!part) return undefined;
      subtotal += round2(part.precioUsd * r.cantidad);
    }
  }
  return round2(round2(subtotal) * (1 - p.descuentoPct));
}

export interface Tarjetas {
  cards: ReplyCard[];
  /** Tarjetas pedidas sin resultado verificado que las respalde (no se muestran). */
  sinRespaldo: CardKind[];
  booking?: Booking;
}

/** `confirmada`: el cliente confirmó explícitamente en este turno (acción o texto). */
export function construirTarjetas(showCards: CardKind[], rs: ToolResult[], confirmada: boolean): Tarjetas {
  const cards: ReplyCard[] = [];
  const sinRespaldo: CardKind[] = [];
  let booking: Booking | undefined;
  for (const kind of [...new Set(showCards)]) {
    const card = tarjeta(kind, rs, confirmada);
    if (!card) sinRespaldo.push(kind);
    else {
      cards.push(card);
      if (card.type === "reserva") booking = card.booking;
    }
  }
  return { cards, sinRespaldo, booking };
}

function tarjeta(kind: CardKind, rs: ToolResult[], confirmada: boolean): ReplyCard | undefined {
  switch (kind) {
    case "alerta_km": {
      const c = contextoDe(rs);
      return c && { type: "alerta_km", kmEstimado: c.kmEstimado, proximoHitoKm: c.proximoHitoKm, diasParaHito: c.diasParaHito };
    }
    case "cotizacion": {
      const q = cotizacionDe(rs);
      return q && { type: "cotizacion", quote: q };
    }
    case "reserva": {
      const a = agendaDe(rs);
      if (a?.estado !== "reservada" || !a.booking) return undefined;
      return { type: "reserva", booking: confirmada ? { ...a.booking, estado: "confirmada" } : a.booking };
    }
    case "alternativas": {
      const a = agendaDe(rs);
      if (!a || a.estado === "reservada" || a.alternativas.length === 0) return undefined;
      const motivo =
        a.estado === "sin_stock"
          ? "Un repuesto está agotado: estas franjas son posteriores a su reposición."
          : "Estas son las franjas libres más cercanas en horario valle.";
      return { type: "alternativas", slots: a.alternativas, motivo };
    }
    case "seguro": {
      const s = salida(rs, "cotizar_aliados_seguros", CotizarSegurosOutput);
      return s && { type: "seguro", ofertas: s.ofertas };
    }
  }
}
