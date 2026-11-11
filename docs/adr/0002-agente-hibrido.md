# ADR 0002 · Agente híbrido: planner determinista + Gemini con respaldo

- **Estado:** Aceptada
- **Fecha:** 2026-11-11

## Contexto
La rúbrica pide autonomía acotada, guardrails y que la demo no falle en vivo. Un LLM entiende lenguaje natural, pero no debe decidir precios, reservas ni seguridad, y puede fallar (sin llave, timeout, respuesta inválida).

## Decisión
Un contrato `Planner` con dos implementaciones:
- **Gemini con function calling** (SDK oficial `@google/genai`) cuando hay `GEMINI_API_KEY`: el modelo elige entre las cinco herramientas tipadas y redacta.
- **Planner determinista** con el mismo contrato cuando no hay llave o el LLM falla (timeout de 8 s, 1 reintento).

El planner nunca escribe precios ni reservas: devuelve `showCards` y el orquestador las arma con resultados de herramientas verificados. Modelo por defecto `gemini-3.5-flash-lite` (menor costo); alternativa `gemini-3.6-flash` vía `GEMINI_MODEL`. El modelo final se elige con evals (acierto y costo), no por preferencia. Soporte de function calling por modelo: lo comprueba la tarea del planner Gemini.

## Alternativas consideradas
- **Solo reglas deterministas:** robusto, pero no entiende mensajes libres.
- **Solo LLM:** más flexible, pero sin garantía de precio, seguridad ni funcionamiento sin red.
- **Modelo más grande por defecto:** más costo por conversación sin evidencia de que mejore el acierto en este dominio.

## Consecuencias
- La demo funciona sin llave; la insignia de modo muestra `deterministic` o `llm`.
- Dos planners que mantener con un mismo contrato y los mismos evals.
- El costo por conversación entra al modelo financiero como supuesto (ver modelo financiero).
- El nivel gratuito de Gemini usa datos para mejorar productos de Google: válido para datos ficticios; producción exige nivel de pago.
