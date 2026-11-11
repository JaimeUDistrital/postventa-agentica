import { ConfiguracionError, SesionInvalidaError, runTurn } from "@/core/agent";
import { AgentRequest } from "@/core/contracts";

/** El token de sesión usa node:crypto (HMAC). */
export const runtime = "nodejs";

const ERROR_INTERNO = { error: "Error interno del agente" };

/** POST /api/agent · contrato en PLAN.md §4. Dueño: T08. */
export async function POST(request: Request) {
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
