import { describe, expect, it } from "vitest";
import { hitoTarifario } from "./planner-determinista";

describe("hitoTarifario", () => {
  it("devuelve el hito exacto hasta 60.000 km", () => {
    expect(hitoTarifario(10000)).toBe(10000);
    expect(hitoTarifario(40000)).toBe(40000);
    expect(hitoTarifario(50000)).toBe(50000);
    expect(hitoTarifario(60000)).toBe(60000);
  });

  it("por encima de 60.000 km aplica el ciclo de 4 hitos", () => {
    expect(hitoTarifario(70000)).toBe(30000);
    expect(hitoTarifario(80000)).toBe(40000);
  });
});
