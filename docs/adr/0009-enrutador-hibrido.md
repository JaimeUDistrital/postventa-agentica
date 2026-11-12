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
  - **Motor de reglas:** aviso inicial, botones, intenciones conocidas (agendar, confirmar, paquete, seguros, elegir seguro, asesor, precio), caso en manos de un asesor (`HANDOFF`), cita confirmada (`CERRADO`), mensaje vacío y todo lo anterior a la cotización.
  - **IA:** solo lo que el motor de reglas no entiende (`fueraDeReglas`: intención «otro» con la cotización ya hecha). Antes, ahí se respondía con el menú.
- **Guardarraíles de la ruta IA:**
  - solo herramientas de consulta (`consultar_contexto_vehiculo`): no cotiza, no agenda y no ofrece seguros. El enrutador filtra además cualquier otra herramienta que proponga la IA (evento `ia.herramienta_descartada`) y, si no queda ninguna, responde el motor de reglas;
  - responde en texto, sin tarjetas y sin mover el estado;
  - solo puede pasar a un humano por `sintoma_critico` o `cliente_molesto`. Si propone otro motivo, se descarta (evento `ia.pase_descartado`) y responde el motor de reglas. `no_resuelto` sigue la regla del ADR 0008 (2 mensajes seguidos sin entender).
- Cada turno deja en la traza el evento `planner.ruta`, con la ruta y el motivo. La Auditoría lo usa para mostrar «Reglas» o «Gemini».
- Si Gemini falla, responde el motor de reglas y la interfaz lo indica (ADR 0002 y 0007).
- El prompt (`postventa-v1.0`) no cambia.

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
