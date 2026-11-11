# ESTADO GLOBAL · Postventa Agéntica
> Solo el Orquestador escribe aquí (≤ 40 líneas). Para retomar: este archivo + `PLAN.md` §15.
**Actualizado:** 2026-11-11 13:19 -05 · **Fase:** Ola 1 en curso (rama `ola-1-modulos`) · **Entrega:** 23:00
**Siguiente acción:** recibir reportes de T01, T04, T06, T07, T09 (T09 adelantada de Ola 2: solo depende de T00); al liberarse cupo, T11.
**Pendiente del usuario:** `npm run dev` en una pestaña (revisión visual) · D4 email noreply (antes de CP1 16:00)
Estados: ⬜ PENDIENTE · 🔄 EN_CURSO · ✅ HECHA · ⚠️ ESCALADA · ⛔ BLOQUEADA · Int. = intentos fallidos (máx. 2)

| ID | Tarea | Nivel · modelo · esfuerzo | Dep. | Estado | Int. | Prueba (detalle en PLAN) | Nota |
|---|---|---|---|---|---|---|---|
| P | Auditoría, BRD/PRD v1.1, PLAN v1.1 | Orq. | — | ✅ | 0 | archivos creados | D1–D3 resueltas |
| T00 | Base, contratos, esqueleto | ALTO · Orq. | — | ✅ | 0 | tsc 0 · vitest 5/5 · build 0 | commits 175fc57, 8f31740 |
| T01 | Mercado y supuestos con fuente | ALTO · opus · high | T00 | 🔄 | 0 | check:assumptions:final | Ola 1 |
| T02 | Datos mock | BAJO · haiku · low | T00 | ✅ | 0 | check:fixtures 1/1 | 94c8a82 |
| T03 | Tools + adaptadores mock | MEDIO · sonnet · medium | T00 | ✅ | 0 | vitest 29/29 | 148eb3b |
| T04 | Guardián + autonomía + auditoría | ALTO · opus · high | T00 | 🔄 | 0 | vitest guardrails audit | Ola 1 |
| T05 | App propietario + layout | MEDIO · sonnet · medium | T00 | ✅ | 0 | vitest 13/13 (jsdom) | 0c0b559 · sin revisión visual |
| T06 | Rayos X + Memoria + Bandeja | MEDIO · sonnet · medium | T00 | 🔄 | 0 | vitest ui/xray advisor (jsdom) | Ola 1 |
| T07 | Generador Excel 3 años | MEDIO · sonnet · medium | T00 | 🔄 | 0 | uv run pytest (formulas) | Ola 1 |
| T08 | Orquestador agente + API + sesión firmada | ALTO · opus · high | T02-04 | ⬜ | 0 | vitest agent + route | Ola 2 |
| T09 | Planner Gemini + respaldo | MEDIO · sonnet · medium | T00 | 🔄 | 0 | vitest agent/llm | adelantada · recortable |
| T10 | Evals (≥ 30 casos, 2 modelos) | MEDIO · sonnet · medium | T04,T08 | ⬜ | 0 | npm run evals | Ola 2 |
| T11 | Arquitectura + ADR 0001-0005 | MEDIO · sonnet · medium | T00 | ⬜ | 0 | mermaid-cli 0 errores | Ola 2 |
| T12 | Integración UI↔API + E2E | MEDIO · sonnet · medium | T05,T06,T08 | ⬜ | 0 | vitest ui/demo + e2e (usuario) | Ola 3 |
| T13 | Resumen ejecutivo PDF | MEDIO · sonnet · medium | T01,T07,T11 | ⬜ | 0 | WeasyPrint + pdfinfo ≤ 2 | Ola 3 |
| T14 | README, GLOSSARY, .env, IA | BAJO · haiku · low | T00 | ⬜ | 0 | comandos README | Ola 3 |
| T15 | Revisión + coherencia | ALTO · opus · high | T12,T13 | ⬜ | 0 | check_coherence + §11 | Ola 4 |
| T16 | Verificación en vivo (Vercel + GitHub) | MEDIO · sonnet · medium | T15 | ⬜ | 0 | 5/5 en URL | Ola 4 |
| T17 | Paquete final | BAJO · haiku · low | T16 | ⬜ | 0 | unzip -l | Ola 4 |

## Checkpoints
- [ ] CP1 16:00 (+ repo público + import en Vercel + `npm run e2e` del usuario) · [ ] CP2 18:15 · [ ] CP3 20:15 · [ ] Batería final §11

## Entregables
- [ ] Prototipo (URL) · [ ] Repo GitHub público · [ ] PDF ≤ 2 págs · [ ] XLSX · [ ] Arquitectura + Bitácora · [ ] ZIP

## Último error / escalado
- Sandbox: sin Chrome, sin sudo, red aislada, LibreOffice no recalcula → jsdom, WeasyPrint, `formulas`; E2E real y recálculo final los corre el usuario.
