import { describe, expect, it } from "vitest";
import { TraceEvent } from "@/core/contracts";
import { ACCIONES_POLITICA, POLITICA_AUTONOMIA, autorizarAccion } from "@/core/guardrails";

describe("POLITICA_AUTONOMIA", () => {
  it("cubre las 14 acciones con su nivel", () => {
    expect(ACCIONES_POLITICA).toHaveLength(14);
    expect(POLITICA_AUTONOMIA).toMatchObject({
      informar_km: "informar",
      informar_precio: "informar",
      recomendar_paquete: "recomendar",
      recomendar_venta_cruzada: "recomendar",
      reservar_bahia: "ejecutar",
      apartar_repuesto: "ejecutar",
      emitir_ot_preliminar: "ejecutar",
      escalar_asesor: "ejecutar",
      diagnosticar_falla: "prohibido",
      aprobar_garantia: "prohibido",
      descuento_sobre_tope: "prohibido",
      cobrar_sin_confirmacion: "prohibido",
      inventar_precio: "prohibido",
      revelar_pii_terceros: "prohibido",
    });
  });
});

describe("autorizarAccion", () => {
  it("informar y recomendar no exigen confirmación", () => {
    expect(autorizarAccion("informar_precio", { confirmadoPorCliente: false }).permitido).toBe(true);
    expect(autorizarAccion("recomendar_paquete", { confirmadoPorCliente: false }).permitido).toBe(
      true,
    );
  });

  it("ejecutar exige confirmación del cliente", () => {
    const sin = autorizarAccion("reservar_bahia", { confirmadoPorCliente: false });
    expect(sin.permitido).toBe(false);
    expect(sin.trace.status).toBe("blocked");
    expect(sin.motivo).toMatch(/confirm/i);
    expect(autorizarAccion("reservar_bahia", { confirmadoPorCliente: true }).permitido).toBe(true);
  });

  it("escalar_asesor no exige confirmación", () => {
    const r = autorizarAccion("escalar_asesor", { confirmadoPorCliente: false });
    expect(r.permitido).toBe(true);
    expect(r.autonomy).toBe("ejecutar");
  });

  it.each([
    "diagnosticar_falla",
    "aprobar_garantia",
    "descuento_sobre_tope",
    "cobrar_sin_confirmacion",
    "inventar_precio",
    "revelar_pii_terceros",
  ] as const)("prohibido nunca se permite: %s", (accion) => {
    const r = autorizarAccion(accion, { confirmadoPorCliente: true });
    expect(r.permitido).toBe(false);
    expect(r.autonomy).toBe("prohibido");
    expect(r.trace.status).toBe("blocked");
  });

  it("emite una traza de política válida", () => {
    for (const accion of ACCIONES_POLITICA) {
      const { trace, autonomy } = autorizarAccion(accion, { confirmadoPorCliente: false });
      expect(() => TraceEvent.parse(trace)).not.toThrow();
      expect(trace.kind).toBe("policy");
      expect(trace.agent).toBe("Guardián");
      expect(trace.system).toBe("Guardián");
      expect(trace.autonomy).toBe(autonomy);
      expect(trace.detalle).toBeTruthy();
    }
  });
});
