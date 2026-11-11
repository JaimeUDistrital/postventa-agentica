/** Registro de herramientas del agente. `executeTool` es el único punto de entrada. */
import type { ToolName, ToolResult } from "@/core/contracts";
import type { ToolContext } from "@/core/ports";
import { agendarBahia, consultarContexto, cotizarSeguros, escalarAsesor, verificarStock } from "./handlers";
import { runTool } from "./run";

export { estimarKm, type EstimacionKm } from "./estimador";
export { parseQuoteId, encodeQuoteId, type QuoteParams } from "./quote";

export const consultar_contexto_vehiculo = (ctx: ToolContext, args: unknown): Promise<ToolResult> =>
  runTool("consultar_contexto_vehiculo", ctx, args, consultarContexto);
export const verificar_stock_y_precio = (ctx: ToolContext, args: unknown): Promise<ToolResult> =>
  runTool("verificar_stock_y_precio", ctx, args, verificarStock);
export const agendar_bahia_taller = (ctx: ToolContext, args: unknown): Promise<ToolResult> =>
  runTool("agendar_bahia_taller", ctx, args, agendarBahia);
export const cotizar_aliados_seguros = (ctx: ToolContext, args: unknown): Promise<ToolResult> =>
  runTool("cotizar_aliados_seguros", ctx, args, cotizarSeguros);
export const escalar_asesor_humano = (ctx: ToolContext, args: unknown): Promise<ToolResult> =>
  runTool("escalar_asesor_humano", ctx, args, escalarAsesor);

const REGISTRY: Record<ToolName, (ctx: ToolContext, args: unknown) => Promise<ToolResult>> = {
  consultar_contexto_vehiculo,
  verificar_stock_y_precio,
  agendar_bahia_taller,
  cotizar_aliados_seguros,
  escalar_asesor_humano,
};

export const executeTool = (name: ToolName, args: unknown, ctx: ToolContext): Promise<ToolResult> =>
  REGISTRY[name](ctx, args);
