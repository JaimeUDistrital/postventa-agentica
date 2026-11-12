import { describe, expect, it } from "vitest";
import { CASOS } from "./casos";
import type { Resultado } from "./harness";
import { construirReporte } from "./reporte";

describe("reporte · modo LLM sin llamadas a Gemini", () => {
  const r = (fallbacks: number): Resultado => ({
    caso: CASOS[0],
    turnos: [],
    criterios: [],
    pasa: true,
    uso: { entrada: 0, salida: 0, costoUsd: 0, llamadas: 0, fallbacks },
  });
  const md = (fallbacks: number) =>
    construirReporte([r(0)], [{ modelo: "m", resultados: [r(fallbacks)] }], { hayClave: true, fecha: "x" });

  it("con respaldos, la causa es que Gemini falló", () => {
    expect(md(3)).toContain("ninguna llamada a Gemini tuvo éxito");
  });

  it("sin respaldos, dice que ningún turno pasó por la ruta IA (no culpa a la red ni a la clave)", () => {
    expect(md(0)).toContain("ningún turno de los casos pasó por la ruta IA");
    expect(md(0)).not.toContain("clave inválida");
  });
});
