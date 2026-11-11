import { describe, expect, it } from "vitest";
import { maskPII, maskPayload } from "@/core/guardrails";

describe("maskPII", () => {
  it.each([
    ["Mi cédula es 1020304050", "1020304050", "cedula"],
    ["CC 52.123.456 a nombre mío", "52.123.456", "cedula"],
    ["documento 123456", "123456", "cedula"],
    ["Escríbeme al 3001234567", "3001234567", "celular"],
    ["Mi celular es +57 300 123 4567", "300 123 4567", "celular"],
    ["llama al +573159876543", "3159876543", "celular"],
    ["correo: laura.g@example.com", "laura.g@example.com", "email"],
    ["Mi placa es ABC123", "ABC123", "placa"],
    ["placa xyz12d", "xyz12d", "placa"],
    ["Carro de placas DEF-456", "DEF-456", "placa"],
    ["Tarjeta 4111 1111 1111 1111", "4111 1111 1111 1111", "tarjeta"],
    ["pago con 4111111111111111", "4111111111111111", "tarjeta"],
  ])("enmascara %s", (texto, dato, tipo) => {
    const { masked, hallazgos } = maskPII(texto);
    expect(masked).not.toContain(dato);
    expect(hallazgos).toContain(tipo);
  });

  it("no enmascara kilometrajes, precios ni monedas", () => {
    const texto = "El de 30.000 km cuesta USD 245 o $1.250.000 COP; el de 100000 km también";
    const { masked, hallazgos } = maskPII(texto);
    expect(masked).toBe(texto);
    expect(hallazgos).toEqual([]);
  });

  it("los hallazgos no contienen el dato original", () => {
    const { hallazgos } = maskPII("cédula 1020304050 y correo a@b.co");
    expect(hallazgos.join(" ")).not.toMatch(/\d|@/);
  });

  it("varios datos en un mismo texto", () => {
    const { masked, hallazgos } = maskPII(
      "Soy CC 1020304050, cel 3001234567, a@b.co, placa ABC12D",
    );
    expect(masked).not.toMatch(/1020304050|3001234567|a@b\.co|ABC12D/);
    expect(new Set(hallazgos)).toEqual(new Set(["cedula", "celular", "email", "placa"]));
  });
});

describe("maskPayload", () => {
  it("enmascara recursivamente strings y campos sensibles por nombre", () => {
    const original = {
      mensaje: "mi cédula es 1020304050",
      nivel: { lista: ["a@b.co", 3, null, { texto: "placa ABC123" }] },
      cliente: { nombre: "Laura Gómez", celular: 3001234567 },
      km: 30000,
      ok: true,
    };
    const out = maskPayload(original);
    const dump = JSON.stringify(out);
    for (const p of ["1020304050", "a@b.co", "ABC123", "Laura Gómez", "3001234567"]) {
      expect(dump).not.toContain(p);
    }
    expect(out.km).toBe(30000);
    expect(out.ok).toBe(true);
    expect(out.nivel.lista[1]).toBe(3);
    // No muta el original.
    expect(original.mensaje).toContain("1020304050");
  });
});
