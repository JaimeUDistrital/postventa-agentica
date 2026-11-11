# ADR 0003 · Fuente única de supuestos

- **Estado:** Aceptada
- **Fecha:** 2026-11-11

## Contexto
La rúbrica exige coherencia entre prototipo, modelo financiero y resumen ejecutivo. Si cada pieza guarda sus propios números, se desalinean.

## Decisión
`data/assumptions.json` es la única fuente de supuestos (id, unidad, valores pesimista/base/optimista, fuente o «propio», estado). De ahí leen la app (copia sincronizada con `scripts/sync-assumptions.mjs`), el generador del Excel y, vía `entregables/financial_summary.json`, el PDF. Se valida con esquema Zod (`npm run check:assumptions`) y un script de coherencia (T15). Los parámetros de política del agente (tope de descuento, máximo de contactos, minutos de hold) salen del mismo archivo.

## Alternativas consideradas
- **Números en cada documento:** rápido, pero se desalinean sin aviso.
- **Excel como fuente:** la app tendría que leer un binario; el JSON se versiona y se revisa en un diff.
- **Base de datos de configuración:** sin necesidad hoy (ADR 0005).

## Consecuencias
- Un cambio de supuesto se propaga a las tres piezas con un comando.
- La copia dentro de la app es un artefacto generado; no se edita a mano.
- Cada supuesto sin fuente real queda marcado como «propio» con su experimento de validación.
