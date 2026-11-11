/**
 * Formas normalizadas del texto para que las ofuscaciones no evadan los detectores.
 * - basico: minúsculas, sin tildes (NFKD), sin caracteres invisibles; conserva la puntuación.
 * - palabras: basico + todo lo que no es letra/dígito/$/% pasa a un espacio.
 * - leet: palabras con leetspeak simple deshecho (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s).
 * - compacto: leet sin espacios (atrapa «i g n o r a», «i.g.n.o.r.a», «ign0r4-tus_…»).
 */
const LEET: Readonly<Record<string, string>> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
};

export interface Formas {
  basico: string;
  palabras: string;
  leet: string;
  compacto: string;
}

export function basico(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[​-‍⁠﻿]/g, "")
    .toLowerCase();
}

export function formas(texto: string): Formas {
  const b = basico(texto);
  const palabras = b.replace(/[^a-z0-9$%]+/g, " ").trim();
  const leet = b
    .replace(/[013457@$!|]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]+/g, " ")
    .trim();
  return { basico: b, palabras, leet, compacto: leet.replace(/ /g, "") };
}
