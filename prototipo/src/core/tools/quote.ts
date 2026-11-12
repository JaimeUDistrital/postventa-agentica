/** Cotización: precios SOLO del tarifario. El id codifica los parámetros para recalcular sin memoria. */
import type { Part, PriceLine, PriceQuote, TariffItem, Vehicle } from "@/core/contracts";
import { policy } from "@/core/config";
import type { Ports } from "@/core/ports";
import { ToolFailure } from "./run";

export interface QuoteParams {
  vehicleId: string;
  hitoKm: number;
  extras: string[];
  descuentoPct: number;
}

export const encodeQuoteId = (p: QuoteParams): string =>
  `q_${p.vehicleId}_${p.hitoKm}_${p.extras.join("+")}_${p.descuentoPct}`;

/**
 * Inverso de encodeQuoteId. Limitación: el id de vehículo no puede contener un
 * segmento numérico de 4+ dígitos entre guiones bajos (se confundiría con el hito).
 */
export function parseQuoteId(id: string): QuoteParams | null {
  const m = /^q_(.+?)_(\d{4,})_(.*)_(\d+(?:\.\d+)?)$/.exec(id);
  if (!m) return null;
  return {
    vehicleId: m[1],
    hitoKm: Number(m[2]),
    extras: m[3] === "" ? [] : m[3].split("+"),
    descuentoPct: Number(m[4]),
  };
}

export function assertDescuento(pct: number): void {
  if (pct > policy.topeDescuentoPct)
    throw new ToolFailure(
      "descuento_fuera_de_politica",
      `Descuento ${pct * 100}% supera el tope de ${policy.topeDescuentoPct * 100}%: bloqueado`,
      "blocked",
    );
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface QuoteBuild {
  quote: PriceQuote;
  vehicle: Vehicle;
  disponibilidad: {
    sku: string;
    descripcion: string;
    requerido: number;
    stock: number;
    disponible: boolean;
    fechaReposicion: string | null;
  }[];
  ventaCruzadaSugerida: { tariffId: string; descripcion: string; precioUsd: number }[];
  /** Horas de taller del mantenimiento más los extras (tarifario). */
  duracionHoras: number;
  /** Repuestos de la cotización con stock insuficiente (para el flujo sin_stock). */
  faltantes: Part[];
}

export const modeloKey = (v: Vehicle): string => `${v.marca} ${v.modelo}`;

async function linesFor(ports: Ports, t: TariffItem): Promise<{ lines: PriceLine[]; parts: Map<string, number> }> {
  const lines: PriceLine[] = [
    { concepto: `Mano de obra: ${t.descripcion}`, sku: null, cantidad: 1, precioUnitarioUsd: t.manoObraUsd, totalUsd: t.manoObraUsd },
  ];
  const parts = new Map<string, number>();
  for (const r of t.repuestos) {
    const part = await ports.inventory.getPart(r.sku);
    if (!part) throw new ToolFailure("repuesto_no_encontrado", `Repuesto ${r.sku} no existe en inventario`);
    lines.push({
      concepto: part.descripcion,
      sku: r.sku,
      cantidad: r.cantidad,
      precioUnitarioUsd: part.precioUsd,
      totalUsd: round2(part.precioUsd * r.cantidad),
    });
    parts.set(r.sku, (parts.get(r.sku) ?? 0) + r.cantidad);
  }
  return { lines, parts };
}

const precioItem = (lines: PriceLine[]): number => round2(lines.reduce((a, l) => a + l.totalUsd, 0));

export async function buildQuote(ports: Ports, p: QuoteParams): Promise<QuoteBuild> {
  assertDescuento(p.descuentoPct);
  const vehicle = await ports.crm.getVehicle(p.vehicleId);
  if (!vehicle) throw new ToolFailure("vehiculo_no_encontrado", `Vehículo ${p.vehicleId} no existe en el CRM`);
  const modelo = modeloKey(vehicle);
  const base = await ports.pricing.getTariff(modelo, p.hitoKm);
  if (!base) throw new ToolFailure("tarifa_no_encontrada", `Sin tarifa para ${modelo} a ${p.hitoKm} km`);

  const crossAll = await ports.pricing.getCrossSell(modelo);
  const extras: TariffItem[] = [];
  for (const id of p.extras) {
    const t = crossAll.find((c) => c.id === id);
    if (!t) throw new ToolFailure("extra_invalido", `El ítem ${id} no es venta cruzada de ${modelo}`);
    extras.push(t);
  }

  const items: PriceLine[] = [];
  const requeridos = new Map<string, number>();
  for (const t of [base, ...extras]) {
    const { lines, parts } = await linesFor(ports, t);
    items.push(...lines);
    parts.forEach((q, sku) => requeridos.set(sku, (requeridos.get(sku) ?? 0) + q));
  }

  const disponibilidad: QuoteBuild["disponibilidad"] = [];
  const faltantes: Part[] = [];
  for (const [sku, requerido] of requeridos) {
    const part = await ports.inventory.getPart(sku);
    if (!part) continue; // ya validado en linesFor
    const disponible = part.stock >= requerido;
    if (!disponible) faltantes.push(part);
    disponibilidad.push({ sku, descripcion: part.descripcion, requerido, stock: part.stock, disponible, fechaReposicion: part.fechaReposicion });
  }

  const subtotalUsd = precioItem(items);
  const sugeridas: QuoteBuild["ventaCruzadaSugerida"] = [];
  // No sugiere lo que el mantenimiento ya incluye (p. ej. pastillas en el de 40.000 km).
  const yaIncluido = (c: TariffItem) => c.repuestos.length > 0 && c.repuestos.every((r) => requeridos.has(r.sku));
  for (const c of crossAll.filter((c) => !p.extras.includes(c.id) && !yaIncluido(c))) {
    sugeridas.push({ tariffId: c.id, descripcion: c.descripcion, precioUsd: precioItem((await linesFor(ports, c)).lines) });
  }

  return {
    vehicle,
    disponibilidad,
    faltantes,
    ventaCruzadaSugerida: sugeridas,
    duracionHoras: round2([base, ...extras].reduce((a, t) => a + t.duracionHoras, 0)),
    quote: {
      id: encodeQuoteId(p),
      vehicleId: p.vehicleId,
      hitoKm: p.hitoKm,
      items,
      subtotalUsd,
      descuentoPct: p.descuentoPct,
      totalUsd: round2(subtotalUsd * (1 - p.descuentoPct)),
      fuente: "tarifario",
    },
  };
}
