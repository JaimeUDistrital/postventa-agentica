# ADR 0008 · Pase a humano: cuándo bloquea la conversación y cuándo no

- **Estado:** Aceptada
- **Fecha:** 2026-11-11

## Contexto
La prueba de funcionamiento contra la API en vivo (11 casos, 48 turnos) mostró varias incoherencias:
- tras pasar el caso a un asesor, el agente seguía ofreciendo agendar;
- con la cita confirmada, una pregunta de precio devolvía el estado a cotización;
- elegir un seguro no estaba soportado;
- los mensajes no entendidos repetían el mismo menú.

## Decisión
- **Casos que bloquean** (el estado pasa a `HANDOFF` y el agente solo responde que le atiende un asesor): `sintoma_critico`, `sin_stock`, `cliente_molesto` (pide asesor), `adversarial` (vía Guardián) y `no_resuelto`.
- **`no_resuelto`:** se abre cuando el motor de reglas no entiende dos mensajes seguidos (la 1.ª vez ofrece opciones y «escriba asesor»). También se abre cuando el cliente pide cambiar o cancelar una cita confirmada.
- **Casos que NO bloquean:** `seguro`. El cliente elige una oferta (número, ordinal, producto o el botón «Elegir este seguro»), el agente confirma y un asesor certificado emite la póliza. La IA no emite pólizas ni pide documentos por WhatsApp, y el cliente puede seguir y agendar su mantenimiento.
- **Con la cita confirmada (`CERRADO`):** no se vuelve a cotizar ni a agendar; el agente recuerda la cita y ofrece la salida a una persona.
- La regla de no bloqueo vive en el orquestador (`estadoSeguro`), así que aplica igual con el motor de reglas que con Gemini.

## Alternativas consideradas
- **Bloquear siempre que haya caso:** sencillo, pero impide vender el mantenimiento a quien eligió un seguro.
- **Que la IA venda el seguro de punta a punta:** exige validar identidad y datos personales por chat; queda fuera del alcance y del apetito de riesgo.

## Consecuencias
- Contrato: `HandoffReason` añade `seguro` y `no_resuelto` (etiquetas en la bandeja y en el copiloto).
- Tests: `src/core/agent/coherencia.test.ts` (13 casos); evals 32/32 sin regresiones.
