# ESTADO GLOBAL · Postventa Agéntica
> Solo el Orquestador escribe aquí (≤ 40 líneas). Para retomar: este archivo + `PLAN.md` §15.
**Actualizado:** 2026-11-11 12:40 -05 · **Fase:** Paso 0 (T00) en curso · **Entrega:** 23:00
**Siguiente acción:** terminar T00 → lanzar Ola 1 (T04, T03, T01, T02, T05; luego T06, T07).
**Pendiente del usuario:** `sudo pacman -S libreoffice-fresh` (antes de T07) · D4 email noreply (antes de CP1 16:00)
Estados: ⬜ PENDIENTE · 🔄 EN_CURSO · ✅ HECHA · ⚠️ ESCALADA · ⛔ BLOQUEADA · Int. = intentos fallidos (máx. 2)

| ID | Tarea | Nivel · modelo · esfuerzo | Dep. | Estado | Int. | Prueba (detalle en PLAN) | Nota |
|---|---|---|---|---|---|---|---|
| P | Auditoría, BRD/PRD v1.1, PLAN v1.1 | Orq. | — | ✅ | 0 | archivos creados | D1–D3 resueltas |
| T00 | Base, contratos, esqueleto | ALTO · Orq. | — | 🔄 | 0 | typecheck+vitest+build+curl+uv | — |
| T01 | Mercado y supuestos con fuente | ALTO · opus · high | T00 | ⬜ | 0 | check:assumptions + verificador | Ola 1 |
| T02 | Datos mock | BAJO · haiku · low | T00 | ⬜ | 0 | check:fixtures | Ola 1 |
| T03 | Tools + adaptadores mock | MEDIO · sonnet · medium | T00 | ⬜ | 0 | vitest tools adapters | Ola 1 |
| T04 | Guardián + autonomía + auditoría | ALTO · opus · high | T00 | ⬜ | 0 | vitest guardrails audit | Ola 1 |
| T05 | App propietario + layout | MEDIO · sonnet · medium | T00 | ⬜ | 0 | playwright owner | Ola 1 |
| T06 | Rayos X + Memoria + Bandeja | MEDIO · sonnet · medium | T00 | ⬜ | 0 | playwright xray | Ola 1 |
| T07 | Generador Excel 3 años | MEDIO · sonnet · medium | T00, LibreOffice | ⬜ | 0 | uv run pytest | Ola 1 |
| T08 | Orquestador agente + API + sesión firmada | ALTO · opus · high | T02-04 | ⬜ | 0 | vitest agent + curl ×5 | Ola 2 |
| T09 | Planner Gemini + respaldo | MEDIO · sonnet · medium | T00 | ⬜ | 0 | vitest agent/llm | Ola 2 · recortable |
| T10 | Evals (≥ 30 casos, 2 modelos) | MEDIO · sonnet · medium | T04,T08 | ⬜ | 0 | npm run evals | Ola 2 |
| T11 | Arquitectura + ADR 0001-0005 | MEDIO · sonnet · medium | T00 | ⬜ | 0 | mermaid-cli 0 errores | Ola 2 |
| T12 | Integración UI↔API + E2E | MEDIO · sonnet · medium | T05,T06,T08 | ⬜ | 0 | playwright escenarios | Ola 3 |
| T13 | Resumen ejecutivo PDF | MEDIO · sonnet · medium | T01,T07,T11 | ⬜ | 0 | pdfinfo ≤ 2 + cifras | Ola 3 |
| T14 | README, GLOSSARY, .env, IA | BAJO · haiku · low | T00 | ⬜ | 0 | comandos README | Ola 3 |
| T15 | Revisión + coherencia | ALTO · opus · high | T12,T13 | ⬜ | 0 | check_coherence + §11 | Ola 4 |
| T16 | Verificación en vivo (Vercel + GitHub) | MEDIO · sonnet · medium | T15 | ⬜ | 0 | 5/5 en URL | Ola 4 |
| T17 | Paquete final | BAJO · haiku · low | T16 | ⬜ | 0 | unzip -l | Ola 4 |

## Checkpoints
- [ ] CP1 16:00 (+ repo público + import en Vercel) · [ ] CP2 18:15 · [ ] CP3 20:15 · [ ] Batería final §11

## Entregables
- [ ] Prototipo (URL) · [ ] Repo GitHub público · [ ] PDF ≤ 2 págs · [ ] XLSX · [ ] Arquitectura + Bitácora · [ ] ZIP

## Último error / escalado
- 12:35 · `sudo` denegado en el sandbox → LibreOffice lo instala el usuario.
