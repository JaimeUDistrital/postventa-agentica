# Declaración de uso de IA

## Cómo se usó

- **Claude Code como orquestador**: dividió el trabajo en tareas (T00–T22, ver `PLAN.md` y `logs/tareas/`) y delegó cada una a sub-agentes con modelo según la dificultad (alto: arquitectura, Guardián, orquestador; medio: herramientas, UI, evals, modelo financiero; bajo: datos mock y documentación). Cada sub-agente dejó su informe en `logs/tareas/`.
- **Gemini en el producto**: en la demo atiende a todos los visitantes, con topes (ADR 0007), mediante un enrutador híbrido (ADR 0009). El motor de reglas resuelve lo exacto (botones, agendar, seguros, casos con un asesor) y Gemini responde las preguntas abiertas, solo con herramientas de consulta. El Guardián determinista valida entradas y salidas y el LLM no puede anularlo. Sin Gemini, el motor de reglas da el mismo recorrido.

## Qué verificó el humano

- Decisiones de alcance, supuestos clave del caso de negocio y el rumbo de cada ola.
- Creación y control de claves (Gemini con límites de gasto, secretos en su terminal) y la publicación.
- Revisión de la salida de los sub-agentes en los puntos de control del plan.

## Qué se verificó con pruebas

- Tests unitarios y de integración del prototipo (`npm test`), tipos (`npm run typecheck`), coherencia de datos (`npm run check:fixtures`) y supuestos con fuente (`npm run check:assumptions:final`).
- 32 casos de evals en modo determinista, con criterios pasa/no pasa y precios recalculados de forma independiente (`npm run evals`; ver `prototipo/evals/REPORTE_EVALS.md`).
- Modelo financiero: tests de fórmulas del Excel (`uv run pytest -q` en `modelo_financiero/`).
- Afirmaciones técnicas y fuentes de mercado: pasada de verificación (`logs/tareas/T01_verificacion.md`).

## Qué NO se verificó

- E2E en navegador real (Playwright): lo corre el usuario fuera del sandbox.
- Evals con Gemini real: la corrida en el sandbox fue no concluyente (0 llamadas OK, todo cayó al planner determinista); las corre el usuario fuera del sandbox. El cliente de Gemini no se probó contra la red real.
- Recálculo del Excel con LibreOffice: no hecho; las fórmulas se probaron con la librería `formulas`.
- Render de los diagramas Mermaid en GitHub: pendiente de comprobar.
- Datos y integraciones son ficticios o simulados; el límite de peticiones por IP es best-effort.

## Cifras

Las cifras del caso de negocio salen de `data/assumptions.json` (cada una con fuente o declarada como supuesto) y del modelo; el resumen está en `entregables/financial_summary.json`. Si una cifra no tiene fuente verificada, el documento la marca como supuesto.
