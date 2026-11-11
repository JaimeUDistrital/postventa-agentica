import { ConfiguracionError, SesionInvalidaError, runTurn } from "@/core/agent";
import { LIMITES_DEMO } from "@/core/agent/acceso";
import { AgentRequest } from "@/core/contracts";

/** El token de sesión usa node:crypto (HMAC). */
export const runtime = "nodejs";

const ERROR_INTERNO = { error: "Error interno del agente" };

/**
 * Límite por IP con ventana deslizante en memoria (ADR 0006). BEST-EFFORT: en serverless cada
 * instancia tiene su propio Map, así que el tope real es por instancia. En producción se usaría
 * un almacén compartido (p. ej. Redis/KV); aquí el tope duro es la cuota gratuita de la clave
 * de Gemini sin facturación.
 */
const VENTANA_MS = 60_000;
const golpesPorIp = new Map<string, number[]>();

function excedeLimite(ip: string, ahora: number): boolean {
  for (const [clave, marcas] of golpesPorIp) {
    // Limpieza: se descartan las IP sin actividad en la ventana (acota la memoria).
    if (marcas.every((t) => ahora - t >= VENTANA_MS)) golpesPorIp.delete(clave);
  }
  const recientes = (golpesPorIp.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= LIMITES_DEMO.maxPeticionesPorMinutoIp) {
    golpesPorIp.set(ip, recientes);
    return true;
  }
  recientes.push(ahora);
  golpesPorIp.set(ip, recientes);
  return false;
}

/**
 * Sin cabecera `x-forwarded-for` (tests, dev local) NO se limita: agruparlas en una sola clave
 * bloquearía a todos a la vez. En Vercel la cabecera siempre viene.
 */
const ipDe = (request: Request): string | undefined => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

/** POST /api/agent · contrato en PLAN.md §4. Dueño: T08. */
export async function POST(request: Request) {
  const ip = ipDe(request);
  if (ip && excedeLimite(ip, Date.now())) {
    return Response.json({ error: "Demasiadas solicitudes, intente en un minuto" }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = AgentRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Solicitud inválida", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  try {
    return Response.json(await runTurn(parsed.data));
  } catch (error) {
    if (error instanceof SesionInvalidaError) return Response.json({ error: error.message }, { status: 400 });
    // Falla cerrado sin detalles internos para el cliente; el log sí es claro.
    if (error instanceof ConfiguracionError) console.error("[api/agent] Configuración:", error.message);
    else console.error("[api/agent]", error instanceof Error ? error.message : error);
    return Response.json(ERROR_INTERNO, { status: 500 });
  }
}
