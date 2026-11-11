/**
 * Contratos del dominio (datos de CRM, inventario, tarifario, taller y aseguradoras).
 * Dueño: Orquestador. Ningún sub-agente los cambia sin pasar por él (PLAN.md §4).
 * Montos en USD; la UI del propietario los muestra en COP con la TRM de config.
 */
import { z } from "zod";

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha YYYY-MM-DD");
export const IsoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha-hora YYYY-MM-DDTHH:mm (hora local)");

export const Canal = z.enum(["whatsapp", "email", "sms"]);

export const Consent = z.object({
  canal: Canal,
  optIn: z.boolean(),
  fecha: IsoDate,
  finalidad: z.string().min(3),
});

export const Owner = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  cedula: z.string().min(5),
  celular: z.string().min(7),
  email: z.string().email(),
  ciudad: z.string().min(1),
  consentimientos: z.array(Consent),
  contactosUltimos30Dias: z.number().int().nonnegative(),
});

export const Vehicle = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  placa: z.string().min(5),
  marca: z.string().min(1),
  modelo: z.string().min(1),
  anio: z.number().int().min(2000).max(2030),
  fechaEntrega: IsoDate,
  kmUltimoRegistro: z.number().int().nonnegative(),
  fechaUltimoRegistro: IsoDate,
  kmPromedioDia: z.number().positive(),
  garantiaFabricaHasta: IsoDate,
  vencimientoSoat: IsoDate,
  vencimientoPoliza: IsoDate.nullable(),
});

export const ServiceRecord = z.object({
  id: z.string().min(1),
  vehicleId: z.string().min(1),
  fecha: IsoDate,
  km: z.number().int().nonnegative(),
  servicio: z.string().min(1),
  enAgencia: z.boolean(),
  valorUsd: z.number().nonnegative(),
});

export const Part = z.object({
  sku: z.string().min(1),
  descripcion: z.string().min(1),
  /** Claves "Marca Modelo" compatibles, p. ej. "Mazda CX-30". */
  compatibles: z.array(z.string().min(1)).min(1),
  stock: z.number().int().nonnegative(),
  precioUsd: z.number().positive(),
  fechaReposicion: IsoDate.nullable(),
});

export const TariffItem = z.object({
  id: z.string().min(1),
  /** Clave "Marca Modelo", igual que en Part.compatibles. */
  modelo: z.string().min(1),
  hitoKm: z.number().int().positive(),
  descripcion: z.string().min(1),
  manoObraUsd: z.number().nonnegative(),
  repuestos: z.array(z.object({ sku: z.string().min(1), cantidad: z.number().int().positive() })),
  duracionHoras: z.number().positive(),
  /** Paquete opcional de venta cruzada (frenos, llantas, batería, alineación). */
  esVentaCruzada: z.boolean().default(false),
});

export const BaySlot = z.object({
  id: z.string().min(1),
  bahia: z.number().int().positive(),
  inicio: IsoDateTime,
  fin: IsoDateTime,
  disponible: z.boolean(),
  franja: z.enum(["valle", "pico"]),
});

export const InsuranceOffer = z.object({
  id: z.string().min(1),
  aseguradora: z.string().min(1),
  producto: z.enum(["SOAT", "Todo riesgo", "Responsabilidad civil"]),
  primaAnualUsd: z.number().positive(),
  coberturaResumen: z.string().min(1),
  comisionAgenciaUsd: z.number().nonnegative(),
});

export const PriceLine = z.object({
  concepto: z.string().min(1),
  sku: z.string().nullable(),
  cantidad: z.number().positive(),
  precioUnitarioUsd: z.number().nonnegative(),
  totalUsd: z.number().nonnegative(),
});

export const PriceQuote = z.object({
  id: z.string().min(1),
  vehicleId: z.string().min(1),
  hitoKm: z.number().int().positive(),
  items: z.array(PriceLine).min(1),
  subtotalUsd: z.number().nonnegative(),
  descuentoPct: z.number().min(0).max(1),
  totalUsd: z.number().nonnegative(),
  fuente: z.literal("tarifario"),
});

export const Booking = z.object({
  id: z.string().min(1),
  vehicleId: z.string().min(1),
  slotId: z.string().min(1),
  inicio: IsoDateTime,
  bahia: z.number().int().positive(),
  quoteId: z.string().min(1),
  repuestosApartados: z.array(z.string()),
  idempotencyKey: z.string().min(8),
  holdHasta: IsoDateTime,
  estado: z.enum(["reservada", "confirmada"]),
});

export type Consent = z.infer<typeof Consent>;
export type Owner = z.infer<typeof Owner>;
export type Vehicle = z.infer<typeof Vehicle>;
export type ServiceRecord = z.infer<typeof ServiceRecord>;
export type Part = z.infer<typeof Part>;
export type TariffItem = z.infer<typeof TariffItem>;
export type BaySlot = z.infer<typeof BaySlot>;
export type InsuranceOffer = z.infer<typeof InsuranceOffer>;
export type PriceLine = z.infer<typeof PriceLine>;
export type PriceQuote = z.infer<typeof PriceQuote>;
export type Booking = z.infer<typeof Booking>;
