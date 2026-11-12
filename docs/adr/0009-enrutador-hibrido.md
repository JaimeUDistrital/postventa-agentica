# ADR 0009 · Enrutador híbrido: reglas para lo exacto, IA para lo abierto

- **Estado:** Aceptada (precisa el ADR 0002)
- **Fecha:** 2026-11-11

## Contexto
Con la IA para todos (ADR 0007), una prueba contra la API en vivo con Gemini mostró que el modelo improvisa en lo que debe ser exacto:
- el botón «Agendar» mostraba seguros o abría un caso de seguro en vez de apartar el cupo;
- agregar dos veces el paquete de desgaste abría un caso «sin stock» inventado;
- «hola» o «no entiendo» repetían las ofertas de seguros;
- con el caso en manos de un asesor, cada mensaje del cliente abría un caso nuevo;
- con la cita confirmada, una pregunta de precio pasaba a un humano.

El motor de reglas resuelve bien esos casos (evals en modo determinista: 32/32 casos, 70 turnos, sin ejecuciones descartadas; `npm run evals`), pero no entiende preguntas abiertas.

## Decisión
- Con la IA activa, el planner es un **enrutador híbrido** (`src/core/agent/planner-hibrido.ts`):
  - **Motor de reglas:** aviso inicial, botones, intenciones conocidas (agendar, confirmar, paquete, seguros, elegir seguro, asesor, precio, qué incluye y cuánto dura, y datos del taller que el sistema no tiene, como sala de espera, wifi o días de atención), caso en manos de un asesor (`HANDOFF`), cita confirmada (`CERRADO`), mensaje vacío y todo lo anterior a la cotización.
  - **IA:** solo lo que el motor de reglas no entiende (`fueraDeReglas`: intención «otro» con la cotización ya hecha). Antes, ahí se respondía con el menú.
- **Guardarraíles de la ruta IA:**
  - solo herramientas de consulta (`consultar_contexto_vehiculo`): no cotiza, no agenda y no ofrece seguros. El enrutador filtra además cualquier otra herramienta que proponga la IA (evento `ia.herramienta_descartada`) y, si no queda ninguna, responde el motor de reglas;
  - cada consulta se ofrece una sola vez por turno: en vivo, Gemini repetía `consultar_contexto_vehiculo` hasta agotar las iteraciones y nunca respondía. Tras la primera consulta solo le queda «responder». Si Gemini falla, la respuesta del respaldo (motor de reglas) se respeta tal cual;
  - si aun así se agotan las iteraciones, el orquestador abre de verdad el caso `no_resuelto` que su mensaje promete;
  - responde en texto, sin tarjetas y sin mover el estado;
  - solo puede pasar a un humano por `sintoma_critico` o `cliente_molesto`. Si propone otro motivo, se descarta (evento `ia.pase_descartado`) y responde el motor de reglas. `no_resuelto` sigue la regla del ADR 0008 (2 mensajes seguidos sin entender).
  - ese pase solo vale si el mensaje del cliente lo respalda (palabras de falla o de queja). En vivo, Gemini marcó `sintoma_critico` ante un «hola»; sin respaldo se descarta igual (`ia.pase_descartado`);
  - no promete mostrar nada («le comparto», «aquí tiene»): su ruta no muestra tarjetas; si lo hace, responde el motor de reglas (evento `ia.promesa_descartada`). En vivo, Gemini prometía «las opciones que le comparto» y afirmó «contamos con sala de espera y wifi», dato que el sistema no tiene; por eso esas preguntas pasaron a las reglas;
  - no envía duraciones ni precios en texto libre: «qué incluye» y «cuánto dura» salen del tarifario por reglas, y si la IA escribe «cuatro horas» o «200 mil pesos», el Guardián lo reemplaza por un texto seguro (evento `ia.dato_no_verificado`). Falla hacia lo seguro: una cifra legítima del contexto también se reemplaza;
- Cada turno deja en la traza el evento `planner.ruta`, con la ruta y el motivo. La Auditoría lo usa para mostrar «Reglas» o «Gemini».
- Si Gemini falla, responde el motor de reglas y la interfaz lo indica (ADR 0002 y 0007).
- Prompt `postventa-v1.3`: no afirmar datos fuera de herramientas, responder solo el último mensaje, incluir «handoff» solo ante un síntoma o una queja y, sin herramienta de cotización, no prometer tarjetas (la ruta IA no las muestra). Se mide con el QA en vivo, porque los evals no pasan por la ruta IA.

## Alternativas consideradas
- **Solo Gemini con un prompt más estricto:** depende de que el modelo obedezca, y los fallos vistos eran decisiones estructuradas que un prompt no garantiza.
- **Una guarda en el orquestador por cada fallo:** parchea síntomas uno a uno y deja que la IA siga decidiendo botones y estados.
- **Solo motor de reglas:** exacto, pero no entiende preguntas abiertas (el motivo del ADR 0007).

## Consecuencias
- Menos llamadas a Gemini: el aviso inicial y los botones no lo usan, lo que baja el costo y la latencia.
- Una frase abierta que contenga una palabra clave la resuelven las reglas (p. ej. «¿cuánto cuesta y qué incluye?» → cotización). Se acepta: la cotización es la respuesta segura.
- El texto de la IA aún puede mencionar seguros, aunque no pueda mostrarlos. Se revisa en la próxima prueba en vivo.
- Tests: `src/core/agent/planner-hibrido.test.ts` (26, `npx vitest run`), `acceso.test.ts` (ruta IA y ruta de reglas) y `src/ui/audit/audit.test.tsx` (motor por turno: «Gemini» solo si la ruta fue IA).
- El arnés de evals con Gemini usa el mismo enrutador que producción. Pendiente: medir cuántos turnos llegan a la ruta IA y añadir casos propios de esa ruta; sin eso, la corrida con Gemini mide sobre todo al motor de reglas.
