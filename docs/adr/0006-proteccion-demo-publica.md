# ADR 0006 · Protección de la demo pública

- **Estado:** Aceptada
- **Fecha:** 2026-11-11

## Contexto
La demo se publica en una URL pública de Vercel (plan Hobby) con una clave de Gemini. Cualquiera con el enlace puede llamar a `/api/agent`; no se quiere que extraños consuman la cuota del autor.

## Modelo de amenazas
- **Abuso de cuota o costo:** llamadas masivas que agoten la cuota de Gemini o generen cargos.
- **Inyección de prompts:** la cubre el Guardián determinista (ADR 0004), que el LLM no puede anular.
- **Denegación de servicio (DoS):** ráfagas de peticiones desde una IP o sesiones interminables.
- **Exfiltración:** sin riesgo material, porque no hay datos reales (solo fixtures sintéticos).

## Decisión
Cuatro capas:
1. **Clave sin facturación:** la clave de Gemini es de un proyecto de Google sin facturación, así que el tope duro es la cuota gratuita y nunca hay cargos. Según aistudio.google.com/docs/billing, «AI Studio usage remains free of charge unless users link a paid API key».
2. **Código del jurado:** todos usan la demo completa en modo determinista; el planner Gemini solo se activa si la petición trae `accessCode` igual a `DEMO_ACCESS_CODE` (comparación en tiempo constante sobre SHA-256 de ambos valores).
3. **Fallo cerrado:** sin `GEMINI_API_KEY`, o sin `DEMO_ACCESS_CODE` (o con menos de 12 caracteres), Gemini queda deshabilitado para todos. El código no se registra ni se devuelve.
4. **Topes:** 20 turnos por sesión (tarjeta `bloqueo` amable, sin planner ni herramientas) y 30 peticiones por minuto por IP (`x-forwarded-for`, ventana deslizante en memoria, 429). El límite por IP es best-effort: en serverless es por instancia; en producción se usaría un almacén compartido. Solo se limita cuando la petición trae IP en `x-forwarded-for` (en Vercel siempre viene); sin cabecera, como en tests o desarrollo local, no se limita para no agrupar a todos en una misma clave.

## Alternativas consideradas
- **Vercel Password Protection:** «Available on Pro for $20 per month per protected project… Not available on Hobby». Descartada por costo y plan.
- **Vercel Authentication:** exige que el visitante tenga cuenta de Vercel; inviable para un jurado externo.
- **Login propio:** más superficie de ataque y código para una demo sin datos reales.

Fuente de las dos primeras: vercel.com/docs/deployment-protection (consultada 2026-11-11).

## Consecuencias
- Sin código válido el producto se degrada al planner determinista (misma demo, sin Gemini); la traza lo explica con el evento `llm.acceso`.
- El código del jurado va en el correo de entrega y **nunca** en el repositorio. Variable nueva: `DEMO_ACCESS_CODE` (≥ 12 caracteres), configurada en Vercel.
- El límite por IP no es una garantía en serverless; la garantía real es la cuota gratuita de la clave.
- El tope de turnos se apoya en `SessionState.turnos` del token firmado; reiniciar la demo crea sesión nueva (la IP sigue limitada).
