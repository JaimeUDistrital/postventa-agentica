# ADR 0007 · IA para todos los visitantes, con topes

- **Estado:** Aceptada (reemplaza la capa «código del jurado» del ADR 0006 como comportamiento por defecto)
- **Fecha:** 2026-11-11

## Contexto
Con el ADR 0006, quien entraba sin el código del jurado veía el motor de reglas. Ese motor reconoce intenciones por palabras clave y no razona, así que un evaluador que escribiera libremente sentía que «el agente no asiste». El autor fijó límites de gasto en el proyecto de la clave de Gemini y pidió dejar la IA activa para todos.

## Decisión
- Si existe `GEMINI_API_KEY`, el planner Gemini atiende a **todos** los visitantes (motivo de acceso `publico`).
- Se mantienen los topes del ADR 0006: 20 turnos por sesión y 30 peticiones por minuto por IP.
- La clave tiene límites de gasto en su proyecto (configurados por el autor).
- Si Gemini falla o agota la cuota, el agente vuelve solo al motor de reglas (`gemini-planner.ts`, respaldo), y la interfaz lo indica con «Motor: reglas».
- **Interruptor de emergencia:** `GEMINI_SOLO_CON_CODIGO=1` en Vercel (y redesplegar) restaura el comportamiento del ADR 0006, con código del jurado obligatorio y fallo cerrado.

## Alternativas consideradas
- **Mantener el código del jurado (ADR 0006):** protege la cuota, pero degrada la primera impresión de cualquier visitante sin el enlace.
- **Quitar el control sin interruptor:** más simple, pero sin una salida rápida ante abuso.

## Consecuencias
- Cualquier visitante consume cuota; el peor caso es agotarla y caer al motor de reglas, sin caída del servicio.
- El código del jurado y `?codigo=` siguen funcionando, pero solo tienen efecto con el interruptor activo.
- Tests: `src/core/agent/acceso.test.ts` cubre los dos modos.
