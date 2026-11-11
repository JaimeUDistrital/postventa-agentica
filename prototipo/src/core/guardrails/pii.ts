/**
 * Enmascarado de PII colombiana: email, tarjeta, celular, cédula y placa.
 * El orden importa: lo más largo/específico primero para no partir un dato en dos.
 */
export type TipoPII = "email" | "tarjeta" | "celular" | "cedula" | "placa";

interface Regla {
  tipo: TipoPII;
  re: RegExp;
  /** `grupos`: argumentos de `String.replace` tras la coincidencia (capturas, offset…). */
  reemplazar: (grupos: unknown[]) => string;
}

const token = (tipo: TipoPII) => `[${tipo.toUpperCase()}]`;
const fijo = (tipo: TipoPII) => () => token(tipo);
/** Conserva la palabra clave («cédula», «placa») y enmascara solo el dato. */
const conClave = (tipo: TipoPII) => (grupos: unknown[]) =>
  `${String(grupos[0])}${String(grupos[1])}${token(tipo)}`;

const REGLAS: readonly Regla[] = [
  {
    tipo: "email",
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    reemplazar: fijo("email"),
  },
  // 13–19 dígitos, con o sin espacios/guiones.
  { tipo: "tarjeta", re: /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, reemplazar: fijo("tarjeta") },
  // Celular 3xx xxx xxxx, con o sin +57.
  {
    tipo: "celular",
    re: /(?<![\d+])(?:\+?57[\s-]?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4}(?!\d)/g,
    reemplazar: fijo("celular"),
  },
  // Cédula con palabra clave (admite puntos de miles: 52.123.456).
  {
    tipo: "cedula",
    re: /\b(c[eé]dula|c\.?\s?c\.?|documento|identificaci[oó]n)(\s*(?:de\s+ciudadan[ií]a)?\s*(?:n[oº°]\.?|n[uú]mero|es|:|#)?\s*)(?:\d{1,3}(?:[.\s]\d{3}){1,3}|\d{6,10})(?!\d)/giu,
    reemplazar: conClave("cedula"),
  },
  // Cédula suelta de 6–10 dígitos que no sea precio, kilometraje ni parte de otra cifra.
  {
    tipo: "cedula",
    re: /(?<![\d.,])(?<!(?:usd|cop|\$)\s?)\d{6,10}(?![\d.,]*\d)(?!\s*(?:(?:km|kms|kil[oó]metros|usd|cop|pesos|d[oó]lares|mil)\b|%))/giu,
    reemplazar: fijo("cedula"),
  },
  // Placa con palabra clave (cualquier caja): AAA123 / AAA12A.
  {
    tipo: "placa",
    re: /\b(placas?)(\s*(?:es|:|#|n[uú]mero)?\s*)[a-z]{3}[\s-]?\d{2}[\da-z]\b/giu,
    reemplazar: conClave("placa"),
  },
  // Placa suelta en mayúsculas (excluye monedas).
  {
    tipo: "placa",
    re: /\b(?!USD|COP|EUR|KMS)[A-Z]{3}[\s-]?\d{2}[\dA-Z]\b/g,
    reemplazar: fijo("placa"),
  },
];

/**
 * Enmascara la PII de un texto.
 * @returns `masked` con tokens [CEDULA], [CELULAR], [EMAIL], [PLACA], [TARJETA] y
 * `hallazgos` con los TIPOS encontrados (nunca el dato original).
 */
export function maskPII(text: string): { masked: string; hallazgos: string[] } {
  const hallazgos = new Set<TipoPII>();
  let masked = text;
  for (const regla of REGLAS) {
    masked = masked.replace(regla.re, (_m: string, ...grupos: unknown[]) => {
      hallazgos.add(regla.tipo);
      return regla.reemplazar(grupos);
    });
  }
  return { masked, hallazgos: [...hallazgos] };
}

/** Claves cuyo valor se redacta siempre (nombres y datos de contacto no detectables por formato). */
const CLAVES_SENSIBLES =
  /^(nombre|nombres|apellido|apellidos|cedula|documento|celular|telefono|movil|email|correo|placa|direccion|name|fullname|phone|mobile|address|plate)$/i;

function enmascararValor(valor: unknown, clave?: string): unknown {
  if (clave !== undefined && CLAVES_SENSIBLES.test(clave)) {
    if (typeof valor === "string" || typeof valor === "number") return "[REDACTADO]";
  }
  if (typeof valor === "string") return maskPII(valor).masked;
  if (Array.isArray(valor)) return valor.map((v) => enmascararValor(v));
  if (valor !== null && typeof valor === "object") {
    if (Object.getPrototypeOf(valor) !== Object.prototype && Object.getPrototypeOf(valor) !== null) {
      return maskPII(String(valor)).masked;
    }
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) salida[k] = enmascararValor(v, k);
    return salida;
  }
  if (typeof valor === "function" || typeof valor === "symbol") return undefined;
  return valor;
}

/**
 * Copia profunda de `obj` con todos sus strings enmascarados y los campos sensibles
 * (nombre, cédula, celular, email, placa, dirección…) redactados. No muta el original.
 */
export function maskPayload<T>(obj: T): T {
  return enmascararValor(obj) as T;
}
