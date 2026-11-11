# ADR 0001 · Stack: Next.js 16 + TypeScript + Zod en Vercel

- **Estado:** Aceptada
- **Fecha:** 2026-11-11

## Contexto
Hay que entregar en un día un prototipo navegable con UI dual (propietario y Rayos X), una API que oculte la llave del modelo y un núcleo de agentes que se pueda probar sin interfaz. El jurado debe abrirlo con una URL.

## Decisión
Monolito modular en **Next.js 16 (App Router) + React + TypeScript + Zod**, desplegado en **Vercel**. El núcleo (`src/core`) no importa Next ni React y se prueba con Vitest. Los contratos están en Zod y de ahí salen los tipos. **Python solo para el Excel** (openpyxl) y el generador de PDF del modelo y el resumen; no forma parte de la app.

## Alternativas consideradas
- **FastAPI + React/Vite:** dos despliegues y dos lenguajes en la app; más fricción para el plazo.
- **Todo en Python (Streamlit u otro):** UI menos cuidada y peor encaje con el layout dividido y las pruebas de componentes.
- **Excel generado con TypeScript:** menos maduro para fórmulas reales que openpyxl.

## Consecuencias
- Un solo lenguaje y un solo despliegue para la app; la API key queda en el servidor.
- Validación de entradas y salidas con los mismos esquemas en toda la app.
- Dependencia de Vercel y de sus límites (ver ARQUITECTURA_Y_SOLUCION.md, sección 8).
- Hay dos ecosistemas (Node y Python) en el repo, pero separados por entregable.
