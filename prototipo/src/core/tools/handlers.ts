/** Lógica de cada herramienta (sin validación ni traza: eso lo hace runTool). */
import type { BaySlot, HandoffCase } from "@/core/contracts";
import { addDays, addMinutes, daysBetween } from "./dates";
import { estimarKm } from "./estimador";
import { assertDescuento, buildQuote, modeloKey, parseQuoteId } from "./quote";
import { ToolFailure, type Handler } from "./run";
import { policy } from "@/core/config";

/** "Laura Gómez Ruiz" → "Laura G." (nunca nombre completo ni datos de contacto). */
function aliasDe(nombre: string): string {
  const [first, second] = nombre.trim().split(/\s+/);
  return second ? `${first} ${second[0].toUpperCase()}.` : first;
}

export const consultarContexto: Handler<"consultar_contexto_vehiculo"> = async (ctx, { vehicleId }) => {
  const { crm } = ctx.ports;
  const vehicle = await crm.getVehicle(vehicleId);
  if (!vehicle) throw new ToolFailure("vehiculo_no_encontrado", `Vehículo ${vehicleId} no existe en el CRM`);
  const owner = await crm.getOwner(vehicle.ownerId);
  if (!owner) throw new ToolFailure("propietario_no_encontrado", `Propietario ${vehicle.ownerId} no existe en el CRM`);
  const est = estimarKm(vehicle, ctx.now);
  const alias = aliasDe(owner.nombre);
  const historial = await crm.getServiceHistory(vehicleId);
  return {
    output: {
      vehicle,
      clienteAlias: alias,
      consentimientos: owner.consentimientos,
      contactosUltimos30Dias: owner.contactosUltimos30Dias,
      ...est,
      historial,
    },
    summaries: [
      {
        system: "CRM",
        payload: { clienteAlias: alias, ...est, contactosUltimos30Dias: owner.contactosUltimos30Dias },
        detalle: `${alias}: ~${est.kmEstimado} km estimados, hito ${est.proximoHitoKm} km en ${est.diasParaHito} días; ${est.enGarantia ? "en" : "fuera de"} garantía`,
      },
    ],
  };
};

export const verificarStock: Handler<"verificar_stock_y_precio"> = async (ctx, input) => {
  assertDescuento(input.descuentoPct);
  const b = await buildQuote(ctx.ports, input);
  const sinStock = b.faltantes.length;
  return {
    output: {
      disponibilidad: b.disponibilidad,
      todosDisponibles: sinStock === 0,
      cotizacion: b.quote,
      ventaCruzadaSugerida: b.ventaCruzadaSugerida,
    },
    summaries: [
      {
        system: "Inventario",
        payload: { repuestos: b.disponibilidad.length, sinStock, skusSinStock: b.faltantes.map((p) => p.sku) },
        detalle: sinStock === 0 ? `${b.disponibilidad.length} repuestos con stock suficiente` : `${sinStock} repuesto(s) sin stock suficiente`,
      },
      {
        system: "Tarifario",
        payload: { quoteId: b.quote.id, subtotalUsd: b.quote.subtotalUsd, descuentoPct: b.quote.descuentoPct, totalUsd: b.quote.totalUsd },
        detalle: `Cotización ${b.quote.hitoKm} km: total ${b.quote.totalUsd} USD (fuente tarifario)`,
      },
    ],
  };
};

const MAX_ALTERNATIVAS = 3;
const alternativasValle = (ctx: Parameters<Handler<"agendar_bahia_taller">>[0], desde: string): Promise<BaySlot[]> =>
  ctx.ports.workshop.listSlots({ desde, franja: "valle", limite: MAX_ALTERNATIVAS });

export const agendarBahia: Handler<"agendar_bahia_taller"> = async (ctx, input) => {
  const params = parseQuoteId(input.quoteId);
  if (!params || params.vehicleId !== input.vehicleId)
    throw new ToolFailure("quote_id_invalido", `quoteId no decodificable o de otro vehículo: ${input.quoteId}`);
  const { quote, faltantes } = await buildQuote(ctx.ports, params); // recalcula; valida descuento
  const skus = [...new Set(quote.items.flatMap((l) => (l.sku ? [l.sku] : [])))];
  const respuesta = (
    estado: "reservada" | "requiere_confirmacion" | "sin_disponibilidad" | "sin_stock",
    booking: Awaited<ReturnType<typeof ctx.ports.workshop.hold>> | null,
    alternativas: BaySlot[],
    detalle: string,
  ) => ({
    output: { estado, booking, alternativas },
    summaries: [{ system: "Taller" as const, payload: { estado, slotId: booking?.slotId ?? null, alternativas: alternativas.length }, detalle }],
  });

  if (faltantes.length > 0) {
    const repos = faltantes.map((p) => p.fechaReposicion).filter((f): f is string => f !== null);
    const tope = repos.sort().at(-1);
    const desde = tope && tope >= ctx.now.slice(0, 10) ? `${addDays(tope, 1)}T00:00` : ctx.now;
    const alts = await alternativasValle(ctx, desde);
    return respuesta("sin_stock", null, alts, `Sin stock de ${faltantes.map((p) => p.sku).join(", ")}: se proponen ${alts.length} franjas valle tras la reposición`);
  }
  if (!input.confirmadoPorCliente) {
    const alts = await alternativasValle(ctx, ctx.now);
    return respuesta("requiere_confirmacion", null, alts, "Falta confirmación explícita del cliente: no se reserva nada");
  }

  const previa = await ctx.ports.workshop.findByIdempotencyKey(input.idempotencyKey);
  if (previa) return respuesta("reservada", previa, [], `Reserva ya existente para la misma idempotencyKey (${previa.id}): se devuelve sin duplicar`);

  const libres = await ctx.ports.workshop.listSlots({
    desde: ctx.now,
    franja: input.preferencia === "valle" ? "valle" : undefined,
    limite: 1000,
  });
  const slot = input.slotId ? libres.find((s) => s.id === input.slotId) : libres[0];
  if (!slot) {
    const alts = await alternativasValle(ctx, ctx.now);
    return respuesta("sin_disponibilidad", null, alts, input.slotId ? `La franja ${input.slotId} ya no está libre` : "No hay franjas libres");
  }
  const hold = await ctx.ports.workshop.hold({
    vehicleId: input.vehicleId,
    slotId: slot.id,
    quoteId: input.quoteId,
    repuestos: skus,
    idempotencyKey: input.idempotencyKey,
  });
  const booking = { ...hold, holdHasta: addMinutes(ctx.now, policy.holdReservaMinutos) };
  return respuesta("reservada", booking, [], `Reserva ${booking.id} en bahía ${booking.bahia} (${booking.inicio}), hold hasta ${booking.holdHasta}`);
};

export const cotizarSeguros: Handler<"cotizar_aliados_seguros"> = async (ctx, { vehicleId }) => {
  const v = await ctx.ports.crm.getVehicle(vehicleId);
  if (!v) throw new ToolFailure("vehiculo_no_encontrado", `Vehículo ${vehicleId} no existe en el CRM`);
  const ofertas = await ctx.ports.insurers.listOffers(vehicleId);
  const dias = daysBetween(ctx.now, v.vencimientoSoat);
  return {
    output: { vencimientoSoat: v.vencimientoSoat, vencimientoPoliza: v.vencimientoPoliza, diasParaVencimientoSoat: dias, ofertas },
    summaries: [
      {
        system: "Aseguradoras",
        payload: { diasParaVencimientoSoat: dias, ofertas: ofertas.length },
        detalle: `SOAT vence en ${dias} días; ${ofertas.length} ofertas de aseguradoras aliadas`,
      },
    ],
  };
};

const SIGUIENTE_PASO: Record<HandoffCase["motivo"], string> = {
  sintoma_critico: "Llamar al cliente de inmediato y pedirle que no use el vehículo hasta la revisión",
  sin_stock: "Ofrecer fecha de reposición o alternativa de repuesto y agendar cuando llegue",
  adversarial: "Revisar la conversación; no ceder a la petición y responder con la política vigente",
  garantia: "Validar cobertura de garantía con el concesionario antes de prometer nada",
  cliente_molesto: "Contactar al cliente con tono empático y ofrecer una solución concreta",
};

export const escalarAsesor: Handler<"escalar_asesor_humano"> = async (ctx, input) => {
  const { crm } = ctx.ports;
  const v = await crm.getVehicle(input.vehicleId);
  if (!v) throw new ToolFailure("vehiculo_no_encontrado", `Vehículo ${input.vehicleId} no existe en el CRM`);
  const owner = await crm.getOwner(v.ownerId);
  const caso = await crm.createCase({
    id: `HC-${crypto.randomUUID().slice(0, 8)}`,
    motivo: input.motivo,
    prioridad: input.prioridad,
    resumen: input.resumen,
    contexto: {
      clienteAlias: owner ? aliasDe(owner.nombre) : "Cliente",
      vehiculo: `${modeloKey(v)} ${v.anio}`,
      kmEstimado: estimarKm(v, ctx.now).kmEstimado,
      sintomas: input.sintomas,
      ultimoMensaje: input.ultimoMensaje,
    },
    siguientePasoSugerido: SIGUIENTE_PASO[input.motivo],
    trazaIds: input.trazaIds,
    creadoEn: new Date().toISOString(),
    estado: "abierto",
  });
  return {
    output: { caso },
    summaries: [
      {
        system: "CRM",
        payload: { casoId: caso.id, motivo: caso.motivo, prioridad: caso.prioridad },
        detalle: `Caso ${caso.id} abierto en la bandeja del asesor (${caso.motivo}, prioridad ${caso.prioridad})`,
        status: "escalated",
      },
    ],
  };
};
