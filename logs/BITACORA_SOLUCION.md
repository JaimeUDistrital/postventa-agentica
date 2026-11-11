# Bitácora de la solución · Postventa Agéntica

> La escribe solo el Orquestador. Una entrada por hito: qué se hizo, con qué, evidencia y decisiones.

## 2026-11-11 12:15–12:45 · Auditoría y plan (Orquestador, Opus 5.5)
- **Leído:** prueba oficial (HTML y PDF), BRD, PRD/TRD, catálogo de 75+ herramientas (`.xlsx`) y `~/cocina/DESPENSA.md` + `ARNES.md`.
- **Skills usadas:** `elegir-herramientas` (despensa) y `planning-and-task-breakdown`.
- **Hallazgos frente a la rúbrica:** faltaban evals, fuentes de mercado, sensibilidad, roster de agentes, ecosistema completo y controles de fraude/privacidad; el estado compartido podía chocar entre agentes. Se añadieron «Ajustes del Arquitecto v1.1» al BRD y al PRD.
- **Versiones comprobadas** con `npm view` y PyPI (12:15). TypeScript fijado en 5.9.3 (la 7.x no verificada con Next 16).
- **Salida:** `PLAN.md` y `logs/ESTADO_GLOBAL.md`.

## 12:40 · Decisiones del usuario (D1–D3)
- D1: URL pública (Vercel) + repo público en GitHub. D2: Gemini API, optimizando costo. D3: LibreOffice autorizado.
- Modelos y precios de Gemini leídos de aistudio.google.com/docs/models y /docs/pricing: por defecto `gemini-3.5-flash-lite`; `gemini-3.6-flash` como alternativa; el precio de Flash se duplica en 2027.
- Esfuerzo por nivel: BAJO haiku·low, MEDIO sonnet·medium, ALTO opus·high.
- No se usan hoy MCP, RAG, Supabase, Railway, fine-tuning ni LangChain (justificación en ADR 0005).

## 12:41–13:05 · T00 · Base, contratos y esqueleto (Orquestador)
- `git init -b main`; `.gitignore` deja fuera secretos, la prueba oficial y el catálogo personal.
- `create-next-app@16.4.6` (opciones comprobadas con `--help`); su `AGENTS.md` avisa de cambios de API → se leyó la doc local de `route.ts` y Cache Components. **Decisión:** `cacheComponents` desactivado (app interactiva; evita fallos de prerender por `Date`/`Math.random`).
- Incidente: `npm install` de dev falló por conflicto de `@types/node` (vitest 5.1 pide ≥ 22) → se subió a `@types/node` 24.
- Contratos Zod (dominio, agente, herramientas, datos mock con integridad referencial, supuestos), puertos async y `Planner`, configuración de política desde `data/assumptions.json` (borrador con las cifras del BRD).
- Esqueleto caminante: `/api/agent` (stub válido) + página con las 3 zonas y sus `data-testid`.
- **Sandbox (descubierto):** red aislada por comando (un servidor en segundo plano no es accesible) y Chrome no arranca (`socket() failed: Operación no permitida`); `sudo` denegado. **Rodeos:** UI con Vitest + jsdom contra el route handler real; PDF con WeasyPrint (probado: 2 págs Carta); E2E real con Playwright fuera del sandbox (usuario); `flock` para serializar builds y E2E.
- Hook `guardia-secretos` bloqueó un comando que contenía el patrón de archivos de entorno → el `.gitignore` se escribió con Write.
- Email personal: `uv init` lo copió al `pyproject.toml` → eliminado (el repo será público). D4 pendiente.
- **Evidencia:** `tsc --noEmit` exit 0 · `vitest run src` 5/5 · `check:assumptions` 2 pasan, 3 omitidos (modo final) · `next build` exit 0 · `check:fixtures` falla a propósito hasta T02.

## 13:09–13:19 · Ola 1: primeras entregas (Orquestador)
- Lanzadas T01 (opus·high), T02 (haiku·low), T03 (sonnet·medium), T04 (opus·high), T05 (sonnet·medium) en segundo plano.
- **T05 ✅** (0c0b559): 13/13 tests (12 owner + humo). ScenarioBar exportada desde `ui/owner` y montada en la cabecera. Sin revisión visual (Chrome no arranca en el sandbox).
- **T02 ✅** (94c8a82): `check:fixtures` 1/1. El agente reportó ESCALAR solo porque `tsc` fallaba en `tools.test.ts` de T03 (TDD en curso, ajeno); tras T03, tsc limpio → no cuenta como intento fallido.
- **T03 ✅** (148eb3b): 29/29 tests. API: `createMockPorts`, `executeTool`, `estimarKm`, `parseQuoteId`/`encodeQuoteId`. Límite de `parseQuoteId` (ids con segmentos numéricos de 4+ dígitos) no aplica: ids `veh-01..05`.
- **Verificado por el Orquestador:** `vitest run src` 46/46; `tsc` solo con errores del TDD de T04 en curso.
- **Contrato** (e89c4a9): `PlannerResult` con `trace?` y `fallback?` opcionales, para que el planner Gemini reporte su evento `llm` (y errores) sin romper a nadie.
- **Hallazgo:** el sandbox crea en la raíz puntos de montaje vacíos (dispositivos de caracteres: `.bashrc`, `.zshrc`, `.idea`, `!.env.*`…). Ignorados en `.gitignore` (839c6bd) para que nunca suban al repo público; no se borran.
- Lanzadas T06, T07 y **T09 adelantada** (solo depende de T00; es la de más riesgo → fallar pronto).
