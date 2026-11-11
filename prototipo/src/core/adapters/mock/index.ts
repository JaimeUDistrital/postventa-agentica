/**
 * Adaptadores mock de los puertos (CRM, inventario, tarifario, taller, aseguradoras).
 * Estado en memoria: reservas, casos y franjas ocupadas viven solo en esta instancia.
 */
import type { BaySlot, Booking, Fixtures, HandoffCase } from "@/core/contracts";
import { DEMO_NOW, policy } from "@/core/config";
import type { Ports } from "@/core/ports";

const MS_MIN = 60_000;

/** Suma minutos a un "YYYY-MM-DDTHH:mm" (UTC como reloj de pared, sin zonas). */
function plusMinutes(isoLocal: string, minutes: number): string {
  return new Date(Date.parse(`${isoLocal}:00Z`) + minutes * MS_MIN).toISOString().slice(0, 16);
}

export interface MockOptions {
  /** Hora de la demo; define `holdHasta` de las reservas. Por defecto DEMO_NOW. */
  now?: string;
}

export function createMockPorts(fixtures: Fixtures, opts: MockOptions = {}): Ports {
  const now = opts.now ?? DEMO_NOW;
  const slots: BaySlot[] = fixtures.bays.map((b) => ({ ...b }));
  const bookings = new Map<string, Booking>(); // por idempotencyKey
  const cases: HandoffCase[] = [];
  let seq = 0;

  return {
    crm: {
      getOwner: async (id) => fixtures.owners.find((o) => o.id === id),
      getVehicle: async (id) => fixtures.vehicles.find((v) => v.id === id),
      getServiceHistory: async (vehicleId) => fixtures.serviceHistory.filter((s) => s.vehicleId === vehicleId),
      createCase: async (caso) => {
        cases.push(caso);
        return caso;
      },
    },
    inventory: {
      getPart: async (sku) => fixtures.parts.find((p) => p.sku === sku),
    },
    pricing: {
      getTariff: async (modelo, hitoKm) =>
        fixtures.tariffs.find((t) => !t.esVentaCruzada && t.modelo === modelo && t.hitoKm === hitoKm),
      getTariffById: async (id) => fixtures.tariffs.find((t) => t.id === id),
      getCrossSell: async (modelo) =>
        fixtures.tariffs.filter((t) => t.esVentaCruzada && (t.modelo === modelo || t.modelo === "*")),
    },
    workshop: {
      listSlots: async ({ desde, franja, limite }) =>
        slots
          .filter((s) => s.disponible && s.inicio >= desde && (!franja || s.franja === franja))
          .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.bahia - b.bahia)
          .slice(0, limite ?? slots.length)
          .map((s) => ({ ...s })),
      hold: async (input) => {
        const previa = bookings.get(input.idempotencyKey);
        if (previa) return previa;
        const slot = slots.find((s) => s.id === input.slotId);
        if (!slot) throw new Error(`franja_inexistente: ${input.slotId}`);
        if (!slot.disponible) throw new Error(`franja_no_disponible: ${input.slotId}`);
        slot.disponible = false;
        seq += 1;
        const booking: Booking = {
          id: `bk_${String(seq).padStart(4, "0")}`,
          vehicleId: input.vehicleId,
          slotId: slot.id,
          inicio: slot.inicio,
          bahia: slot.bahia,
          quoteId: input.quoteId,
          repuestosApartados: input.repuestos,
          idempotencyKey: input.idempotencyKey,
          holdHasta: plusMinutes(now, policy.holdReservaMinutos),
          estado: "reservada",
        };
        bookings.set(input.idempotencyKey, booking);
        return booking;
      },
      findByIdempotencyKey: async (key) => bookings.get(key),
    },
    insurers: {
      listOffers: async () => fixtures.insurers.map((i) => ({ ...i })),
    },
  };
}
