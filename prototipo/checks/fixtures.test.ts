// Chequeo de los datos mock de T02 (dueño: Orquestador; no se debilita).
import { expect, test } from "vitest";
import { Fixtures } from "@/core/contracts/fixtures";
import { fixtures } from "@/core/data";

test("los datos mock cumplen el esquema, la integridad y las condiciones de cada escenario", () => {
  const r = Fixtures.safeParse(fixtures);
  expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
});
