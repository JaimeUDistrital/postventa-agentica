/**
 * Guardián de ENTRADA: decide, sin LLM, qué pasa con cada mensaje del cliente.
 * Orden: a) consentimiento · b) límite de intentos · c) inyección · d) fraude ·
 * e) síntomas críticos · f) PII.
 */
import type { AgentRequest, GuardrailCategory, GuardrailVerdict, TraceEvent } from "@/core/contracts";
import { policy } from "@/core/config";
import { formas, type Formas } from "./normalizar";
import { maskPII } from "./pii";
import { eventoGuardian, riskScore } from "./traza";

export interface EntradaGuardian {
  message: string;
  tipo: AgentRequest["tipo"];
  optInWhatsapp: boolean;
  intentosBloqueados: number;
}

export interface ResultadoEntrada {
  verdict: GuardrailVerdict;
  /** Etiquetas legibles de los síntomas críticos detectados (vacío si no hay). */
  sintomas: string[];
  trace: TraceEvent[];
}

interface Detector {
  etiqueta: string;
  /** Devuelve true si el texto (en sus formas normalizadas) dispara el detector. */
  test: (f: Formas, original: string) => boolean;
}

// ── c) Inyección / jailbreak / suplantación ────────────────────────────────────
const VERBOS_IGNORAR =
  "ignora|ignoren|ignorar|ignore|olvida|olviden|olvidar|omite|omitan|omitir|descarta|descarten|desobedece|forget|disregard|bypass|override";
const OBJETOS_REGLAS =
  "instrucciones|instruccion|reglas|indicaciones|directrices|politicas|restricciones|prompt|ordenes|programacion|instructions|rules|guidelines|directives|restrictions|programming|safety|seguridad";
const RE_IGNORAR = new RegExp(`\\b(${VERBOS_IGNORAR})\\b(\\s+\\w+){0,5}?\\s+(${OBJETOS_REGLAS})\\b`);
const RE_IGNORAR_COMPACTO = new RegExp(
  `(${VERBOS_IGNORAR})(tus|sus|las|los|todas|todos|toda|todo|all|your|the|any|previous|prior|anteriores|previas|above|de|del|el|mis|lo)*(instruc|regla|rule|indicacion|directri|directiv|guideline|restriccion|restriction|prompt|orden)`,
);

const INYECCION: readonly Detector[] = [
  {
    etiqueta: "pide ignorar sus instrucciones",
    test: (f) => RE_IGNORAR.test(f.leet) || RE_IGNORAR_COMPACTO.test(f.compacto),
  },
  {
    etiqueta: "suplantación de rol",
    test: (f) =>
      /\b(actua|actue|actuar|comportate|finge|finja|pretende|hazte pasar por|act|pretend|roleplay|behave)\s+(como|que eres|ser|as|to be|you are|like)\b/.test(
        f.leet,
      ) ||
      /\b(ahora|desde ahora|a partir de ahora)\s+(eres|seras|vas a ser|actuas)\b|\beres ahora\b|\byou are now\b|\bfrom now on you\b/.test(
        f.leet,
      ) ||
      /\bsoy\s+(el|la|tu|su)?\s*(gerente|administrador|administradora|admin|director|directora|supervisor|supervisora|desarrollador|programador)\b|\bi am (the|your) (manager|admin|administrator|developer|ceo)\b/.test(
        f.leet,
      ) ||
      /actuacomo|ahoraeres|youarenow/.test(f.compacto),
  },
  {
    etiqueta: "modo especial o jailbreak",
    test: (f) =>
      /\bmodo\s+(desarrollador|developer|dios|admin|administrador|depuracion|debug|sin restricciones|sin filtros|dan)\b|\b(developer|god|debug|admin|dan|jailbreak)\s+mode\b|\bjailbreak\b|\bdo anything now\b/.test(
        f.leet,
      ) || /mododesarrollador|developermode|godmode|jailbreak|doanythingnow/.test(f.compacto),
  },
  {
    etiqueta: "pide revelar instrucciones internas",
    test: (f) =>
      /\b(system\s*prompt|prompt\s+(del|de)\s+sistema|prompt\s+inicial|initial prompt|mensaje\s+(del|de)\s+sistema)\b|\binstrucciones\s+(internas|del sistema|ocultas|iniciales|originales|secretas)\b|\b(hidden|internal|original|initial|secret)\s+instructions\b/.test(
        f.leet,
      ) ||
      /\b(muestra|muestrame|revela|revelame|dime|ensename|imprime|repite|repiteme|copia|dame|show|reveal|print|repeat|tell me|give me)\s+(\w+\s+){0,3}(tus|sus|your)\s+(instrucciones|reglas|prompt|instructions|rules)\b/.test(
        f.leet,
      ) ||
      /systemprompt|promptdelsistema/.test(f.compacto),
  },
  {
    etiqueta: "delimitador falso de sistema",
    test: (f) =>
      /#{2,}\s*(system|sistema|instrucciones|instructions|admin|developer|assistant|asistente)\b/.test(f.basico) ||
      /<\/?\s*(system|sistema|instrucciones|instructions|admin|prompt|developer|assistant)\b[^>]*>/.test(f.basico) ||
      /\[\/?\s*(system|sistema|inst|admin|developer)\s*\]/.test(f.basico) ||
      /<\|[a-z_]+\|>/.test(f.basico) ||
      /(^|\n)\s*(system|sistema)\s*:/.test(f.basico),
  },
];

// ── d) Fraude: precio, descuento o autorización fuera de política ─────────────
const RE_EXIGENCIA =
  /\b(quiero|exijo|necesito|dame|deme|denme|hazme|hagame|haganme|ponme|ponlo|dejamelo|regalame|aplicame|apliquenme|autoriza|autorizame|aprueba|give me|i want|make it|do it)\b/;
const esPregunta = (original: string) => /[?¿]/.test(original);

/** Porcentajes de descuento pedidos en el mensaje (0–100). */
function porcentajesDescuento(f: Formas): number[] {
  if (!/\b(descuento|dcto|rebaja|discount|off)\b/.test(f.palabras)) return [];
  const pcts = [...f.basico.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*%/g)].map((m) =>
    Number((m[1] ?? "0").replace(",", ".")),
  );
  if (/\b(cien|100)\s+(por\s*ciento|percent)\b/.test(f.palabras)) pcts.push(100);
  return pcts;
}

const FRAUDE: readonly Detector[] = [
  {
    etiqueta: "pide el servicio gratis",
    test: (f, original) =>
      /\b(gratis|gratuit[oa]s?|free of charge|for free|sin costo|sin cargo|de regalo|regalad[oa])\b/.test(
        f.palabras,
      ) && !(esPregunta(original) && !RE_EXIGENCIA.test(f.palabras)),
  },
  {
    etiqueta: "precio irrisorio fuera del tarifario",
    test: (f) =>
      /(?<![\d.,])\$\s*[01](?![\d.,]*\d)/.test(f.basico) ||
      /(?<![\d.,])[01]\s*(usd|dolar|dolares|dollar|dollars|peso|pesos)\b/.test(f.basico) ||
      /\b(un|uno|one|cero|zero)\s+(solo\s+)?(usd|dolar|dollar|peso|pesos)\b/.test(f.palabras),
  },
  {
    etiqueta: "descuento fuera de política",
    test: (f) =>
      porcentajesDescuento(f).some(
        (p) => p >= 50 || (p > policy.topeDescuentoPct * 100 && RE_EXIGENCIA.test(f.palabras)),
      ),
  },
  {
    etiqueta: "pide una autorización que el agente no puede dar",
    test: (f) =>
      /\b(autorizame|autorizeme|autoricenme|autorizenme|authorize me|apruebame|apruebeme|aprueben?me)\b/.test(
        f.palabras,
      ) ||
      /\baprueb(a|e|en)\s+(mi|mis|nuestra)\s+(garantia|reclamacion|reclamo|descuento|solicitud)\b/.test(
        f.palabras,
      ) ||
      /\bapprove (my|the) (warranty|claim|discount)/.test(f.palabras) ||
      /autorizame|autoricenme|apruebame|apruebamigarantia|approvemywarranty/.test(f.compacto),
  },
  {
    etiqueta: "pretende evadir el pago",
    test: (f) =>
      /\b(sin pagar|no pagar nada|no voy a pagar|no pago nada|without paying|not paying)\b/.test(f.palabras) ||
      /sinpagar/.test(f.compacto),
  },
];

// ── e) Síntomas críticos de seguridad ─────────────────────────────────────────
const SINTOMAS: readonly { etiqueta: string; re: RegExp }[] = [
  {
    etiqueta: "olor a quemado",
    re: /\b(huele|olor|oliendo|hiede)\s+a\s+quemad|\bburn(ing|t)?\s+smell|\bsmells?\s+(like\s+)?(something\s+)?burn/,
  },
  { etiqueta: "humo", re: /\bhumo\b|\bhumea|\b(smoke|smoking)\b/ },
  {
    etiqueta: "testigo del motor en rojo o titilando",
    re: /\b(testigo|luz|luces|bombillo|indicador|check\s*engine)\b(\s+\w+){0,5}?\s+(rojo|roja|titil\w*|parpade\w*|intermitente)\b|\bcheck\s*engine\b(\s+\w+){0,3}?\s+(flashing|blinking|red)\b/,
  },
  {
    etiqueta: "frenos que no responden o esponjosos",
    re: /\bfren\w*(\s+\w+){0,4}?\s+(no\s+responde\w*|no\s+funciona\w*|no\s+sirve\w*|esponjos\w*|blandos?|se\s+va\w*\s+al\s+fondo|falla\w*)\b|\bno\s+frena\b|\bsin\s+frenos\b|\bbrakes?\b(\s+\w+){0,3}?\s+(not\s+working|failed|failing|spongy|soft)\b|\bspongy\s+brakes?\b/,
  },
  {
    etiqueta: "sobrecalentamiento",
    re: /\bsobrecal\w*|\brecalent\w*|\boverheat\w*|\bse\s+calienta\s+(mucho|demasiado)\b|\btemperatura\s+(muy\s+)?alta\b|\baguja\s+de\s+(la\s+)?temperatura\b/,
  },
  {
    etiqueta: "pérdida de dirección",
    re: /\b(perdi|perdio|pierde|perdida\s+de|perdiendo|sin)\s+(la\s+)?direccion\b|\bdireccion\b(\s+\w+){0,3}?\s+(no\s+responde\w*|se\s+bloque\w*|se\s+trab\w*|bloquead\w*)\b|\b(lost|losing|loss\s+of)\s+(the\s+)?steering\b|\bsteering\b(\s+\w+){0,3}?\s+(failed|locked|not\s+responding)\b/,
  },
  { etiqueta: "airbag", re: /\bairbags?\b|\bbolsas?\s+de\s+aire\b/ },
  {
    etiqueta: "fuga de combustible",
    re: /\b(fuga|goteo|derrame|escape|bota|pierde|botando|perdiendo)\s+(de\s+)?(gasolina|combustible|diesel|acpm)\b|\b(huele|olor)\s+a\s+(gasolina|combustible)\b|\b(fuel|gas|gasoline)\s+leak\w*|\bleak\w*\s+(fuel|gas)\b|\bsmells?\s+(of|like)\s+(gas|fuel|gasoline)\b/,
  },
  {
    etiqueta: "ruido metálico fuerte al frenar",
    re: /\b(ruido|sonido|chirrido|golpe\w*|crujido|rechin\w*)\b(\s+\w+){0,3}?\s+metalic\w*(\s+\w+){0,4}?\s+fren\w*|\b(al|cuando)\s+fren\w*(\s+\w+){0,4}?\s+(ruido|sonido)\s+metalic\w*|\bgrinding\b(\s+\w+){0,4}?\s+brak\w*/,
  },
];

const disparados = (detectores: readonly Detector[], f: Formas, original: string) =>
  detectores.filter((d) => d.test(f, original)).map((d) => d.etiqueta);

function veredicto(
  action: GuardrailVerdict["action"],
  categorias: GuardrailCategory[],
  reasons: string[],
  maskedInput: string,
): GuardrailVerdict {
  return {
    allow: action === "permitir" || action === "enmascarar",
    action,
    categorias,
    reasons,
    maskedInput,
    riskScore: riskScore(categorias),
  };
}

const STATUS = { bloquear: "blocked", escalar: "escalated", enmascarar: "ok", permitir: "ok" } as const;

/**
 * Evalúa un mensaje de entrada. `verdict.allow` es true solo si la acción es
 * «permitir» o «enmascarar»; «escalar» y «bloquear» detienen el flujo normal.
 */
export function evaluarEntrada(entrada: EntradaGuardian): ResultadoEntrada {
  const inicioMs = performance.now();
  const { masked, hallazgos } = maskPII(entrada.message);
  const cerrar = (
    verdict: GuardrailVerdict,
    sintomas: string[],
    name: string,
    kind: "guardrail" | "policy",
    extra: Record<string, unknown> = {},
  ): ResultadoEntrada => ({
    verdict,
    sintomas,
    trace: [
      eventoGuardian({
        kind,
        name,
        status: STATUS[verdict.action],
        detalle: `Guardián (entrada): ${verdict.action} · ${verdict.reasons.join(" ")}`,
        payload: {
          action: verdict.action,
          categorias: verdict.categorias,
          riskScore: verdict.riskScore,
          sintomas,
          pii: hallazgos,
          entrada: masked,
          ...extra,
        },
        inicioMs,
      }),
    ],
  });

  // a) Gate de consentimiento: el agente Proactivo no inicia contacto sin opt-in.
  if (entrada.tipo === "inicio" && !entrada.optInWhatsapp) {
    const v = veredicto(
      "bloquear",
      ["sin_consentimiento"],
      [
        "El propietario no ha dado consentimiento (opt-in) para recibir mensajes por WhatsApp: el agente Proactivo no lo contacta.",
      ],
      masked,
    );
    return cerrar(v, [], "gate_consentimiento", "policy");
  }

  // b) Límite de intentos bloqueados por sesión.
  if (entrada.intentosBloqueados >= policy.maxIntentosBloqueados) {
    const v = veredicto(
      "bloquear",
      ["limite_intentos"],
      [
        `La sesión acumula ${entrada.intentosBloqueados} mensajes bloqueados (límite ${policy.maxIntentosBloqueados}): se cierra y se ofrece un asesor humano.`,
      ],
      masked,
    );
    return cerrar(v, [], "limite_intentos", "policy");
  }

  const f = formas(entrada.message);
  const inyeccion = disparados(INYECCION, f, entrada.message);
  const fraude = disparados(FRAUDE, f, entrada.message);
  const sintomas = SINTOMAS.filter((s) => s.re.test(f.palabras)).map((s) => s.etiqueta);
  const pii: GuardrailCategory[] = hallazgos.length > 0 ? ["pii"] : [];
  const motivoPii = `Se enmascararon datos personales (${hallazgos.join(", ")}) antes de que los vea el agente.`;
  const detectores = { inyeccion, fraude };

  // c) + d) Inyección y fraude bloquean (pueden coexistir).
  if (inyeccion.length > 0 || fraude.length > 0) {
    const categorias: GuardrailCategory[] = [];
    const reasons: string[] = [];
    if (inyeccion.length > 0) {
      categorias.push("inyeccion");
      reasons.push(`Intento de manipular al agente: ${inyeccion.join("; ")}.`);
    }
    if (fraude.length > 0) {
      categorias.push("fraude");
      reasons.push(
        `Petición fuera de la política comercial: ${fraude.join("; ")}. Precios y descuentos salen solo del tarifario (tope ${policy.topeDescuentoPct * 100} %).`,
      );
    }
    if (pii.length > 0) reasons.push(motivoPii);
    const v = veredicto("bloquear", [...categorias, ...pii], reasons, masked);
    return cerrar(v, sintomas, "guardrail_entrada", "guardrail", { detectores });
  }

  // e) Síntomas críticos → escalar a humano.
  if (sintomas.length > 0) {
    const reasons = [
      `Síntoma crítico de seguridad: ${sintomas.join(", ")}. Se escala a un asesor humano con prioridad alta; el agente no diagnostica.`,
    ];
    if (pii.length > 0) reasons.push(motivoPii);
    const v = veredicto("escalar", ["sintoma_critico", ...pii], reasons, masked);
    return cerrar(v, sintomas, "guardrail_entrada", "guardrail", { severidad: "alta", detectores });
  }

  // f) PII → enmascarar y permitir.
  if (pii.length > 0) {
    return cerrar(veredicto("enmascarar", pii, [motivoPii], masked), [], "guardrail_entrada", "guardrail");
  }

  return cerrar(
    veredicto("permitir", [], ["Mensaje sin riesgos detectados."], masked),
    [],
    "guardrail_entrada",
    "guardrail",
  );
}
