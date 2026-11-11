// Comprueba los diagramas Mermaid de ARQUITECTURA_Y_SOLUCION.md sin dependencias.
// Uso (desde la raíz del repo): node docs/arquitectura/check_mermaid.mjs
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const errors = [];
const fail = (m) => errors.push(m);

const doc = join(root, "ARQUITECTURA_Y_SOLUCION.md");
if (!existsSync(doc)) {
  console.error("FALLA: no existe ARQUITECTURA_Y_SOLUCION.md");
  process.exit(1);
}
const md = readFileSync(doc, "utf8");
const blocks = [...md.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
const MIN = 8;
if (blocks.length < MIN) fail(`Hay ${blocks.length} bloques mermaid; se exigen al menos ${MIN}.`);

const TYPES = ["flowchart", "sequenceDiagram", "stateDiagram-v2"];
// Caracteres que obligan a usar comillas dentro de [] o {} (y en etiquetas de aristas |..|).
const SPECIAL = /[():"'¿?¡!,;/\\&#%<>áéíóúÁÉÍÓÚñÑüÜ]/;

blocks.forEach((b, i) => {
  const n = i + 1;
  const lines = b.split("\n");
  const first = lines.find((l) => l.trim() && !l.trim().startsWith("%%"));
  const type = TYPES.find((t) => first && first.trim().startsWith(t));
  if (!type) {
    fail(`Diagrama ${n}: tipo no permitido o ausente (primera línea: "${(first ?? "").trim()}"). Permitidos: ${TYPES.join(", ")}.`);
    return;
  }

  // Balance de (), [], {} fuera de textos entre comillas.
  const sinComillas = b.replace(/"[^"\n]*"/g, '""');
  const pila = [];
  const par = { ")": "(", "]": "[", "}": "{" };
  let ln = 1;
  for (const ch of sinComillas) {
    if (ch === "\n") ln++;
    else if ("([{".includes(ch)) pila.push([ch, ln]);
    else if (")]}".includes(ch)) {
      const top = pila.pop();
      if (!top || top[0] !== par[ch]) fail(`Diagrama ${n}, línea ${ln}: "${ch}" sin pareja.`);
    }
  }
  pila.forEach(([ch, l]) => fail(`Diagrama ${n}, línea ${l}: "${ch}" sin cerrar.`));
  if ((b.match(/"/g) ?? []).length % 2 !== 0) fail(`Diagrama ${n}: número impar de comillas dobles.`);

  // Etiquetas sin comillas (solo flowchart y stateDiagram; en sequenceDiagram el texto de mensajes es libre).
  if (type !== "sequenceDiagram") {
    lines.forEach((l, k) => {
      const t = l.trim();
      if (t.startsWith("%%")) return;
      const sin = t.replace(/"[^"]*"/g, '""');
      for (const m of sin.matchAll(/[\[{]([^\]}\[{]*)[\]}]/g)) {
        const txt = m[1];
        if (txt === '""' || txt.trim() === "") continue;
        if (SPECIAL.test(txt) || /[\[(]/.test(txt)) {
          fail(`Diagrama ${n}, línea ${k + 1}: etiqueta sin comillas con caracteres especiales: ${m[0]}`);
        }
      }
      // Nodos tipo [ y [( : etiqueta que empieza con comilla se acepta; sin comilla y con especiales, no.
      for (const m of sin.matchAll(/\|([^|"]*)\|/g)) {
        if (SPECIAL.test(m[1])) fail(`Diagrama ${n}, línea ${k + 1}: etiqueta de arista sin comillas: |${m[1]}|`);
      }
    });
  }
});

// Archivos de ADR.
const adrs = ["0001", "0002", "0003", "0004", "0005"];
const adrDir = join(root, "docs", "adr");
for (const p of adrs) {
  const f = existsSync(adrDir) ? (readdirSafe(adrDir).find((x) => x.startsWith(p + "-") && x.endsWith(".md"))) : undefined;
  if (!f) fail(`Falta docs/adr/${p}-*.md`);
}
if (!existsSync(join(adrDir, "README.md"))) fail("Falta docs/adr/README.md");

function readdirSafe(d) {
  return existsSync(d) ? readdirSync(d) : [];
}
import { readdirSync } from "node:fs";

if (errors.length) {
  console.error(`FALLA (${errors.length} problema(s)):`);
  errors.forEach((e) => console.error(" - " + e));
  process.exit(1);
}
console.log(`OK: ${blocks.length} diagramas mermaid válidos; ADR 0001-0005 y README presentes.`);
