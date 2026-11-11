# ESTADO GLOBAL · Postventa Agéntica
> Solo el Orquestador escribe aquí (≤ 40 líneas). Para retomar: este archivo + `PLAN.md` §15.
**Actualizado:** 2026-11-11 17:02 -05 · **Fase:** Olas 2–3 en curso (rama `ola-2-entrega`; `main` = hasta T08) · **Entrega:** 23:00
**Siguiente acción:** recibir T18, T12, T10, T13, T02b → T14 → push al repo recreado → Vercel → T15–T17.
**Usuario:** borrar y recrear el repo (commits viejos con email personal públicos; historial ya reescrito a noreply) · clave Gemini SIN facturación · SESSION_SECRET y DEMO_ACCESS_CODE en su terminal.
**Caso de negocio (v1.1):** base VPN −49.816 USD, sin payback en 36 m; equilibrio operativo 18,4 citas/mes vs 20,9 del embudo; payback 24 m exige 39,3 citas/mes ≈ 2,2 sedes. Optimista payback 4 m.
Estados: ⬜ PENDIENTE · 🔄 EN_CURSO · ✅ HECHA · ⚠️ ESCALADA · ⛔ BLOQUEADA · Int. = intentos fallidos (máx. 2)

| ID | Tarea | Nivel · modelo · esfuerzo | Dep. | Estado | Int. | Prueba (detalle en PLAN) | Nota |
|---|---|---|---|---|---|---|---|
| P | Auditoría, BRD/PRD v1.1, PLAN v1.1 | Orq. | — | ✅ | 0 | archivos creados | D1–D4 resueltas |
| T00 | Base, contratos, esqueleto | ALTO · Orq. | — | ✅ | 0 | tsc 0 · vitest 5/5 · build 0 | 6480aa6, 751ad32 |
| T01 | Mercado y supuestos con fuente | ALTO · opus · high | T00 | ✅ | 0 | final 5/5 · verificador 2/5 + 3 parciales | 411e9b7 |
| T01b | Costos con fuente + notas del verificador | MEDIO · sonnet · medium | T01 | ✅ | 0 | final 5/5 · 29 fuentes · v1.1 | 55bb23a |
| T02 | Datos mock | BAJO · haiku · low | T00 | ✅ | 0 | check:fixtures 1/1 | 2d4a44e |
| T02b | Tarifario 50k/60k + hito exacto | BAJO · haiku · low | T08 | 🔄 | 0 | fixtures + vitest | aviso de T08 |
| T03 | Tools + adaptadores mock | MEDIO · sonnet · medium | T00 | ✅ | 0 | vitest 29/29 | 914465f |
| T04 | Guardián + autonomía + auditoría | ALTO · opus · high | T00 | ✅ | 0 | 156/156 · 31/31 ataques · 0/15 FP | c554a81 |
| T05 | App propietario + layout | MEDIO · sonnet · medium | T00 | ✅ | 0 | vitest 13/13 · visual OK (Chrome) | 7d8dc9f |
| T06 | Rayos X + Memoria + Bandeja | MEDIO · sonnet · medium | T00 | ✅ | 0 | vitest 8/8 · visual OK | 2b2cd41 |
| T07 | Excel 3 años + punto de equilibrio (T07b) | MEDIO · sonnet · medium | T01b | ✅ | 0 | pytest 15/15 (formulas) | ca5ad16 |
| T08 | Orquestador agente + API + sesión firmada | ALTO · opus · high | T02-04 | ✅ | 0 | vitest 269/269 · tsc 0 | 1f0e76c |
| T09 | Planner Gemini + respaldo | MEDIO · sonnet · medium | T00 | ✅ | 0 | vitest 19/19 | 5ba07ff |
| T10 | Evals (≥ 30 casos, 2 modelos) | MEDIO · test-engineer · sonnet | T08 | 🔄 | 0 | npm run evals | LLM: usuario fuera del sandbox |
| T11 | Arquitectura + ADR 0001-0005 | MEDIO · sonnet · medium | T00 | ✅ | 0 | check_mermaid 8/8 | 4e86d66 · render en GitHub pendiente |
| T12 | Integración UI↔API + guion + E2E | MEDIO · sonnet · medium | T08 | 🔄 | 0 | vitest ui + app | envía `accessCode` |
| T13 | Resumen ejecutivo PDF | MEDIO · sonnet · medium | T07,T11 | 🔄 | 0 | WeasyPrint · pdfinfo ≤ 2 | |
| T14 | README, GLOSSARY, .env.example, IA | BAJO · haiku · low | T12,T18 | ⬜ | 0 | comandos README | |
| T15 | Revisión + coherencia | ALTO · opus · high | T12,T13 | ⬜ | 0 | check_coherence + §11 | |
| T16 | Verificación en vivo (Vercel + GitHub) | MEDIO · sonnet · medium | T15 | ⬜ | 0 | 5/5 en URL | |
| T17 | Paquete final | BAJO · haiku · low | T16 | ⬜ | 0 | unzip -l | |
| T18 | Protección demo pública (código jurado, topes) | MEDIO · sonnet · medium | T08 | 🔄 | 0 | vitest completo | ADR 0006 · pedido del usuario |

## Checkpoints
- [x] CP1 (adelantado; repo creado por el usuario, a recrear) · [ ] CP2 · [ ] CP3 · [ ] Batería final §11

## Entregables
- [ ] Prototipo (URL) · [ ] Repo GitHub público · [ ] PDF ≤ 2 págs · [x] XLSX · [x] Arquitectura · [ ] Bitácora final · [ ] ZIP

## Último error / escalado
- Sandbox: sin Chrome, sin sudo, red aislada, `.git/config` de solo lectura → jsdom, WeasyPrint, `formulas`, `git -c user.email`. E2E real, evals LLM y recálculo del Excel los corre el usuario.
