/**
 * Esquema de los datos mock (T02 los escribe en src/core/data/*.json y los exporta
 * como `fixtures` desde src/core/data/index.ts). Incluye integridad referencial y las
 * condiciones que necesita cada escenario de la demo. Dueño: Orquestador.
 */
import { z } from "zod";
import { ScenarioId } from "./agent";
import {
  BaySlot,
  InsuranceOffer,
  Owner,
  Part,
  ServiceRecord,
  TariffItem,
  Vehicle,
} from "./domain";

export const ScenarioFixture = z.object({
  id: ScenarioId,
  titulo: z.string().min(3),
  descripcion: z.string().min(10),
  vehicleId: z.string().min(1),
  /** Mensajes del cliente que la demo envía paso a paso (guion). */
  mensajesGuion: z.array(z.string().min(1)).min(1),
});

/** Hitos de mantenimiento que el tarifario debe cubrir para cada modelo de la demo. */
export const HITOS_REQUERIDOS = [10000, 20000, 30000, 40000] as const;

const modeloKey = (v: { marca: string; modelo: string }) => `${v.marca} ${v.modelo}`;

export const Fixtures = z
  .object({
    owners: z.array(Owner).min(5),
    vehicles: z.array(Vehicle).min(5),
    serviceHistory: z.array(ServiceRecord).min(5),
    parts: z.array(Part).min(5),
    tariffs: z.array(TariffItem).min(10),
    bays: z.array(BaySlot).min(20),
    insurers: z.array(InsuranceOffer).min(2),
    scenarios: z.array(ScenarioFixture).length(5),
  })
  .superRefine((f, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const owners = new Map(f.owners.map((o) => [o.id, o]));
    const vehicles = new Map(f.vehicles.map((v) => [v.id, v]));
    const parts = new Map(f.parts.map((p) => [p.sku, p]));

    for (const v of f.vehicles) if (!owners.has(v.ownerId)) issue(`Vehículo ${v.id}: owner ${v.ownerId} no existe`);
    for (const s of f.serviceHistory) if (!vehicles.has(s.vehicleId)) issue(`Servicio ${s.id}: vehículo no existe`);
    for (const t of f.tariffs)
      for (const r of t.repuestos) if (!parts.has(r.sku)) issue(`Tarifa ${t.id}: sku ${r.sku} no existe`);
    if (f.tariffs.filter((t) => t.esVentaCruzada).length < 3) issue("Faltan ≥ 3 ítems de venta cruzada");
    if (!f.bays.some((b) => b.disponible && b.franja === "valle")) issue("No hay bahías libres en horario valle");
    for (const i of f.insurers)
      if (!/aliad/i.test(i.aseguradora)) issue(`Aseguradora ${i.aseguradora}: usar nombre ficticio «Aliada…»`);

    const ids = new Set(f.scenarios.map((s) => s.id));
    for (const id of ScenarioId.options) if (!ids.has(id)) issue(`Falta el escenario ${id}`);

    for (const sc of f.scenarios) {
      const v = vehicles.get(sc.vehicleId);
      if (!v) {
        issue(`Escenario ${sc.id}: vehículo ${sc.vehicleId} no existe`);
        continue;
      }
      const owner = owners.get(v.ownerId);
      const optIn = owner?.consentimientos.some((c) => c.canal === "whatsapp" && c.optIn) ?? false;
      if (sc.id === "sin_consentimiento" && optIn) issue("sin_consentimiento: el dueño no debe tener opt-in de WhatsApp");
      if (sc.id !== "sin_consentimiento" && !optIn) issue(`${sc.id}: el dueño necesita opt-in de WhatsApp`);

      const key = modeloKey(v);
      const tarifas = f.tariffs.filter((t) => t.modelo === key && !t.esVentaCruzada);
      for (const h of HITOS_REQUERIDOS)
        if (!tarifas.some((t) => t.hitoKm === h)) issue(`Tarifario sin hito ${h} km para ${key}`);
      const algunaSinStock = tarifas.some((t) => t.repuestos.some((r) => (parts.get(r.sku)?.stock ?? 0) === 0));
      if (sc.id === "sin_stock" && !algunaSinStock) issue("sin_stock: algún repuesto del tarifario de ese modelo debe tener stock 0");
      if (sc.id === "feliz" && algunaSinStock) issue("feliz: todos los repuestos de ese modelo deben tener stock");
    }
  });

export type ScenarioFixture = z.infer<typeof ScenarioFixture>;
export type Fixtures = z.infer<typeof Fixtures>;
