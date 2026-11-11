import { runTurn } from "@/core/agent";
import { AgentRequest } from "@/core/contracts";

/** POST /api/agent · contrato en PLAN.md §4. Dueño a partir de Ola 2: T08. */
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
    // Nunca devolver detalles internos al cliente.
    console.error("[api/agent]", error instanceof Error ? error.message : error);
    return Response.json({ error: "Error interno del agente" }, { status: 500 });
  }
}
