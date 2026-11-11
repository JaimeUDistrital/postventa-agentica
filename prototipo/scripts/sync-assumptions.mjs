// Copia la fuente única ../data/assumptions.json a src/core/config/assumptions.json.
// Si la fuente no está (p. ej. un build que solo ve prototipo/), conserva la copia versionada.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const origen = fileURLToPath(new URL("../../data/assumptions.json", import.meta.url));
const destino = fileURLToPath(new URL("../src/core/config/assumptions.json", import.meta.url));

if (!existsSync(origen)) {
  console.log("[sync-assumptions] sin fuente; se usa la copia versionada");
  process.exit(0);
}
const contenido = readFileSync(origen, "utf8");
JSON.parse(contenido); // falla si el JSON está roto
const actual = existsSync(destino) ? readFileSync(destino, "utf8") : "";
if (actual !== contenido) {
  writeFileSync(destino, contenido);
  console.log("[sync-assumptions] copia actualizada");
} else {
  console.log("[sync-assumptions] sin cambios");
}
