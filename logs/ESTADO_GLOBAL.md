# ESTADO GLOBAL · Postventa Agéntica
> Solo el Orquestador escribe aquí (≤ 40 líneas). Para retomar: este archivo + `PLAN.md` §15.
**Actualizado:** 2026-11-11 17:35 -05 · **Fase:** Ola 3 (rama `ola-2-entrega`; `main` = hasta T08) · **Entrega:** 23:00
**Siguiente acción:** recibir T19 (rediseño) y T14 → revisión visual en Chrome → merge a `main` → push → Vercel → T15–T17.
**Usuario:** borrar y recrear el repo · clave Gemini SIN facturación · SESSION_SECRET y DEMO_ACCESS_CODE en su terminal · Vercel sin clave de Gemini hasta el merge de T18.
**Caso de negocio (v1.1):** base VPN −49.816 USD, sin payback en 36 m; equilibrio operativo 18,4 vs 20,9 citas/mes; payback 24 m ≈ 2,2 sedes. Optimista payback 4 m.
Estados: ⬜ PENDIENTE · 🔄 EN_CURSO · ✅ HECHA · ⚠️ ESCALADA · ⛔ BLOQUEADA · Int. = intentos fallidos (máx. 2)

| ID | Tarea | Nivel · modelo · esfuerzo | Estado | Int. | Prueba | Commit · nota |
|---|---|---|---|---|---|---|
| T00 | Base, contratos, esqueleto | ALTO · Orq. | ✅ | 0 | tsc 0 · build 0 | 6480aa6 |
| T01 / T01b | Supuestos con fuente / costos con fuente | ALTO opus / MEDIO sonnet | ✅ | 0 | final 5/5 · 29 fuentes · v1.1 | 411e9b7 · 55bb23a |
| T02 / T02b | Datos mock / tarifario hasta 60k | BAJO · haiku | ✅ | 0 | fixtures 1/1 | 2d4a44e · fe449c6 |
| T03 | Tools + adaptadores mock | MEDIO · sonnet | ✅ | 0 | vitest 29/29 | 914465f |
| T04 / T04b | Guardián / recall de síntomas | ALTO opus / MEDIO sonnet | ✅ | 0 | 174/174 · 31/31 ataques | c554a81 · b97cb5a |
| T05 | App propietario + layout | MEDIO · sonnet | ✅ | 0 | vitest + visual OK | 7d8dc9f |
| T06 | Rayos X + Memoria + Bandeja | MEDIO · sonnet | ✅ | 0 | vitest + visual OK | 2b2cd41 |
| T07 / T07b | Excel 3 años / punto de equilibrio | MEDIO · sonnet | ✅ | 0 | pytest 15/15 (formulas) | ca5ad16 |
| T08 | Orquestador + API + sesión HMAC | ALTO · opus | ✅ | 0 | vitest 269/269 | 1f0e76c |
| T09 | Planner Gemini + respaldo | MEDIO · sonnet | ✅ | 0 | vitest 19/19 | 5ba07ff |
| T10 | Evals (32 casos) | MEDIO · test-engineer | ✅ | 0 | evals 32/32 · seg. 18/18 | d6275c9 · LLM: usuario |
| T11 | Arquitectura + ADR 0001-0005 | MEDIO · sonnet | ✅ | 0 | check_mermaid 8/8 | 4e86d66 · render en GitHub |
| T12 | Integración UI↔API + guion | MEDIO · sonnet | ✅ | 0 | vitest UI 39/39 | 1272dbc |
| T13 | Resumen ejecutivo PDF | MEDIO · sonnet | ✅ | 0 | Pages 2 · check_pdf OK | 1779922 · falta URL |
| T14 | README, GLOSSARY, .env.example, IA | MEDIO · sonnet · low | 🔄 | 0 | scripts existen | |
| T18 | Protección demo (código jurado, topes) | MEDIO · sonnet | ✅ | 0 | vitest 268/268 | 729c210 · ADR 0006 |
| T19 | Rediseño «Consola del asesor» | ALTO · opus · high | 🔄 | 0 | vitest UI + humo | pedido del usuario |
| T15 | Revisión + coherencia | ALTO · opus · high | ⬜ | 0 | check_coherence + §11 | |
| T16 | Verificación en vivo | MEDIO · sonnet | ⬜ | 0 | 5/5 en URL | |
| T17 | Paquete final | BAJO · haiku | ⬜ | 0 | unzip -l | |

## Checkpoints y entregables
- [x] CP1 · [ ] CP2 (merge + push) · [ ] CP3 · [ ] Batería §11
- [ ] URL · [ ] Repo recreado · [x] PDF 2 págs · [x] XLSX · [x] Arquitectura + ADR 0006 · [x] Evals · [ ] ZIP

## Último error / escalado
- Sandbox: sin Chrome, sin sudo, red aislada, `.git/config` de solo lectura → jsdom, WeasyPrint, `formulas`, `git -c user.email`. E2E real, evals con Gemini y recálculo del Excel los corre el usuario.
- Evals: S05 se usó para corregir el detector (ya no es caso «no visto»); añadir casos nuevos sin ver si sobra tiempo.
