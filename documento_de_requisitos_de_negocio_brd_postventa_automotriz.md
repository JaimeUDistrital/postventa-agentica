# BRD: Ecosistema Agéntico de Postventa Automotriz

> **Contexto para el Asistente de IA:** Este documento define el **QUÉ** y el **PORQUÉ** del negocio para resolver la prueba técnica de *AI Product Engineer (Periferia IT)* antes de las $11:00\text{ PM}$. Úsalo como brújula estratégica: respeta las reglas innegociables del cliente, pero propón soluciones creativas y de nivel Senior en la implementación.

## 1. El Problema en 30 Segundos (Modo TDAH)

* **El Cliente:** Una agencia multimarca que vende autos nuevos y usados.

* **La Sangría de Dinero:** El día que entregan las llaves del auto, pierden al cliente. Los mantenimientos, reparaciones, seguros y la recompra se van a talleres de barrio o aseguradoras externas.

* **Por qué pasa esto hoy:**

  1. **Postventa** $100\%$ **reactiva:** La agencia solo espera sentada a que el auto falle y el cliente llame.

  2. **Spam ciego:** Mandan correos genéricos sin saber cuántos kilómetros tiene el auto ni en qué momento de vida está el dueño.

  3. **Fricción operativa:** Agendar en taller oficial se percibe como lento, caro y burocrático.

* **El Principio Rector:** **NO queremos un bot que envíe más spam.** Queremos un sistema agéntico que actúe en el momento exacto del vehículo, resuelva el problema conectado a los sistemas del taller y pase el caso a un humano cuando haya riesgo o complejidad.

## 2. Los 3 Dolores que Debemos Resolver (Quién sufre y por qué)

| Actor | Su Dolor Actual | Lo que Necesita de Nuestro Producto | 
| ----- | ----- | ----- | 
| **1. Comité Directivo (El que paga)** | Las bahías del taller están vacías entre semana y pierden el margen más alto del negocio (mantenimiento, seguros y retoma). | Llenar la capacidad instalada del taller y retener clientes a $3\text{ años}$ sin contratar un ejército de agentes de call center. | 
| **2. Dueño del Vehículo (Usuario Final)** | Odia que lo engañen en talleres callejeros, pero le da pereza llamar a la agencia porque no le dan precios claros ni citas rápidas. | Que la agencia le avise **solo cuando su auto lo necesita**, con precio transparente, repuesto asegurado y reserva en $1\text{ clic}$. | 
| **3. Asesor de Servicio (Operador Humano)** | Pierde horas respondiendo preguntas repetitivas por WhatsApp o atendiendo clientes furiosos porque no había el repuesto. | Recibir citas ya confirmadas y validadas, e intervenir **únicamente** en casos complejos, garantías o clientes enojados. | 

## 3. Foco Quirúrgico del Producto (Dónde entramos a ganar)

Un error Junior es intentar resolver toda la postventa al mismo tiempo. Como entrega **Senior**, atacaremos primero el punto de mayor fuga y mayor retorno financiero:

* **Segmento de Entrada (MVP - Fase 1):** Propietarios de vehículos **seminuevos o recién salidos de garantía inicial (Años** $2\text{ a }5$ **/** $20.000\text{ a }60.000\text{ km}$**)**. Es el momento exacto donde el cliente abandona la agencia por precio o desconfianza.

* **Momento de Vida Prioritario (El Journey Clave):**

  1. **Mantenimiento Preventivo Predictivo:** Alerta proactiva por kilometraje estimado (cada $5.000\text{ / }10.000\text{ km}$) con cotización cerrada, validación de stock de repuestos y reserva de bahía en el taller.

  2. **Venta Cruzada Natural:** Renovación de póliza/SOAT o paquete de desgaste (frenos/llantas) integrado en la misma visita.

* **Expansión Futura (Fases 2 y 3):** Telemetría/OBD2 en vivo, accesorios personalizados y programa de retoma (Trade-In) cuando el auto cumple $4\text{ a }5\text{ años}$.

## 4. Objetivos del Negocio (Qué debe demostrar nuestra entrega)

Todo lo que construyamos hoy (Prototipo, Modelo Financiero y Resumen Ejecutivo) debe apuntar a estos $4$ objetivos:

1. **Pasar de Reactivo a Predictivo:** Contactar al cliente con consentimiento previo usando datos reales de su vehículo (modelo, fecha de entrega, kilometraje estimado e historial).

2. **Conectar la IA a la Operación Real:** Demostrar que el agente no "charla", sino que consulta sistemas (CRM, Inventario de Repuestos, Agenda de Bahías del Taller y Motor de Precios).

3. **Garantizar Control y Escalado Humano (Human-in-the-Loop):** Demostrar que el agente conoce sus límites. Si hay una falla mecánica grave, disputa de garantía, falta de stock o intento de manipulación (prompt injection/fraude), el agente frena y transfiere a un asesor humano con todo el contexto.

4. **Demostrar Rentabilidad a** $3\text{ Años}$**:** Probar financieramente que el aumento en retención de taller, ticket promedio y recompra paga la inversión y los costos de IA en pocos meses (Payback claro en escenarios Pesimista, Base y Optimista).

## 5. Reglas de Juego para el Asistente de IA (Innegociables vs. Libertad)

### Lo que es INNEGOCIABLE (Exigido por la rúbrica de evaluación)

* **Prototipo Funcional Navegable:** Debe mostrar el *journey* clave, hacer **visible qué hace el agente por dentro** (qué herramientas/datos consulta en tiempo real), incluir **al menos** $2\text{ caminos de falla o excepción}$ y mostrar la **transferencia a un humano**.

* **Coherencia Total en los** $3\text{ Entregables}$**:** Los números, el segmento y la arquitectura del Prototipo deben coincidir exactamente con el **Resumen Ejecutivo (PDF máx.** $2\text{ páginas}$**)** y el **Modelo Financiero (Excel a** $3\text{ años}$**)**.

* **Guardrails Explícitos:** Consentimiento de contacto, privacidad de datos, límites de autonomía (qué puede ejecutar solo y qué tiene prohibido decidir) y defensa ante mensajes adversariales.

### Donde tienes LIBERTAD CREATIVA como IA Senior

* **Diseño de la Experiencia (UI/UX):** Libertad total para diseñar una interfaz moderna y clara (por ejemplo, una vista dividida con la experiencia del cliente a un lado y la "consola de rayos X" del agente y del asesor humano al otro).

* **Arquitectura de Agentes y Herramientas:** Libertad para estructurar el orquestador, sub-agentes o herramientas deterministas que hagan brillar el prototipo sin sobrecomplicar el tiempo de entrega.

## 6. Ajustes del Arquitecto (v1.1 · 2026-11-11)

> Añadidos tras auditar este BRD contra la rúbrica oficial. No cambian los innegociables: los precisan. Detalle ejecutable en `PLAN.md`.

1. **Las cifras son hipótesis, no datos.** Parque de 5.000 vehículos, retención 18 % → 38 %, ticket USD 220, margen 48 %, conversión de seguros 15 % y USD 0,015 por conversación no tienen fuente. La tarea T01 las reemplaza por rangos pesimista/base/optimista con fuente real, o las marca como «supuesto propio» con su experimento de validación.
2. **Mercado declarado:** Colombia (el SOAT lo implica). El modelo financiero va en USD con una celda de TRM para leerlo en COP.
3. **Usuarios priorizados** (la rúbrica pide definirlos y priorizarlos): 1) propietario del segmento años 2–5; 2) asesor de servicio; 3) jefe de taller (capacidad de bahías); 4) comité directivo (decide y paga).
4. **Ecosistema completo, no solo el MVP:** el resumen y la arquitectura muestran el ciclo de vida entero (entrega → garantía años 0–2 → MVP años 2–5 → retoma y renovación), los aliados (aseguradoras, llantas y baterías, financiera) y los canales (WhatsApp Business, web/app, asesor), con qué va primero y qué después.
5. **Controles que faltaban:** fraude (verificación de identidad antes de ejecutar, tope de descuento, reservas idempotentes, límite de intentos), privacidad (Ley 1581 de 2012 de protección de datos personales; no verificado, lo comprueba T01), calidad (evals pasa/no pasa) y trazabilidad (traza con id por turno).