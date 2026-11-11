# ADR 0004 · Guardián determinista que el LLM no puede anular

- **Estado:** Aceptada
- **Fecha:** 2026-11-11

## Contexto
El BRD exige consentimiento, privacidad, límites de autonomía y defensa ante mensajes adversariales. Un guardián basado en LLM puede ser engañado con la misma inyección que debe detectar.

## Decisión
El Guardián es **código determinista sin LLM**, con dos puntos de control:
- **Entrada**, en este orden: consentimiento, límite de intentos, inyección o suplantación, fraude (precio o descuento fuera de política), síntoma crítico, PII (enmascarado).
- **Salida:** precio igual al tarifario, descuento no mayor al tope, sin promesas de garantía ni diagnósticos, sin PII.

Su veredicto (`GuardrailVerdict`) se aplica antes y después del planner; el LLM solo ve el texto enmascarado y no tiene herramienta alguna para saltarse al Guardián. Si la salida es inválida, el orquestador responde con un texto seguro. Cada decisión queda en la traza.

## Alternativas consideradas
- **Guardián con LLM (juez):** flexible, pero no determinista y vulnerable a inyección.
- **Solo instrucciones en el prompt:** no son una garantía.
- **Servicio externo de moderación:** otra dependencia y latencia, sin conocer las reglas de negocio (tarifario, tope).

## Consecuencias
- Comportamiento reproducible y probable con pruebas unitarias y evals (meta de 100 % en seguridad).
- Riesgo de falsos positivos y negativos en patrones: se mitiga revisando trazas y añadiendo casos a los evals.
- Cubrir lenguaje nuevo exige añadir reglas; no se «aprende» solo.
