// T15 · Coherencia de la entrega: una sola fuente de supuestos y las mismas cifras en todos los entregables.
// Encadena las comprobaciones que ya existen (pytest del modelo, check_pdf.py) y añade las que faltaban.
// Uso, desde la raíz del repositorio: node prototipo/scripts/check_coherence.mjs
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const leer = (ruta) => readFileSync(raiz + ruta, "utf8");
const fallos = [];
const comprobar = (ok, que) => {
  console.log(`${ok ? "OK   " : "FALLA"} ${que}`);
  if (!ok) fallos.push(que);
};
const correr = (cmd, args, cwd, que) => {
  const r = spawnSync(cmd, args, { cwd: raiz + cwd, encoding: "utf8" });
  const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").at(-1) ?? "";
  comprobar(r.status === 0, `${que} (${salida || r.error?.message || "sin salida"})`);
};

// 1. El prototipo usa exactamente los supuestos del modelo financiero.
comprobar(
  leer("data/assumptions.json") === leer("prototipo/src/core/config/assumptions.json"),
  "supuestos: data/assumptions.json = prototipo/src/core/config/assumptions.json",
);

// 2. El resumen financiero salió de esa misma versión de supuestos.
const supuestos = JSON.parse(leer("data/assumptions.json"));
const resumen = JSON.parse(leer("entregables/financial_summary.json"));
comprobar(
  resumen.version_supuestos === supuestos.version,
  `versión de supuestos: summary ${resumen.version_supuestos} = assumptions ${supuestos.version}`,
);

// 3. El PDF y el README enlazan la misma demo y el mismo repositorio.
const meta = JSON.parse(leer("resumen_ejecutivo/meta.json"));
const readme = leer("README.md");
comprobar(readme.includes(meta.url_demo) && readme.includes(meta.url_repo), "URLs de demo y repo: PDF (meta.json) = README");

// 4. xlsx ↔ modelo de referencia ↔ financial_summary.json (fórmulas evaluadas).
correr("uv", ["run", "pytest", "-q"], "modelo_financiero", "xlsx = referencia = summary (pytest)");

// 5. PDF ↔ financial_summary.json (inversión, VPN, beneficio, payback y ROI de los 3 escenarios).
correr("python3", ["check_pdf.py"], "resumen_ejecutivo", "PDF = summary (check_pdf.py)");

console.log(fallos.length ? `\n${fallos.length} comprobación(es) fallan` : "\nCoherencia OK: 5/5");
process.exit(fallos.length ? 1 : 0);
