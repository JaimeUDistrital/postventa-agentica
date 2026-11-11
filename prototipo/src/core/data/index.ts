/**
 * Datos mock de la demo (fecha 2026-11-12). Cada colección vive en su JSON y se valida
 * con el esquema `Fixtures` (integridad referencial y condiciones de escenario).
 */
import { Fixtures } from "@/core/contracts/fixtures";
import owners from "./owners.json";
import vehicles from "./vehicles.json";
import serviceHistory from "./serviceHistory.json";
import parts from "./parts.json";
import tariffs from "./tariffs.json";
import bays from "./bays.json";
import insurers from "./insurers.json";
import scenarios from "./scenarios.json";

export const fixtures: Fixtures = Fixtures.parse({
  owners,
  vehicles,
  serviceHistory,
  parts,
  tariffs,
  bays,
  insurers,
  scenarios,
});
