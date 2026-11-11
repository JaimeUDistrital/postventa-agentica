# Postventa Agéntica

Agente de IA para el postventa de una agencia automotriz ficticia en Colombia (prueba técnica de AI Product Engineer, Periferia IT). Contacta de forma proactiva al cliente por WhatsApp cuando le toca el mantenimiento, cotiza con precios recalculados desde tarifario e inventario, agenda la cita y propone venta cruzada. Un Guardián determinista (reglas, no LLM) bloquea manipulación, exige consentimiento y escala síntomas críticos a un asesor humano. Incluye además el caso de negocio: modelo financiero a 3 años y resumen ejecutivo para el comité.

## Enlaces

- Demo: https://postventa-agentica.vercel.app
- Repo: https://github.com/JaimeUDistrital/postventa-agentica
- Resumen ejecutivo (PDF): [entregables/RESUMEN_EJECUTIVO_COMITE.pdf](entregables/RESUMEN_EJECUTIVO_COMITE.pdf)
- Modelo financiero (Excel): [entregables/MODELO_FINANCIERO_POSTVENTA_3Y.xlsx](entregables/MODELO_FINANCIERO_POSTVENTA_3Y.xlsx)
- Arquitectura y solución: [ARQUITECTURA_Y_SOLUCION.md](ARQUITECTURA_Y_SOLUCION.md)
- Decisiones (ADR): [docs/adr/README.md](docs/adr/README.md)
- Evals: [prototipo/evals/REPORTE_EVALS.md](prototipo/evals/REPORTE_EVALS.md)
- Bitácora: [logs/BITACORA_SOLUCION.md](logs/BITACORA_SOLUCION.md)
- Glosario: [GLOSSARY.md](GLOSSARY.md) · Uso de IA: [DECLARACION_USO_IA.md](DECLARACION_USO_IA.md)

## Cómo usar la demo

La interfaz es una **Consola del asesor**.

1. En **Clientes de hoy** hay 5 clientes, uno por escenario: mantenimiento de 30.000 km, síntoma crítico, repuesto sin stock, intento de manipulación y sin consentimiento.
2. Elige uno: se abre la conversación de WhatsApp.
3. En **Demo guiada** (por defecto), pulsa **Siguiente mensaje del cliente** para avanzar el guion paso a paso; en **Modo libre** escribe como cliente o usa los botones de las tarjetas, como en producción.
4. Mira **Qué hizo el agente** (acciones y decisiones) y **Necesita su acción** (lo que debe resolver el asesor humano).
5. **Ver detalle técnico** abre la traza (herramientas, Guardián, memoria).

Modo Gemini: por defecto la demo corre en modo determinista. Para activar Gemini, abre el enlace con `?codigo=...` que se envía al jurado por correo (el código nunca está en el repo). Sin código válido, la demo sigue funcionando en modo determinista.

## Correr en local

```bash
cd prototipo
npm ci
npm run dev
```

Pruebas (desde `prototipo/`):

```bash
npm test                        # tests unitarios (vitest)
npm run evals                   # evals del agente (genera el reporte)
npm run check:fixtures          # coherencia de datos mock
npm run check:assumptions:final # supuestos con fuente (modo estricto)
npm run e2e                     # Playwright (navegador real)
```

Modelo financiero y PDF (desde la raíz):

```bash
cd modelo_financiero && uv run python generate_financial_model.py && uv run pytest -q
uv run --project modelo_financiero python resumen_ejecutivo/build_pdf.py
```

## Variables de entorno

Plantilla en [prototipo/.env.example](prototipo/.env.example). Sin valores reales en el repo.

| Variable | Para qué sirve | Si falta |
|---|---|---|
| `GEMINI_API_KEY` | Clave de Gemini (proyecto sin facturación) | Modo determinista |
| `GEMINI_MODEL` | Modelo de Gemini | Se usa el modelo por defecto del código |
| `SESSION_SECRET` | Firma HMAC del token de sesión | En desarrollo usa un secreto fijo; en producción `/api/agent` responde 500 |
| `DEMO_ACCESS_CODE` | Código del jurado (≥ 12 caracteres) que habilita Gemini | Gemini desactivado; modo determinista |

Gemini solo se usa si hay `GEMINI_API_KEY`, `DEMO_ACCESS_CODE` válido y la petición trae el código correcto ([ADR 0006](docs/adr/0006-proteccion-demo-publica.md)).

## Estructura

```
README.md · GLOSSARY.md · DECLARACION_USO_IA.md · ARQUITECTURA_Y_SOLUCION.md · PLAN.md
prototipo/            app Next.js (src/core: agente, Guardián, herramientas, adaptadores; src/ui; evals; e2e; checks)
modelo_financiero/    generador del Excel y tests (Python, uv)
resumen_ejecutivo/    HTML, meta y generador del PDF
entregables/          PDF, Excel y financial_summary.json (cifras del caso de negocio)
data/                 assumptions.json (supuestos con fuente)
docs/                 adr/, arquitectura/, investigacion/
logs/                 BITACORA_SOLUCION.md, ESTADO_GLOBAL.md, tareas/
```

## Calidad

Evals del agente en modo determinista (fuente: [REPORTE_EVALS.md](prototipo/evals/REPORTE_EVALS.md), 32 casos, 70 turnos, sin ejecuciones descartadas):

- Seguridad (adversarial + síntoma crítico + consentimiento/PII): 18/18 = 100 %.
- Total: 32/32 = 100 %.

Número de tests: ejecuta `npm test` (no se fija aquí para que no quede desactualizado). Cifras financieras: ver `entregables/financial_summary.json` y el PDF.

## Limitaciones

- Datos ficticios (clientes, vehículos, inventario, tarifario); el caso de negocio usa supuestos con fuente o declarados como tales.
- Integraciones (WhatsApp, CRM, agenda, inventario, aliados) simuladas con adaptadores mock.
- El modo LLM (Gemini) no se probó con red real dentro del sandbox; la corrida de evals con Gemini quedó no concluyente y debe ejecutarse fuera de él.
- Los E2E en navegador real los corre el usuario fuera del sandbox.
- El límite de peticiones por IP es best-effort (memoria del proceso, no distribuido).
