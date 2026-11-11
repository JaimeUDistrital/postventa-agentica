/**
 * Guardián de SALIDA: valida la respuesta del agente (LLM o determinista) antes de
 * mostrarla al cliente. Si algo falla, bloquea; el orquestador usa una respuesta segura.
 */
import type { GuardrailCategory, GuardrailVerdict, TraceEvent } from "@/core/contracts";
import { policy } from "@/core/config";
import { formas } from "./normalizar";
import { maskPII } from "./pii";
import { eventoGuardian, riskScore } from "./traza";

export interface SalidaGuardian {
  text: string;
  /** Total que muestra la respuesta/tarjeta (USD). */
  cotizacionTotalUsd?: number;
  /** Total recalculado por el orquestador desde el tarifario (USD). */
  totalRecalculadoUsd?: number;
  /** Descuento aplicado, como fracción 0–1 (igual que PriceQuote.descuentoPct). */
  descuentoPct?: number;
}

const TOLERANCIA_USD = 0.005;

const RE_GARANTIA =
  /\b(aprobamos|aprobe|aprobo|autorizamos)\s+(la|su|tu)?\s*garantia\b|\bgarantia\s+(aprobada|autorizada)\b|\b(queda|quedan|esta|estan|quedo)\s+cubiert\w*\s+por\s+(la\s+)?garantia\b|\bla\s+garantia\s+(lo|la|le|te|les)\s+cubre\b|\bwarranty\s+(is\s+)?approved\b|\b(is|are)\s+covered\s+by\s+(the\s+)?warranty\b/;
const RE_DIAGNOSTICO =
  /\bel\s+problema\s+es\s+(el|la|los|las|un|una|su|tu)\b|\bseguro\s+es\s+(el|la|un|una)\b|\b(definitivamente|seguramente|sin\s+duda|claramente)\s+es\s+(el|la|un|una)\b|\bel\s+diagnostico\s+es\b|\blo\s+que\s+tiene\s+(su|tu)\s+(carro|vehiculo)\s+es\b|\bthe\s+problem\s+is\s+(the|your)\b|\bit\s+s\s+definitely\b/;
const RE_FILTRACION =
  /\bsystem\s*prompt\b|\bprompt\s+del\s+sistema\b|\bmis\s+instrucciones\s+(son|dicen|indican|me)\b|\bmy\s+instructions\s+(are|say)\b|\binstrucciones\s+(internas|del\s+sistema)\b|\bi\s+was\s+instructed\b|\bme\s+(instruyeron|programaron\s+para)\b/;

const usd = (n: number) => `USD ${n.toFixed(2)}`;

export function validarSalida(salida: SalidaGuardian): {
  verdict: GuardrailVerdict;
  trace: TraceEvent[];
} {
  const inicioMs = performance.now();
  const { masked, hallazgos } = maskPII(salida.text);
  const p = formas(salida.text).palabras;
  const reasons: string[] = [];

  const { cotizacionTotalUsd: total, totalRecalculadoUsd: recalculado, descuentoPct } = salida;
  if (total !== undefined) {
    if (recalculado === undefined) {
      reasons.push(`El total ${usd(total)} no se verificó contra el tarifario: el agente no puede inventar precios.`);
    } else if (!(Math.abs(total - recalculado) <= TOLERANCIA_USD)) {
      reasons.push(`El total ${usd(total)} no coincide con el recalculado desde el tarifario (${usd(recalculado)}).`);
    }
  }
  if (descuentoPct !== undefined && !(descuentoPct >= 0 && descuentoPct <= policy.topeDescuentoPct + 1e-9)) {
    reasons.push(
      `Descuento de ${(descuentoPct * 100).toFixed(1)} % fuera de política (tope ${policy.topeDescuentoPct * 100} %).`,
    );
  }
  if (RE_GARANTIA.test(p)) reasons.push("Promete o aprueba una garantía: solo puede hacerlo un asesor humano.");
  if (RE_DIAGNOSTICO.test(p)) reasons.push("Emite un diagnóstico: el agente no diagnostica fallas, las escala.");
  if (hallazgos.length > 0) reasons.push(`Expone datos personales sin enmascarar (${hallazgos.join(", ")}).`);
  if (RE_FILTRACION.test(p)) reasons.push("Filtra instrucciones internas del sistema.");

  const ok = reasons.length === 0;
  const categorias: GuardrailCategory[] = ok
    ? []
    : ["salida_invalida", ...(hallazgos.length > 0 ? (["pii"] as const) : [])];
  const verdict: GuardrailVerdict = {
    allow: ok,
    action: ok ? "permitir" : "bloquear",
    categorias,
    reasons: ok ? ["Respuesta conforme a la política."] : reasons,
    maskedInput: masked,
    riskScore: riskScore(categorias),
  };
  const trace = [
    eventoGuardian({
      kind: "guardrail",
      name: "guardrail_salida",
      status: ok ? "ok" : "blocked",
      detalle: `Guardián (salida): ${verdict.action} · ${verdict.reasons.join(" ")}`,
      payload: {
        action: verdict.action,
        categorias,
        riskScore: verdict.riskScore,
        salida: masked,
        cotizacionTotalUsd: total ?? null,
        totalRecalculadoUsd: recalculado ?? null,
        descuentoPct: descuentoPct ?? null,
      },
      inicioMs,
    }),
  ];
  return { verdict, trace };
}
