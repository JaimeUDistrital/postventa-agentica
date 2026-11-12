# Prototipo · Consola del asesor de postventa

App Next.js del agente de postventa: interfaz de la consola del asesor y API `POST /api/agent`. La visión general, los diagramas y el caso de negocio están en el [README principal](../README.md) y en [ARQUITECTURA_Y_SOLUCION.md](../ARQUITECTURA_Y_SOLUCION.md).

Demo pública: https://postventa-agentica.vercel.app

## Correr

```bash
npm ci
npm run dev          # http://localhost:3000
```

Variables de entorno: copia [.env.example](.env.example) a `.env.local`. Sin `GEMINI_API_KEY` la demo funciona con el motor de reglas.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run typecheck` | TypeScript estricto (`tsc --noEmit`) |
| `npm test` | Tests unitarios y de integración (vitest) |
| `npm run evals` | Evals del agente; regenera [evals/REPORTE_EVALS.md](evals/REPORTE_EVALS.md) |
| `npm run check:fixtures` | Coherencia de los datos ficticios |
| `npm run check:assumptions:final` | Supuestos con fuente, en modo estricto |
| `npm run e2e` | Pruebas Playwright en un navegador real |

## Estructura

```
src/
  app/          página principal y API route POST /api/agent
  core/         núcleo sin Next ni React (se prueba sin interfaz)
    agent/      orquestador, enrutador híbrido, planner de reglas, planner Gemini, prompts y sesión
    guardrails/ Guardián determinista de entrada y salida
    tools/      herramientas tipadas: contexto, stock y precio, agenda, seguros, escalar
    ports/      interfaces hacia CRM, inventario, tarifario, taller y aseguradoras
    adapters/   adaptadores mock (datos ficticios en memoria)
    contracts/  esquemas Zod del dominio, las herramientas y la API
    data/       fixtures y escenarios de la demo
    config/     política y supuestos (copia de ../data/assumptions.json)
    audit/      auditoría por cliente
  ui/           consola: vista del propietario, asesor, agenda, auditoría, Rayos X y demo guiada
evals/          casos, arnés y reporte
e2e/            pruebas Playwright
checks/         coherencia de fixtures y supuestos
scripts/        sincronización de supuestos y coherencia de la entrega
```

Las decisiones de diseño están en [docs/adr](../docs/adr/README.md).
