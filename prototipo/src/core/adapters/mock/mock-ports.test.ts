import { describe, expect, it } from "vitest";
import { createMockPorts } from "./index";
import { testFixtures } from "./test-fixtures";

const holdInput = (slotId: string, key = "idem-0001") => ({
  vehicleId: "v_cx30",
  slotId,
  quoteId: "q_x",
  repuestos: ["P-ACE"],
  idempotencyKey: key,
});

describe("createMockPorts", () => {
  it("CRM e inventario devuelven datos y undefined si no existen", async () => {
    const p = createMockPorts(testFixtures());
    expect((await p.crm.getVehicle("v_cx30"))?.marca).toBe("Mazda");
    expect(await p.crm.getVehicle("nada")).toBeUndefined();
    expect((await p.inventory.getPart("P-BAT"))?.stock).toBe(0);
    expect(await p.crm.getServiceHistory("v_cx30")).toHaveLength(1);
  });

  it("getCrossSell devuelve solo ventas cruzadas del modelo o '*'", async () => {
    const p = createMockPorts(testFixtures());
    const ids = (await p.pricing.getCrossSell("Mazda CX-30")).map((t) => t.id).sort();
    expect(ids).toEqual(["t_alineacion", "t_frenos"]);
    expect((await p.pricing.getCrossSell("Renault Duster")).map((t) => t.id)).toEqual(["t_alineacion"]);
  });

  it("getTariff ignora ítems de venta cruzada", async () => {
    const p = createMockPorts(testFixtures());
    expect((await p.pricing.getTariff("Mazda CX-30", 10000))?.id).toBe("t_cx30_10000");
  });

  it("listSlots filtra por franja, disponibilidad y fecha", async () => {
    const p = createMockPorts(testFixtures());
    const s = await p.workshop.listSlots({ desde: "2026-11-12T09:00", franja: "valle", limite: 2 });
    expect(s.map((x) => x.id)).toEqual(["b2", "b4"]);
  });

  it("hold marca la franja como no disponible", async () => {
    const p = createMockPorts(testFixtures());
    const bk = await p.workshop.hold(holdInput("b2"));
    expect(bk.estado).toBe("reservada");
    expect(bk.holdHasta).toBe("2026-11-12T09:15");
    const libres = await p.workshop.listSlots({ desde: "2026-11-12T00:00" });
    expect(libres.some((x) => x.id === "b2")).toBe(false);
  });

  it("hold es idempotente por idempotencyKey", async () => {
    const p = createMockPorts(testFixtures());
    const a = await p.workshop.hold(holdInput("b2"));
    const b = await p.workshop.hold(holdInput("b4"));
    expect(b).toEqual(a);
    expect(await p.workshop.findByIdempotencyKey("idem-0001")).toEqual(a);
  });

  it("hold con franja ocupada o inexistente lanza error", async () => {
    const p = createMockPorts(testFixtures());
    await expect(p.workshop.hold(holdInput("b3"))).rejects.toThrow(/no_disponible/);
    await expect(p.workshop.hold(holdInput("zzz", "idem-0002"))).rejects.toThrow(/inexistente/);
  });

  it("createCase guarda y devuelve el caso", async () => {
    const p = createMockPorts(testFixtures());
    const caso = {
      id: "c1", motivo: "sin_stock" as const, prioridad: "media" as const, resumen: "r",
      contexto: { clienteAlias: "Laura G.", vehiculo: "Mazda CX-30 2023", kmEstimado: 1, sintomas: [], ultimoMensaje: "" },
      siguientePasoSugerido: "x", trazaIds: [], creadoEn: "2026-11-12T09:00:00.000Z", estado: "abierto" as const,
    };
    expect(await p.crm.createCase(caso)).toEqual(caso);
  });
});
