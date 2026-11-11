# PLAN.md · Postventa Automotriz Agéntica (Periferia IT)

> **Para retomar en cualquier momento:** lee solo este archivo + `logs/ESTADO_GLOBAL.md` (lista de tareas viva; sustituye a `tasks/todo.md`).
> **Entrega:** 2026-11-11 **23:00 (-05)**. Plan v1.1 (v1 12:45 · v1.1: Gemini, GitHub público, esfuerzo por nivel, sesión firmada).
> **Insumos (solo lectura):** prueba oficial (HTML/PDF), BRD v1.1, PRD_TRD v1.1 (ambos con «Ajustes del Arquitecto» al final).

---

## 1. Qué entregamos (definición de hecho global)

| Criterio de la rúbrica | Evidencia | Tareas |
|---|---|---|
| Ecosistema y experiencia end-to-end | PDF pág. 1 + `ARQUITECTURA_Y_SOLUCION.md` (ecosistema y ciclo de vida) | T11, T13 |
| Solución agéntica: integración, autonomía, guardrails, **evals** | Prototipo + `prototipo/evals/REPORTE_EVALS.md` + arquitectura | T03–T10 |
| Caso de negocio: rigor, fuentes, supuestos, sensibilidad | `entregables/MODELO_FINANCIERO_POSTVENTA_3Y.xlsx` + `docs/investigacion/FUENTES_MERCADO.md` | T01, T07 |
| Prototipo y excepciones | 1 camino feliz + 4 excepciones + handoff visible en Rayos X | T05, T06, T08, T12, T16 |
| Comunicación y declaración de IA | `entregables/RESUMEN_EJECUTIVO_COMITE.pdf` (≤ 2 págs) + `DECLARACION_USO_IA.md` | T13, T14 |
| Trazabilidad del trabajo | `logs/BITACORA_SOLUCION.md` + commits por tarea | Orquestador |

---

## 2. Decisiones de arquitectura (cada una con ADR en `docs/adr/`)

1. **Monolito modular en Next.js:** una sola app (UI + API route) que se despliega de un golpe y oculta la API key en el servidor.
2. **Núcleo puro:** `prototipo/src/core` no importa Next ni React → se prueba con Vitest sin UI.
3. **Puertos y adaptadores:** CRM, Inventario, Taller, Tarifario y Aseguradoras son interfaces. Hoy, adaptadores mock; mañana, DMS/CRM reales sin tocar el agente.
4. **Agente híbrido:** el Guardián (determinista) revisa antes y después de cada turno. El planner es Gemini con function calling (el modelo pide ejecutar funciones tipadas) si hay `GEMINI_API_KEY`; si no, un planner determinista con el mismo contrato. La demo nunca se cae.
5. **Fuente única de números:** `data/assumptions.json` alimenta Excel, PDF y prototipo; `entregables/financial_summary.json` (sale del generador del Excel) alimenta el PDF. T15 lo comprueba con un script.
6. **Sandbox (comprobado en T00):** cada comando tiene su propia red y Chrome no arranca dentro (`socket() failed`). Por eso: pruebas de UI con Vitest + jsdom (página y route handler reales); PDF con WeasyPrint; el E2E en navegador real (`npm run e2e`, Playwright) lo corre el usuario en su terminal en los checkpoints; la revisión visual se hace con Claude in Chrome sobre el `npm run dev` que el usuario deja corriendo en su terminal (localhost:3000) o sobre la URL de Vercel. Builds y E2E van en fila con `flock .e2e.lock`.
7. **Sesión sin estado en el servidor:** en Vercel cada petición puede caer en otra instancia, así que la memoria de sesión viaja en un token firmado (HMAC con `SESSION_SECRET`) que el servidor verifica. Precios, stock y reglas se recalculan siempre en el servidor.
8. **Hoy no usamos MCP, RAG, Supabase, Railway, fine-tuning ni LangChain** (ADR 0005): los datos son estructurados (consultas deterministas, sin RAG); SDK oficial directo (sin LangChain); Vercel sirve UI y API (sin Railway). Los puertos permiten exponer las tools como servidor MCP o pasar a Postgres/Supabase después.

### Stack fijado (versiones: `npm view` y PyPI, 2026-11-11 12:15)

| Pieza | Versión | Nota |
|---|---|---|
| next / create-next-app | 16.4.6 | App Router |
| react, react-dom | 19.3.1 | |
| typescript | **5.9.3** | No la 7.0.2 (nativa): compatibilidad con Next 16 no verificada |
| tailwindcss | 4.3.5 | |
| zod | 4.6.7 | contratos y validación |
| lucide-react | 1.72.0 | iconos |
| vitest | 5.1.0 | unit + evals |
| @playwright/test | 1.65.0 | E2E con el Chrome del sistema (`channel: 'chrome'`); solo fuera del sandbox |
| jsdom · @testing-library/react · @testing-library/dom | 31.0.0 · 16.3.3 · 10.4.2 | pruebas de UI dentro del sandbox |
| @google/genai | 3.1.0 | SDK oficial de Gemini (no el antiguo `@google/generative-ai`) |
| Python 3.14.9 + uv 0.13.7 + openpyxl 3.1.5 + pytest | — | generador del Excel |
| libreoffice-fresh | 26.8.2 (cachyos-extra-v3) | recálculo de fórmulas que exige la skill `xlsx`; suplente: `formulas` 1.3.4 |
| weasyprint | 70.0 | HTML → PDF dentro del sandbox (probado: 2 págs Carta); `pdfinfo` cuenta páginas |
| @mermaid-js/mermaid-cli | 12.2.0 | validar diagramas vía `npx` (opcional) |

**Modelo del agente dentro de la app** (comprobado: aistudio.google.com/docs/models y /docs/pricing, 2026-11-11):
- Por defecto `gemini-3.5-flash-lite` (estable; USD 0,30 entrada / 2,50 salida por 1M tokens).
- Alternativa vía `GEMINI_MODEL`: `gemini-3.6-flash` (estable; USD 0,75 / 3,75 hasta el 31-12-2026; **1,50 / 7,50 desde 2027** → el modelo financiero usa precios 2027).
- Decide T10 con evals (acierto y costo). El nivel gratuito usa los datos para mejorar productos de Google: vale para la demo con datos ficticios; producción en nivel de pago. Soporte de function calling por modelo: no verificado (lo comprueba T09).

---

## 3. Agentes del PRODUCTO (lo que ve el jurado)

| Agente | Objetivo | Herramientas | Puede | Prohibido | Memoria |
|---|---|---|---|---|---|
| **Proactivo** (disparador) | Detectar el vehículo cerca de su hito de km | `consultar_contexto_vehiculo`, estimador de km, registro de consentimiento | Informar; proponer contacto si hay opt-in | Contactar sin opt-in; > 1 contacto cada 30 días | Historial de contactos (CRM) |
| **Postventa** (conversacional; LLM o determinista) | Resolver el mantenimiento en 1 clic | `verificar_stock_y_precio`, `agendar_bahia_taller`, `cotizar_aliados_seguros`, `escalar_asesor_humano` | Informar, recomendar, ejecutar reserva, apartar repuesto, OT preliminar | Diagnosticar, aprobar garantías, descuento > tope, cobrar sin confirmación, inventar precios | Sesión + perfil del vehículo |
| **Guardián** (determinista, sin LLM) | Seguridad y cumplimiento | Detectores de inyección, PII, síntomas críticos; validador de salida | Bloquear, enmascarar, escalar | Ser anulado por el LLM | Log de auditoría |
| **Copiloto del asesor** | Preparar el handoff | Resumen de caso | Resumir y sugerir siguiente paso | Hablar con el cliente o ejecutar | Caso abierto |

**Memoria visible:** la consola Rayos X muestra qué recuerda cada agente en el turno (perfil del vehículo, historial, contactos previos, estado de sesión, intentos bloqueados).

**Integración en producción** (se documenta, no se construye): WhatsApp Business Platform, DMS/ERP (OT y repuestos), CRM, agenda del taller, cotizadores de aseguradoras, observabilidad de LLM (OpenTelemetry/Langfuse; no verificado).

---

## 4. Contratos (los crea T00; solo el Orquestador los cambia)

**Fuente de verdad: el código** (✅ T00): `prototipo/src/core/contracts/{domain,agent,tools,fixtures,assumptions}.ts`, `src/core/ports/index.ts` (puertos async + `Planner`), `src/core/config/index.ts` (política, `DEMO_NOW` fijo, `llmConfig`), `src/ui/contracts.ts` (props y `DemoSession`). Resumen:
- `Owner`, `Vehicle`, `Consent{canal, optIn, fecha, finalidad}`
- `Part{sku, stock, precio}`, `PriceQuote{items[], subtotal, descuentoPct, total, fuente:'tarifario'}`, `BaySlot`, `Booking{id, idempotencyKey, holdHasta}`, `InsuranceOffer`
- `HandoffCase{id, motivo:'sintoma_critico'|'sin_stock'|'adversarial'|'garantia'|'cliente_molesto', prioridad, resumen, contexto, trazaIds[]}`
- `TraceEvent{id, ts, kind:'guardrail'|'tool_call'|'tool_result'|'policy'|'llm'|'handoff'|'state', name, system:'CRM'|'Inventario'|'Taller'|'Tarifario'|'Aseguradoras'|'Guardián'|'LLM', autonomy?:'informar'|'recomendar'|'ejecutar'|'prohibido', payload (PII enmascarada), latencyMs, status:'ok'|'blocked'|'error'|'escalated'}`
- `GuardrailVerdict{allow, reasons[], maskedInput, riskScore}`
- `AgentTurn{sessionId, turnId, state, reply{text, cards[]}, trace[], handoff?, guardrail, mode:'deterministic'|'llm', memory: MemorySnapshot, stateToken}`
- `MemorySnapshot` por agente: `proactivo`, `postventa`, `guardian`, `copiloto`.
- El planner (determinista o Gemini) **nunca escribe precios ni reservas**: devuelve `showCards` y el orquestador arma las tarjetas desde resultados de herramientas verificados.
- **Estados:** `TRIGGER → CONTACTO → COTIZACION → VENTA_CRUZADA → CONFIRMACION → CERRADO`; salidas `HANDOFF` y `BLOQUEADO`.
- **Escenarios:** `feliz`, `sintoma_critico`, `sin_stock`, `adversarial`, `sin_consentimiento`.
- **Puertos:** `CrmPort`, `InventoryPort`, `WorkshopPort`, `PricingPort`, `InsurerPort`, `Planner`.
- **API:** `POST /api/agent {sessionId, scenarioId, message, stateToken?}` → `AgentTurn` (el token firmado lleva la memoria de sesión).
- **`data-testid`:** `owner-chat`, `xray-console`, `advisor-inbox`, `memory-panel`, `scenario-btn-<id>`, `trace-event`, `handoff-card`, `mode-badge`.
- **`data/assumptions.json`:** `supuestos[{id, nombre, unidad, pesimista, base, optimista, fuente_id|null, tipo:'mercado'|'propio', estado:'borrador'|'final', validacion}]` + `fuentes[{id, titulo, url, fecha_consulta}]`; esquema Zod + `npm run check:assumptions`.

---

## 5. Agentes de DESARROLLO: nivel, modelo y herramientas

| Nivel | Modelo (`Agent.model`) | Esfuerzo (`Agent.effort`) | `subagent_type` | Para qué |
|---|---|---|---|---|
| Orquestador | sesión principal (Opus 5.5) | el de la sesión | — | Paso 0, contratos, asignar, verificar, commits, ESTADO y BITÁCORA |
| **[ALTO]** | `opus` | `high` | general-purpose · agent-skills:security-auditor · agent-skills:code-reviewer | Núcleo, Guardián, investigación, rescate de escalados, revisión |
| **[MEDIO]** | `sonnet` | `medium` | general-purpose · agent-skills:test-engineer | Tools, UI, Excel, evals, docs técnicas, PDF |
| **[BAJO]** | `haiku` | `low` | general-purpose | Datos mock, README y glosario, empaquetado |

**Eficiencia:** cada tarea usa el modelo y el esfuerzo más baratos que la resuelven; nunca el máximo en tareas mecánicas. Si no pasa su prueba 2 veces, el sub-agente para y avisa al Orquestador, que la relanza en [ALTO] (`opus` · `high`) con el log del error.

**Herramientas permitidas a cada sub-agente:** Read/Edit/Write **solo en las rutas que posee**; Bash solo para su prueba (vitest, playwright, uv, pdfinfo); WebSearch/WebFetch solo T01 y el agente `verificador`; Claude in Chrome solo T05, T06, T12 y T16, contra el `npm run dev` del usuario (localhost:3000) o la URL de Vercel. Ningún sub-agente lanza servidores ni instala nada.

**Skills por frente** (todas instaladas salvo indicación):
- **UI/UX:** agent-skills:frontend-ui-engineering · dataviz · Claude in Chrome para revisión visual.
- **Arquitectura y clean code:** codebase-design · domain-modeling · agent-skills:api-and-interface-design · agent-skills:incremental-implementation · agent-skills:documentation-and-adrs · claude-api · /simplify.
- **Seguridad y guardrails:** agent-skills:security-and-hardening · /security-review · agente agent-skills:security-auditor.
- **Testing y verificación:** agent-skills:test-driven-development · verification-before-completion · agente agent-skills:test-engineer · anthropic-skills:xlsx · anthropic-skills:pdf · /code-review medium.
- **Del catálogo, aplicadas como regla (sin instalar):** ponytail/karpathy (código mínimo; ya en tus normas), anti-slop (textos sin relleno en PDF y docs), Vercel Design Guidelines (T05/T06 la leen con WebFetch como checklist; instalarla en el `.claude/skills` del proyecto lo bloquea el sandbox), superpowers (verification-before-completion y receiving-code-review, ya instaladas), agency-agents (en su lugar, los agentes code-reviewer, security-auditor y test-engineer del plugin).
- **Descartadas hoy:** impeccable, claude-octopus, gstack, claude-mem y OmniRoute (riesgo X en tu despensa); ui-ux-pro-max y taste-skill (duplican); Strix (Docker + clave; sin tiempo); memorias externas (mempalace, agentmemory, codebase-memory-mcp): la memoria de desarrollo es `ESTADO_GLOBAL` + `logs/tareas` + git; Figma MCP, Obsidian, watermarks, headroom, thermos, task-observer, unlazy, one-skill y OpenViking: no aplican o no están evaluadas; security-guidance (hooks en cada edición).

---

## 6. Reglas de gobierno

1. **Circuit breaker.** Un intento = correr la prueba de la tarea tras declararla lista.
   - [BAJO]/[MEDIO]: **2 fallos → para**, escribe el error exacto en `logs/tareas/Txx.md` y devuelve `ESCALAR`. El Orquestador reasigna a [ALTO] (`opus`) con ese log. **Prohibido el 3.er intento.**
   - [ALTO]: 2 fallos → `BLOQUEADA` y se pregunta al usuario.
   - También escala quien pase 1,5× su tiempo asignado.
2. **Anti-colisión.** Cada tarea escribe solo en sus rutas (§9). Contratos, `package.json` y `pyproject.toml`: solo el Orquestador. Nadie instala nada.
3. **Estado.** Solo el Orquestador escribe `logs/ESTADO_GLOBAL.md` (≤ 40 líneas) y `logs/BITACORA_SOLUCION.md`. Cada sub-agente deja su detalle en `logs/tareas/Txx.md` y devuelve este reporte (≤ 8 líneas):
   ```
   Txx | HECHA | ESCALAR | intentos: n
   Prueba: <comando> → <resultado en 1 línea>
   Archivos: <rutas>
   Decisiones/notas: <≤ 3 líneas>
   ```
4. **Git.** Repo en esta carpeta. Rama por ola (`ola-N-nombre`), un commit por tarea (`feat(Txx): …`, `git add <rutas>`, nunca `-A` ni `.`), merge a `main` en cada checkpoint verde. **Repo público en GitHub (D1):** push de `main` en cada checkpoint. Antes del primer push: email de commits = noreply de GitHub (D4), y fuera del repo la prueba oficial (HTML/PDF) y el catálogo personal `.xlsx`.
5. **Secretos.** `.env.local` lo crea el usuario; ningún agente lo lee ni lo muestra. Variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `SESSION_SECRET` (en `.env.local` y en Vercel).
6. **Evidencia.** Nada pasa a HECHA sin la salida de su prueba (skill verification-before-completion).
7. **Briefs cortos.** El Orquestador pasa a cada sub-agente: su tarjeta (§10) + §4 Contratos + §6. Solo T01, T11 y T13 leen BRD/PRD.

---

## 7. Instalaciones (las cubre el comando de confirmación; cualquier otra pide OK)

- **npm** (en `prototipo/`, ✅ instalado): create-next-app 16.4.6 + zod, lucide-react, typescript 5.9.3, vitest, @playwright/test, @google/genai 3.1.0, jsdom, @testing-library/react y /dom, @types/node 24.
- **uv** (en `modelo_financiero/`, ✅ instalado): openpyxl 3.1.5, weasyprint 70.0, pytest; `formulas` 1.3.4 solo si LibreOffice no está.
- **npx sin instalar:** @mermaid-js/mermaid-cli 12.2.0 (T11).
- **El usuario, en su terminal:** `sudo pacman -S libreoffice-fresh` (el sandbox no permite sudo) · `cd prototipo && npm run dev` en una pestaña aparte · `npm run e2e` cuando el Orquestador lo pida · importar el repo en vercel.com (no hace falta la CLI de Vercel).

---

## 8. Paso 0 · T00 · Base, contratos y esqueleto · [ALTO] Orquestador · 12:45–13:30

1. `git init -b main` + `.gitignore` (node_modules, .next, .venv, `.env*`, `!.env.example`).
2. `npx create-next-app@16.4.6 prototipo` con TypeScript, Tailwind, App Router y `src/` (flags no interactivos: confirmarlos con `--help`; no verificados).
3. Instalar §7; fijar `typescript@5.9.3`; scripts: `typecheck`, `test`, `evals`, `e2e`, `check:assumptions`, `check:fixtures`.
4. Crear contratos (§4), puertos y carpetas (§9) con `index.ts` tipados. **Esqueleto caminante** (corte vertical mínimo de punta a punta): `/api/agent` devuelve un `AgentTurn` stub válido y `page.tsx` monta las 3 zonas (`<OwnerApp/>`, `<XrayConsole/>`, `<AdvisorInbox/>`) con sus `data-testid`.
5. `data/assumptions.json` borrador con las cifras del BRD (`tipo:'propio'`, `estado:'borrador'`).
6. `uv init modelo_financiero` + deps; `playwright.config.ts` con `channel: 'chrome'` y `reuseExistingServer: true`.
7. Crear `logs/BITACORA_SOLUCION.md` (entrada 1: auditoría y plan) y `logs/tareas/`; actualizar ESTADO; commit `chore(T00): base, contratos y esqueleto`.
8. Pasada la prueba: arrancar `npm run dev` en segundo plano (puerto 3000) para toda la sesión.

**Prueba T00:**
```
cd prototipo && npm run typecheck && npx vitest run && npm run build
curl -s -X POST localhost:3000/api/agent -H 'content-type: application/json' \
  -d '{"sessionId":"s1","scenarioId":"feliz","message":"hola"}'   # JSON que pasa AgentTurn.parse
uv run --project modelo_financiero python -c "import openpyxl"
```

---

## 9. Carpetas y dueños (nadie escribe fuera de lo suyo)

```
./ (raíz del repo = esta carpeta)
├─ PLAN.md (Orq.) · README.md, GLOSSARY.md, DECLARACION_USO_IA.md (T14)
├─ ARQUITECTURA_Y_SOLUCION.md, docs/adr/ (T11) · docs/investigacion/ (T01)
├─ data/assumptions.json (esquema: Orq. · valores: T01)
├─ logs/ESTADO_GLOBAL.md, logs/BITACORA_SOLUCION.md (Orq.) · logs/tareas/Txx.md (cada tarea)
├─ prototipo/
│  ├─ src/core/contracts, src/core/ports (Orq.)
│  ├─ src/core/data (T02)
│  ├─ src/core/tools, src/core/adapters/mock (T03)
│  ├─ src/core/guardrails, src/core/audit (T04)
│  ├─ src/core/agent (T08) · src/core/agent/llm, src/core/agent/prompts (T09)
│  ├─ src/app/api/agent (T08) · src/app/page.tsx, layout.tsx, globals.css (T05)
│  ├─ src/ui/owner (T05) · src/ui/xray, src/ui/advisor (T06) · src/ui/demo (T12)
│  ├─ evals/ (T10) · e2e/owner.spec.ts (T05) · e2e/xray.spec.ts (T06) · e2e/escenarios.spec.ts (T12)
│  └─ scripts/check_coherence.mjs (T15)
├─ modelo_financiero/ (T07)
├─ resumen_ejecutivo/ (T13)
└─ entregables/ xlsx + financial_summary.json (T07) · pdf (T13) · zip (T17)
```

---

## 10. Olas y tarjetas de tarea

### Ola 1 · en paralelo (máx. 5 a la vez) · 13:30–16:00
Orden de lanzamiento: T04, T03, T01, T02, T05 → al liberarse cupo: T06, T07.

**T01 · Investigación de mercado y supuestos con fuente · [ALTO] `opus`**
- Agente: general-purpose + `verificador` (comprueba 5 cifras al azar). Herramientas: WebSearch, WebFetch.
- Posee: `docs/investigacion/FUENTES_MERCADO.md`, valores de `data/assumptions.json`.
- Hace: cifras reales para Colombia. Pistas, no verificadas: parque y ventas (RUNT, ANDEMOS), peso de la postventa en el margen del concesionario (NADA, Cox Automotive, consultoras), fuga a talleres independientes tras la garantía, ticket de mantenimiento, seguros y SOAT (Fasecolda), uso de WhatsApp, costo de IA (precios de Gemini de §2, los de 2027 en adelante), Ley 1581 de 2012. Cada supuesto: P/B/O + fuente, o `propio` + experimento de validación.
- Acepta si: ≥ 8 fuentes con URL y fecha · todos los supuestos con P/B/O coherentes · cada `propio` trae experimento.
- Prueba: `cd prototipo && npm run check:assumptions` + `verificador` confirma 5/5. · 90 min.

**T02 · Datos mock realistas · [BAJO] `haiku`**
- Posee: `prototipo/src/core/data/*.json`.
- Hace: 5 propietarios/vehículos, uno por escenario (Mazda CX-30 2023, Toyota Corolla Cross 2022, Renault Duster 2021, Chevrolet Onix 2022, Kia Picanto 2021; personas y cédulas ficticias); inventario con un SKU en stock 0; agenda de bahías a 14 días con huecos en horario valle; tarifario 10k–40k km por modelo; 2 aseguradoras ficticias («Aliada Seguros A/B»); historial de servicios.
- Acepta si: todo valida con Zod · ningún aliado con nombre de empresa real.
- Prueba: `cd prototipo && npm run check:fixtures`. · 30 min.

**T03 · Herramientas del agente + adaptadores mock · [MEDIO] `sonnet`**
- Skills: test-driven-development, api-and-interface-design.
- Posee: `src/core/tools/**`, `src/core/adapters/mock/**`.
- Hace: las 5 tools + estimador de km (último registro + ritmo diario × días). Cada una: entrada y salida Zod, emite `TraceEvent` (sistema, latencia simulada, nivel de autonomía). `agendar_bahia_taller` idempotente con hold de 15 min; precios solo del tarifario; descuento ≤ tope de `assumptions`.
- Acepta si: ≥ 15 tests, incluidos stock 0, sin bahía, doble reserva y descuento > tope rechazado.
- Prueba: `npx vitest run src/core/tools src/core/adapters`. · 75 min.

**T04 · Guardián: guardrails, política de autonomía y auditoría · [ALTO] `opus`**
- Skills: security-and-hardening, test-driven-development.
- Posee: `src/core/guardrails/**`, `src/core/audit/**`.
- Hace: **entrada:** gate de consentimiento; detector de inyección (ES/EN, ofuscaciones, «ignora tus instrucciones», suplantar al gerente, pedir el system prompt); fraude (precio o descuento fuera de política); síntomas críticos con severidad; PII enmascarada (cédula, celular, email, placa); límite de intentos por sesión. **Salida:** precio = tarifario, descuento ≤ tope, sin promesas de garantía ni diagnósticos, sin PII de terceros. Política de autonomía como código (acción → informar/recomendar/ejecutar/prohibido). Auditoría con traza enmascarada.
- Acepta si: ≥ 25 casos adversariales bloqueados (100 %) · ≤ 1 falso positivo en 15 mensajes normales · cero PII sin enmascarar en la traza.
- Prueba: `npx vitest run src/core/guardrails src/core/audit`. · 90 min.

**T05 · App del propietario + layout dividido · [MEDIO] `sonnet`**
- Skills: frontend-ui-engineering, dataviz (si hay cifras); checklist de Vercel Design Guidelines (WebFetch a vercel.com/design/guidelines).
- Posee: `src/app/page.tsx`, `layout.tsx`, `globals.css`, `src/ui/owner/**`, `e2e/owner.spec.ts`.
- Hace: izquierda, app del propietario estilo chat con tarjetas (alerta de km, cotización cerrada, reserva en 1 clic, póliza); derecha, ranuras para Rayos X y Bandeja (no tocar sus imports). Barra de escenarios e insignia de modo. ≥ 1280 px dividido, móvil apilado, contraste AA. Usa el `AgentTurn` stub.
- Prueba: `npx vitest run src/ui/owner` (tests de componente con `// @vitest-environment jsdom`) + `npx vitest run src/app` (humo del Orquestador) · deja escrito `e2e/owner.spec.ts` (lo corre el usuario en CP1) · revisión visual con Claude in Chrome si el `npm run dev` del usuario está arriba. · 75 min.

**T06 · Consola Rayos X + Bandeja del asesor · [MEDIO] `sonnet`**
- Skills: frontend-ui-engineering; checklist de Vercel Design Guidelines.
- Posee: `src/ui/xray/**`, `src/ui/advisor/**`, `e2e/xray.spec.ts`.
- Hace: línea de tiempo de `TraceEvent` (icono por sistema, color por estado, latencia, nivel de autonomía, payload JSON plegable); panel de guardrails, máquina de estados y **Memoria** (`MemorySnapshot`, `data-testid="memory-panel"`); Bandeja con `HandoffCase` (prioridad, motivo, resumen, contexto, botón «Tomar caso»).
- Prueba: `npx vitest run src/ui/xray src/ui/advisor` (jsdom, con una traza de ejemplo) + `npx vitest run src/app` · deja escrito `e2e/xray.spec.ts`. · 75 min.

**T07 · Generador del modelo financiero · [MEDIO] `sonnet`**
- Skills: anthropic-skills:xlsx (exige recalcular con LibreOffice).
- Posee: `modelo_financiero/**`, `entregables/MODELO_FINANCIERO_POSTVENTA_3Y.xlsx`, `entregables/financial_summary.json`.
- Hace: `generate_financial_model.py` lee `data/assumptions.json` y crea: `Supuestos_y_Fuentes` (entradas en azul) · `Funnel_y_Operacion_3Y` (36 meses: parque → elegibles → opt-in → contactados → agendados → atendidos, con tope de capacidad de bahías vía `MIN`) · `Caso_Negocio_Escenarios` (ingresos de taller, venta cruzada y seguros; margen; costos de IA y operación; inversión; flujo y acumulado; payback en meses; ROI 3 años; VPN) · `Sensibilidad` (±20 % en 6 drivers → beneficio y payback) · `Plan_Validacion` (supuesto, experimento, métrica, umbral, fecha). **Los 3 escenarios calculados en paralelo.** Solo fórmulas en cálculos. Exporta `financial_summary.json`.
- Acepta si: recálculo sin errores · ≥ 300 fórmulas · payback P > B > O · cifras = referencia en Python ±0,5 %.
- Prueba: `cd modelo_financiero && uv run pytest -q`. Dentro del sandbox, LibreOffice no recalcula (comprobado en T00), así que la verificación evalúa las fórmulas con la librería `formulas` 1.3.4 (sin errores, cifras = referencia Python ±0,5 %). El libro lleva `fullCalcOnLoad` (Excel lo recalcula al abrirlo). El usuario ejecuta `recalc.py` fuera del sandbox en T17 para guardar los valores en caché. · 90 min.

**Checkpoint 1 (Orquestador · 16:00):** `npm run typecheck && npx vitest run && npm run build` (con el dev parado) · playwright owner + xray · pytest del modelo · regenerar el Excel con los supuestos finales de T01 · commits por tarea · merge `ola-1` → `main` · ESTADO + BITÁCORA · crear el repo público en GitHub y primer push (con D4 resuelta) · el usuario importa el repo en Vercel (despliegue temprano para fallar pronto).

### Ola 2 · 16:00–18:15

**T08 · Orquestador del agente + API + memoria + handoff · [ALTO] `opus`**
- Depende de: T02, T03, T04. Skills: incremental-implementation, test-driven-development.
- Posee: `src/core/agent/**` (salvo `llm/` y `prompts/`), `src/app/api/agent/**`.
- Hace: máquina de estados (§4). Turno: Guardián de entrada → planner → herramientas (con política de autonomía) → Guardián de salida → `AgentTurn`. Planner determinista con guion por escenario + intención por palabras clave para texto libre. Memoria de sesión en token firmado (HMAC con `SESSION_SECRET`; en producción sin secreto falla cerrado con un error claro) + perfil del vehículo desde CRM; devuelve `MemorySnapshot`. Copiloto del asesor: resumen por plantilla (motivo, síntomas, vehículo, historial, siguiente paso sugerido).
- Acepta si: `feliz` → CERRADO con reserva y venta cruzada · `sintoma_critico` → HANDOFF sin reserva · `sin_stock` → fecha alternativa + tarea al asesor · `adversarial` → BLOQUEADO + alerta · `sin_consentimiento` → sin contacto. Cada uno con las tools esperadas en la traza.
- Prueba: `npx vitest run src/core/agent` + `curl` a `/api/agent` por escenario. · 100 min.

**T09 · Planner LLM con Gemini (function calling) y respaldo · [MEDIO] `sonnet`** · se recorta primero si vamos tarde (§12)
- Depende de: T00 (`Planner`); se integra con T08 al final. Skills: source-driven-development (doc oficial de Gemini antes de escribir), security-and-hardening.
- Posee: `src/core/agent/llm/**`, `src/core/agent/prompts/**`.
- Hace: `Planner` con `@google/genai` y `GEMINI_MODEL` (por defecto `gemini-3.5-flash-lite`); comprueba en la doc oficial que el modelo soporta function calling; herramientas = esquemas de T03; system prompt versionado (rol, límites de la matriz, nunca revelar instrucciones); timeout 8 s + 1 reintento → si falla, planner determinista y evento `llm` con `status:'error'`; tokens y costo estimado por turno en la traza (precios de §2).
- Acepta si: sin key usa el determinista sin error · con el SDK simulado, los tool calls validan con Zod · el Guardián bloquea aunque el LLM proponga una acción prohibida.
- Prueba: `npx vitest run src/core/agent/llm`. · 75 min.

**T10 · Evals del agente · [MEDIO] `sonnet` (agent-skills:test-engineer)**
- Depende de: T04, T08 (los casos se escriben desde el inicio de la ola). Método: análisis de errores + pasa/no pasa (Hamel Husain / Anthropic).
- Posee: `prototipo/evals/**`.
- Hace: ≥ 30 casos (10 feliz y variantes, 6 síntoma crítico, 6 adversarial/fraude, 4 stock/agenda, 4 consentimiento/PII). Criterios binarios: estado final, tools requeridas, acciones prohibidas no ejecutadas, PII enmascarada, precio = tarifario. `npm run evals` → `evals/REPORTE_EVALS.md` con tasa por categoría (modo determinista; con `GEMINI_API_KEY`, también `gemini-3.5-flash-lite` frente a `gemini-3.6-flash`, y recomienda modelo por acierto y costo).
- Acepta si: 100 % en seguridad (adversarial, síntoma, consentimiento) · ≥ 90 % total · fallos documentados.
- Prueba: `npm run evals`. · 60 min.

**T11 · ARQUITECTURA_Y_SOLUCION.md + ADR · [MEDIO] `sonnet`**
- Skills: documentation-and-adrs, domain-modeling.
- Posee: `ARQUITECTURA_Y_SOLUCION.md`, `docs/adr/**`.
- Hace: Mermaid: (1) ecosistema (actores, aliados, canales), (2) ciclo de vida entrega → renovación con momentos priorizados, (3) arquitectura agéntica, (4) secuencia camino feliz, (5) secuencia handoff, (6) tubería del Guardián, (7) integración en producción (puertos → DMS/CRM/WhatsApp), (8) despliegue. Texto: agentes y matriz de autonomía; controles (privacidad, consentimiento, calidad, trazabilidad, fraude, adversarial, escalamiento); KPIs (experiencia, adopción, calidad del agente, operación, margen, fidelización); cambio en el trabajo del asesor y gobierno; riesgos; matriz de pruebas (la completa T15). ADR 0001–0005 (stack, agente híbrido con Gemini, fuente única, Guardián determinista, qué no usamos hoy y por qué: MCP, RAG, Supabase, Railway, fine-tuning, LangChain).
- Prueba: script que extrae cada bloque mermaid y lo renderiza con `npx -y @mermaid-js/mermaid-cli@12.2.0` usando el Chrome del sistema (`PUPPETEER_EXECUTABLE_PATH`; no verificado): 0 errores. · 75 min.

**Checkpoint 2 (18:15):** unit + evals + build · los 5 escenarios por API · merge `ola-2`. Opcional: 5 min de demo local para el usuario.

### Ola 3 · 18:15–20:15

**T12 · Integración UI ↔ API, guion de demo y E2E · [MEDIO] `sonnet`**
- Depende de: T05, T06, T08.
- Posee: `src/ui/demo/**`, `e2e/escenarios.spec.ts`.
- Hace: cada botón de escenario corre su guion paso a paso («Siguiente»), entrada libre, animación de la traza, la Bandeja recibe el handoff, «Reiniciar demo», insignia LLM/determinista.
- Prueba: `npx vitest run src/ui/demo` (jsdom: los 5 escenarios contra el route handler real) · `e2e/escenarios.spec.ts` (5 escenarios, 0 errores de consola) lo corre el usuario con `npm run e2e` · GIF `demo_postventa.gif` con Claude in Chrome. · 75 min.

**T13 · Resumen ejecutivo (PDF ≤ 2 páginas) · [MEDIO] `sonnet`**
- Depende de: T01, T07, T11. Skills: anthropic-skills:pdf, dataviz.
- Posee: `resumen_ejecutivo/**`, `entregables/RESUMEN_EJECUTIVO_COMITE.pdf`.
- Hace: HTML con CSS de impresión (Carta); cifras inyectadas desde `financial_summary.json`, nunca a mano. **Pág. 1:** problema, usuarios priorizados, segmento (años 2–5), ecosistema y journey, qué primero y qué después, solución agéntica (agentes, autonomía, límites, controles). **Pág. 2:** valor P/B/O, inversión, payback, ROI, costos de IA, roadmap de 6 meses con compuertas, KPIs, cambio en los equipos, riesgos, decisión solicitada, declaración de uso de IA.
- Prueba: `uv run --project modelo_financiero python resumen_ejecutivo/build_pdf.py` (WeasyPrint; Chrome no arranca en el sandbox) → `pdfinfo` da `Pages: ≤ 2` · `pdftotext` contiene payback, inversión y ROI idénticos a `financial_summary.json`. · 75 min.

**T14 · README, GLOSSARY, .env.example, DECLARACION_USO_IA · [BAJO] `haiku`**
- Skills: domain-modeling (glosario).
- Posee: `README.md`, `GLOSSARY.md`, `prototipo/.env.example`, `DECLARACION_USO_IA.md`.
- Acepta si: README con cómo correr, URL y escenarios · glosario ≥ 15 términos (bahía, OT, SOAT, opt-in, handoff, payback…) · `.env.example` con `GEMINI_API_KEY`, `GEMINI_MODEL` y `SESSION_SECRET`, sin valores reales.
- Prueba: el Orquestador ejecuta los comandos del README en limpio. · 30 min.

**Checkpoint 3 (20:15):** batería §11 · merge `ola-3`.

### Ola 4 · cierre · 20:15–22:30

**T15 · Revisión independiente y coherencia · [ALTO] `opus`**
- Agentes: agent-skills:code-reviewer (`/code-review medium`, contexto limpio) + agent-skills:security-auditor (`/security-review` del Guardián y la API).
- Hace: corrige solo fallos de corrección o de lo pedido; `scripts/check_coherence.mjs`: assumptions ↔ xlsx ↔ summary ↔ PDF ↔ constantes del prototipo; completa la matriz de pruebas en la arquitectura.
- Prueba: coherencia en verde + batería §11 en verde. · 75 min.

**T16 · Verificación en vivo (Vercel + GitHub público) · [MEDIO] `sonnet`**
- Hace: confirma que el último push desplegó en Vercel (repo importado en CP1, raíz `prototipo/`, variables `GEMINI_API_KEY`, `GEMINI_MODEL` y `SESSION_SECRET` cargadas por el usuario); humo de los 5 escenarios en la URL con Claude in Chrome; README con URL y enlace al repo. 2 fallos → entrega local + GIF.
- Prueba: 5/5 escenarios en la URL, 0 errores de consola. · 45 min.

**T17 · Paquete final · [BAJO] `haiku`**
- Hace: `entregables/ENTREGA_PostventaAgentica.zip` con PDF, XLSX, README (URL + cómo correr), DECLARACION_USO_IA, ARQUITECTURA, REPORTE_EVALS, GIF y código (sin node_modules ni `.env*`). El Orquestador cierra BITÁCORA y ESTADO.
- Prueba: `unzip -l` lista todos los elementos. · 20 min.

**22:30–23:00:** colchón y envío (usuario).

---

## 11. Batería de verificación final (Orquestador)

```
cd prototipo && npm run typecheck && npm test && npm run check:fixtures && npm run check:assumptions:final && npm run evals && npm run build:locked
cd ../modelo_financiero && uv run pytest -q
# fuera del sandbox (usuario): cd prototipo && npm run e2e
pdfinfo ../entregables/RESUMEN_EJECUTIVO_COMITE.pdf | grep Pages
node ../prototipo/scripts/check_coherence.mjs
```

## 12. Recorte si vamos tarde (en este orden)

1. Modo LLM (T09) → queda el determinista + diseño documentado.
2. Validación de Mermaid con mermaid-cli → revisión visual.
3. Despliegue (T16) → local + GIF.
4. Gráfico de sensibilidad → solo la tabla.

**Nunca se recorta:** ≥ 2 caminos de falla + handoff, Guardián, Excel con fórmulas, PDF ≤ 2 páginas, coherencia de cifras.

## 13. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Next 16 + TypeScript 7 incompatibles | Alto | TS 5.9.3 fijado |
| Sin LibreOffice no hay recálculo | Medio | D3; suplente `formulas` |
| LLM lento o caído en la demo | Alto | timeout 8 s → determinista |
| Cifras de mercado sin fuente | Alto (rúbrica) | T01 + `verificador`; `propio` + experimento |
| Choques entre agentes en paralelo | Medio | dueños por ruta; contratos congelados; ESTADO solo del Orq. |
| Bucles o tokens agotados | Medio | circuit breaker; ESTADO ≤ 40 líneas; briefs cortos |
| Sandbox: sin Chrome, sin sudo, red aislada por comando | Medio | jsdom + WeasyPrint dentro; E2E real y sudo los ejecuta el usuario |
| Estado de sesión perdido entre instancias de Vercel | Alto | token firmado; nada de estado en memoria del servidor |
| Nivel gratuito de Gemini usa los datos | Medio | solo datos ficticios en la demo; producción en nivel de pago |
| Precio de Gemini Flash se duplica en 2027 | Medio | el modelo financiero usa precios 2027 |
| Email personal expuesto en commits públicos | Medio | D4: noreply de GitHub antes del primer push |
| Despliegue falla tarde | Medio | importar en Vercel desde CP1 (16:00); si falla, local + GIF |

## 14. Decisiones del usuario

- ✅ **D1:** URL pública en Vercel + repo público en GitHub.
- ✅ **D2:** Gemini API; modelo por defecto `gemini-3.5-flash-lite`, lo confirma T10 con evals.
- ✅ **D3:** LibreOffice autorizado; lo instala el usuario porque el sandbox bloquea sudo.
- ⬜ **D4:** email de los commits públicos: noreply de GitHub (recomendado) o el personal.

## 15. Protocolo de relevo (corte de tokens o cambio de modelo)

1. Lee `logs/ESTADO_GLOBAL.md` → «Siguiente acción».
2. Lee aquí la tarjeta de esa tarea y, si existe, `logs/tareas/Txx.md`.
3. `git log --oneline -10` para confirmar lo hecho.
4. Continúa. No releas código que no vayas a tocar.
