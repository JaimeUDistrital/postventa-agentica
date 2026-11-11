# Registro de decisiones de arquitectura (ADR)

Formato corto: Contexto, Decisión, Alternativas consideradas, Consecuencias y Estado.

| N.º | Decisión | Estado | Fecha |
|---|---|---|---|
| [0001](0001-stack.md) | Stack: Next.js 16 + TypeScript + Zod en Vercel; Python solo para Excel y PDF | Aceptada | 2026-11-11 |
| [0002](0002-agente-hibrido.md) | Agente híbrido: planner determinista + Gemini con function calling y respaldo | Aceptada | 2026-11-11 |
| [0003](0003-fuente-unica-supuestos.md) | Fuente única de supuestos (`data/assumptions.json`) | Aceptada | 2026-11-11 |
| [0004](0004-guardian-determinista.md) | Guardián determinista que el LLM no puede anular | Aceptada | 2026-11-11 |
| [0005](0005-lo-que-no-usamos-hoy.md) | Qué no usamos hoy y por qué (MCP, RAG, Supabase, Railway, fine-tuning, LangChain) | Aceptada | 2026-11-11 |
| [0006](0006-proteccion-demo-publica.md) | Protección de la demo pública (código del jurado, fallo cerrado, topes) | Aceptada · código reemplazado por 0007 (interruptor) | 2026-11-11 |
| [0007](0007-ia-para-todos-con-topes.md) | IA (Gemini) para todos los visitantes, con topes e interruptor de emergencia | Aceptada | 2026-11-11 |
| [0008](0008-pase-a-humano-bloqueante-o-no.md) | Pase a humano: qué casos bloquean la conversación y cuáles no (seguro, no resuelto) | Aceptada | 2026-11-11 |

Visión general: `../../ARQUITECTURA_Y_SOLUCION.md`.
