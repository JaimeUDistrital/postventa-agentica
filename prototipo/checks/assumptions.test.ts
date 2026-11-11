// Chequeo de la fuente única de supuestos (dueño: Orquestador; no se debilita).
// `npm run check:assumptions` → esquema; `npm run check:assumptions:final` → listo para entregar.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { AssumptionsFile } from "@/core/contracts/assumptions";

const fuente = fileURLToPath(new URL("../../data/assumptions.json", import.meta.url));
const copia = fileURLToPath(new URL("../src/core/config/assumptions.json", import.meta.url));
const leer = (p: string) => JSON.parse(readFileSync(p, "utf8")) as unknown;

describe("data/assumptions.json", () => {
  test("cumple el esquema y trae todos los supuestos requeridos", () => {
    const r = AssumptionsFile.safeParse(leer(fuente));
    expect(r.success ? [] : r.error.issues.map((i) => i.message)).toEqual([]);
  });

  test("la copia del prototipo está sincronizada (npm run sync:assumptions)", () => {
    expect(leer(copia)).toEqual(leer(fuente));
  });
});

describe.runIf(process.env.STRICT_ASSUMPTIONS === "1")("listo para entregar (T01)", () => {
  const data = AssumptionsFile.parse(leer(fuente));

  test("≥ 8 fuentes con URL y fecha", () => {
    expect(data.fuentes.length).toBeGreaterThanOrEqual(8);
  });

  test("ningún supuesto queda en borrador", () => {
    expect(data.supuestos.filter((s) => s.estado !== "final").map((s) => s.id)).toEqual([]);
  });

  test("≥ 10 supuestos respaldados por una fuente", () => {
    const conFuente = data.supuestos.filter((s) => s.fuente_id !== null).length;
    expect(conFuente).toBeGreaterThanOrEqual(10);
  });
});
