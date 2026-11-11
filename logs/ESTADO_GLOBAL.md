# ESTADO GLOBAL · Postventa Agéntica
> Solo el Orquestador escribe aquí (≤ 40 líneas). Para retomar: este archivo + `PLAN.md` §15.
**Actualizado:** 2026-11-11 19:40 -05 · **Fase:** Ola 4 · calidad de producción (rama `ola-2-entrega`; `main` = GitHub = c035fe6, desplegado) · **Entrega:** 23:00
**Siguiente acción:** verificar T20 → commit → T22 (mismo agente) ∥ T21 (Orq.) → QA funcional completo (script API + Chrome + E2E usuario) → push → T15 → GIF → T17.
**Usuario:** repo ✅ · Vercel ✅ https://postventa-agentica.vercel.app (4 variables, archivo local ignorado por git) · pendiente: probar enlace del jurado, E2E, evals Gemini. **Negocio v1.1:** base VPN −49.816 USD sin payback 36 m; equilibrio 18,4 vs 20,9 citas/mes; optimista payback 4 m.
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
| T14 | README, GLOSSARY, ejemplo de variables, IA | MEDIO · sonnet · low | ✅ | 0 | scripts existen | 341683a |
| T18 | Protección demo (código jurado, topes) | MEDIO · sonnet | ✅ | 0 | vitest 268/268 | 729c210 · ADR 0006 |
| T19 | Rediseño «Consola del asesor» | ALTO · opus · high | ✅ | 0 | UI 47/47 · suite 329 (+3 omit.) · tsc 0 | 32e5f79 · 897ca67 |
| T20 | Bucles UI, pantalla, bandeja, nota interna, código URL, modo libre, agenda | ALTO · opus | ✅ | 0 | vitest 354 (+3 omit.) · tsc 0 · build 0 | 37bff30 |
| T21 | Coherencia del agente + elegir seguro + pase a humano si no entiende 2 veces | MEDIO · Orq. | ✅ | 0 | coherencia 13/13 · suite 371 (+3) · evals 32/32 · tsc 0 | 395b649 · ver git log |
| T22 | Toma de caso: mensajes del asesor, llamada, auditoría IA vs. humano | ALTO · opus (agente T20) | 🔄 | 0 | vitest + e2e | pedido usuario |
| T15 | Revisión + coherencia | ALTO · opus · high | ⬜ | 0 | check_coherence + §11 | |
| T16 | Verificación en vivo | MEDIO · Orq. | ✅ | 0 | 5/5 en URL · API 48 turnos (47×200, 1×400 esperado) | repetir tras T20-T22 |
| T17 | Paquete final | BAJO · haiku | ⬜ | 0 | unzip -l | |

## Checkpoints y entregables
- [x] CP1 · [ ] CP2 (merge + push) · [ ] CP3 · [ ] Batería §11
- [x] URL · [x] Repo recreado · [x] PDF 2 págs · [x] XLSX · [x] Arquitectura + ADR 0006 · [x] Evals · [ ] ZIP

## Último error / escalado
- Sandbox: sin sudo, red aislada, `.git/config` solo lectura → jsdom, WeasyPrint, `formulas`, `git -c user.email`; E2E, evals Gemini y recálculo Excel: usuario. Evals: S05 ya no es caso «no visto».
- Aviso de hidratación en dev = extensión del navegador (`bis_skin_checked`), no la app. Login descartado (ADR 0006); Supabase/RAG = Fase 2 (ADR 0005).
