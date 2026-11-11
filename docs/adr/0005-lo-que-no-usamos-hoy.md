# ADR 0005 · Qué no usamos hoy y por qué

- **Estado:** Aceptada
- **Fecha:** 2026-11-11

## Contexto
Cada pieza extra cuesta tiempo, superficie de ataque y mantenimiento. Para el alcance de hoy (datos estructurados ficticios, un solo despliegue) varias herramientas populares no aportan.

## Decisión
No usamos hoy, con el disparador concreto que cambiaría la decisión:

| Tecnología | Por qué no hoy | Disparador para cambiar |
|---|---|---|
| MCP | Las herramientas corren en el mismo proceso; no hay un segundo cliente que las consuma | Otro agente o sistema externo necesita las mismas herramientas |
| RAG | Los datos son estructurados (tarifario, inventario, historial) y se consultan de forma determinista | Contenido no estructurado grande (manuales, políticas) que el agente deba citar |
| Supabase o base de datos | La sesión viaja en un token firmado; datos ficticios | Persistir conversaciones, casos o auditoría entre sesiones y dispositivos |
| Railway | Vercel sirve UI y API; sin procesos de larga duración | Colas, tareas programadas o procesos largos |
| Fine-tuning | Prompt, herramientas y Guardián se miden con evals y bastan | Los evals muestran una brecha que el prompt no cierra y hay datos reales suficientes |
| LangChain | SDK oficial de Gemini directo; menos capas | Varios proveedores de modelos y grafos de agentes complejos |

## Alternativas consideradas
Adoptarlas todas desde el inicio «por si acaso»: más dependencias y más fallos posibles sin beneficio medible hoy.

## Consecuencias
- Menos piezas que desplegar, asegurar y explicar.
- Los puertos y las herramientas tipadas dejan abiertas las salidas: exponer las herramientas como servidor MCP, o cambiar el adaptador a Postgres o Supabase, sin tocar el agente.
- Deuda aceptada: sin persistencia real ni búsqueda sobre documentos hasta que aparezca el disparador.
