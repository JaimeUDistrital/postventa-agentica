# Fuentes de mercado y supuestos (T01)

> Versión 1.1 (revisión de costos, T01b) · 2026-11-11 · Mercado: Colombia · Moneda del modelo: USD (TRM base 3.300).
> Fuente única de los números: `data/assumptions.json`. Este documento explica de dónde sale cada uno y cuánto confiar en él.

## Resumen en 5 líneas

1. **34 supuestos**: 11 `mercado` (fuente + derivación declarada), 23 `propio` (uno de ellos, la plataforma, con fuente parcial) con su experimento de validación. Todos en `final`.
2. **29 fuentes** con URL y fecha de consulta (2026-11-11). algunas son de EE. UU. (Cox, NADA, Morningstar) o de proveedores (WhatsApp, hosting): se usan como referencia y se explica cómo se adaptan.
3. **Correcciones al BRD**: visitas al taller por año de 2,0 → **1,2** (un carro en Bogotá recorre ~9.000 km/año); ticket de mantenimiento de USD 220 → **170** base (220 pasa a optimista); conversión a seguros de 15 % → **10 %** base; tasa de descuento de 14 % → **17 %** (BanRep está en 12,25 %).
4. **Costo de IA** por conversación: P USD 0,036 (gemini-3.6-flash, precios 2027) · B USD 0,009 (flash-lite) · O USD 0,006 (flash-lite, 4 turnos). **WhatsApp** cuesta más que la IA en el caso base (USD 0,019).
5. Lo que más mueve el resultado y nadie ha medido: **retención actual, opt-in y respuesta al contacto**. Van primero en la validación con el cliente.

## Tabla de supuestos

Leyenda: P/B/O = pesimista / base / optimista. «Propio» = sin fuente pública; lleva experimento en el JSON.

### Mercado y parque

| Supuesto | P / B / O | Fuente | Lectura crítica |
|---|---|---|---|
| Parque activo de la agencia | 4.000 / 5.000 / 6.000 veh. | Propio (contexto F07, F08) | Es un dato del CRM del cliente, no del mercado. RUNT da 7,59 M vehículos sin motos en Colombia (F07); 5.000 es el tamaño de una agencia que vende ~1.000–1.500 carros/año (estimación nuestra). |
| % del parque en años 2–5 | 40 % / 45 % / 50 % | Propio (contexto F08) | Depende del historial de ventas de la agencia. El mercado cayó en 2023 y rebotó en 2025, así que las cohortes no son iguales. |
| Crecimiento anual del parque | 3 % / 6 % / 10 % | F08 | Derivado: el mercado creció 26,5 % en 2025 (254.205 matrículas), pero es un rebote. Al parque de una agencia (ventas menos bajas) le damos mucho menos. |

### Comportamiento y embudo

| Supuesto | P / B / O | Fuente | Lectura crítica |
|---|---|---|---|
| Retención actual en taller | 18 % (fijo) | Propio (contexto F04) | Cifra del BRD. En EE. UU. solo el 54 % de dueños de autos de ≤ 2 años vuelve al concesionario (F04) y baja con la edad del carro. Un 18 % en años 2–5 es verosímil, pero **no está medido**. |
| Retención meta año 3 | 24 % / 30 % / 38 % | Propio (contexto F04) | El 38 % del BRD pasa a optimista. Techo de referencia: 54 % (EE. UU., carros más nuevos). |
| Visitas al taller por vehículo/año | 1,0 / 1,2 / 1,5 | F15 (parcial) | De la fuente solo salen ~9.000 km/año en Bogotá (SDA, 2019); 1,0 es derivado con intervalo de 10.000 km (no verificado). El +0,2 de la base (visitas correctivas) es supuesto propio. El 2,0 del BRD estaba alto. |
| Opt-in (consentimiento) | 45 % / 60 % / 70 % | Propio (marco F11) | La Ley 1581 exige autorización previa, expresa e informada (arts. 3 y 9) y con finalidad (art. 4). Sin opt-in no hay contacto: tope duro del embudo. |
| Respuesta al contacto | 30 % / 45 % / 60 % | Propio | Sin dato público fiable para Colombia. Se valida con prueba A/B. |
| Respuesta → cita | 30 % / 40 % / 50 % | Propio | Igual: se mide en el piloto. |
| No-show | 18 % / 12 % / 8 % | Propio | El histórico del DMS lo da en una semana. |
| Meses de rampa | 9 / 6 / 4 | Propio | Depende del opt-in y de la integración con el DMS. |

### Economía por servicio

| Supuesto | P / B / O | Fuente | Lectura crítica |
|---|---|---|---|
| Ticket de mantenimiento | USD 130 / 170 / 220 | F16 (contexto F05, F17) | Un primer mantenimiento de Kia K3 cuesta ~COP 400.000 (≈ USD 121): es la única cifra de fuente. El salto a 170 (+40 %) es estimación propia (se asume que los de 20.000–60.000 km incluyen más piezas). Los precios de taller suben 10,34 % anual (F17). NADA (USD 494/orden) es de EE. UU.: no aplica. **Fuente débil** (una nota de prensa): pedir el tarifario al cliente. |
| Margen bruto del taller | 42 % / 48 % / 52 % | F06 | En EE. UU. servicio y repuestos rinden 45–55 % de margen bruto y > 40 % de la utilidad bruta del concesionario. No hay dato público en Colombia; el pesimista va algo por debajo. |
| Attach de paquete de desgaste | 10 % / 18 % / 25 % | Propio | Se mide en el piloto. |
| Ticket del paquete de desgaste | USD 100 / 140 / 180 | Propio (contexto F17) | Solo hay precios de talleres independientes, sin metodología. Llantas y rines bajaron 2,53 % anual. |
| Margen del paquete | 25 % / 32 % / 38 % | Propio | P&L de repuestos del cliente. |
| Conversión a seguros | 6 % / 10 % / 15 % | Propio (contexto F07, F10) | 2,48 M vehículos con seguro de autos (F10) frente a 7,59 M sin motos (F07) ≈ 33 % (cálculo nuestro, bases distintas): hay espacio, pero el 15 % del BRD es optimista. |
| Comisión por póliza | USD 20 / 35 / 60 | Propio (contexto F09) | SOAT 2026 auto familiar 1.500–2.500 cc: COP 544.700 total (F09). El % de comisión depende del acuerdo con la aseguradora: **no verificado**. |

### Capacidad del taller (datos del cliente)

| Supuesto | P / B / O | Fuente | Lectura crítica |
|---|---|---|---|
| Bahías | 12 | Propio | Confirmar con el jefe de taller. |
| Servicios por bahía/día | 3,5 / 4 / 4,5 | Propio | Tiempos estándar del taller. |
| Días de operación/mes | 24 | Propio | Calendario del taller. |
| Ocupación actual | 65 % / 60 % / 55 % | Propio | Más ocupación = menos espacio para citas nuevas (por eso P es el alto). |

### Costos de IA y operación

| Supuesto | P / B / O | Fuente | Lectura crítica |
|---|---|---|---|
| Costo de LLM por conversación | USD 0,036 / 0,009 / 0,006 | F01 | 6 turnos × 2.500 tokens de entrada y 300 de salida. P = gemini-3.6-flash a USD 1,50/7,50 por 1M (precio desde 2027); B = flash-lite a 0,30/2,50; O = flash-lite con 4 turnos. Los tokens de razonamiento cuentan como salida y pueden subir el costo: **T10 lo mide**. |
| Costo de WhatsApp por conversación | USD 0,030 / 0,019 / 0,017 | F03 (reglas F02, alternativa F21) | Desde el 1-10-2026 Meta cobra también utilidad y servicio dentro de la ventana de 24 h (F02). Colombia: marketing 0,0125; resto 0,0008 (F03). B = 1 marketing + 2 utilidad + 6 servicio (mezcla supuesta). El margen del BSP del pesimista (0,005) es supuesto propio. F03 y F21 son proveedores, no Meta: la tarifa oficial está en un CSV de Meta que no pudimos abrir. |
| Opex de plataforma | USD 735 / 315 / 120 /mes | F22–F24, F28 (parcial; tipo propio) | Vercel Pro USD 20 + USD 20 por asiento extra; Supabase Pro 25 + compute; 360dialog €49/mes. Lo de fuente suma 100 % en O, 46 % en B y 39 % en P; el resto (conector DMS/CRM, excedentes) es supuesto propio. Twilio cobra USD 0,005 por mensaje (F25): subiría el costo por conversación. |
| Opex de equipo (incremental) | USD 3.380 / 1.435 / 635 /mes | F26 (F20, F27) | B = 0,5 operador (COP 3,06 M, Indeed) + 0,25 dev nivel medio (COP 6,5 M) × 1,50 de carga ÷ TRM 3.300. Las fracciones de tiempo son supuesto propio; +0,25 FTE de dev ≈ +USD 740/mes. |
| Horas de asesor ahorradas por cita | 0,15 / 0,25 / 0,35 h | Propio | Sin fuente pública por cita (solo estimaciones de proveedores, descartadas). Estudio de tiempos en el piloto. |
| Costo hora del asesor | USD 4 / 8 / 9 | F19 (piso F18; F27, F29) | Oferta en Bogotá COP 3,0–3,5 M (F19); mínimo 2026 COP 1.750.905 (F18); carga 1,38–1,58 (F27); 182 h/mes = 42 h × 52 / 12 (F29). Una sola oferta: muestra pequeña. |

### Inversión y finanzas

| Supuesto | P / B / O | Fuente | Lectura crítica |
|---|---|---|---|
| Capex inicial | USD 71.800 / 47.500 / 17.300 | F26 (F27) | Equipo × meses × salario × carga ÷ 3.300 + únicos propios. B = 3 personas × 4 meses (2 devs a COP 6,5 M + 1 senior a 11,5 M, ×1,50) = USD 44.545 + 3.000. Tamaño, meses y únicos son supuesto propio; no incluye cobros del DMS/CRM. |
| Tasa de descuento | 20 % / 17 % / 15 % | F14 (parcial) | BanRep en 12,25 % (30-10-2026), inflación esperada 2027: 4,8 % (de la fuente). El 17 % base = 12,25 % + ~5 pts de prima de riesgo: supuesto propio. Es una tasa en pesos: conservadora para flujos en USD. |
| TRM | 3.600 / 3.300 / 3.100 COP/USD | F12 (F13) | TRM 11-11-2026: 3.297,07 (F12). Bancolombia: 3.120–3.300 en noviembre (F13). P = devaluación de ~9 % (supuesto). |

### Política del agente (valores del cliente, no se cambian)

| Supuesto | Valor | Fuente | Lectura crítica |
|---|---|---|---|
| Tope de descuento autónomo | 5 % | Propio (PRD) | Por encima decide un humano. |
| Máx. contactos cada 30 días | 1 | Propio | Anti-spam; coherente con la finalidad informada de la Ley 1581 (F11). |
| Retención de reserva sin confirmar | 15 min | Propio | Validar con el jefe de taller. |

## Fuentes

| Id | Título | Editor | URL | Consulta |
|---|---|---|---|---|
| F01 | Gemini Developer API pricing | Google AI Studio | https://aistudio.google.com/docs/pricing | 2026-11-11 |
| F02 | Pricing on the WhatsApp Business Platform | Meta for Developers | https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing | 2026-11-11 |
| F03 | WhatsApp API pricing (Meta USD rate card, 1-10-2026) | FormBeep | https://formbeep.pages.dev/whatsapp-api-pricing/ | 2026-11-11 |
| F04 | New Cox Automotive Study Finds Dealerships Have Lost 12% of Service Visits to Competition Since 2018 | Cox Automotive | https://www.coxautoinc.com/insights/new-cox-automotive-study-finds-dealerships-have-lost-12-of-service-visits-to-competition-since | 2026-11-11 |
| F05 | NADA Data 2025: Annual Financial Profile | NADA | https://www.nada.org/index.php/media/4695/download | 2026-11-11 |
| F06 | US Auto Dealers – Industry Landscape (ago-2025) | Morningstar | https://marketing.morningstar.com/content/cs-assets/v3/assets/blt9415ea4cc4157833/bltb25942f3777f7bcf/68a61a54f2790134ceae957e/2025_US_Auto_Dealers_Report.pdf | 2026-11-11 |
| F07 | Boletín de Prensa 001 de 2026 | RUNT | https://www.runt.gov.co/sites/default/files/Bolet%C3%ADn%20001%20de%202026.pdf | 2026-11-11 |
| F08 | En Colombia se vendieron casi 250.000 vehículos en 2025 (+26,5 %) | Valora Analitik (ANDI-Fenalco) | https://www.valoraanalitik.com/venta-de-vehiculos-en-colombia-crecio-265-en-todo-2025-diciembre-fue-el-mejor-mes-del-ano/ | 2026-11-11 |
| F09 | Tarifas máximas comerciales del SOAT 2026 | Fasecolda | https://www.fasecolda.com/wp-content/uploads/Tarifas-SOAT-2026-referencia.pdf | 2026-11-11 |
| F10 | Comunicado de cifras 2025 (23-02-2026) | Fasecolda | https://www.fasecolda.com/wp-content/uploads/COMUNICADO-2026-CIFRAS-FINAL.pdf | 2026-11-11 |
| F11 | Ley Estatutaria 1581 de 2012 | Cancillería – Normograma | https://cancilleria.gov.co/sites/default/files/Normograma/docs/ley_1581_2012.htm | 2026-11-11 |
| F12 | TRM vigente el 6-11-2026 (con histórico) | Dolar-Colombia.com | https://www.dolar-colombia.com/2026-11-06 | 2026-11-11 |
| F13 | Proyección del dólar para noviembre de 2026 | El Colombiano | https://www.elcolombiano.com/inicio/dolar-colombia-proyeccion-tasa-cambio-noviembre-2026-GF43201403 | 2026-11-11 |
| F14 | BanRep mantiene la tasa en 12,25 % con voto dividido | Portafolio | https://www.portafolio.co/economia/banco-de-la-republica-mantiene-la-tasa-en-12-25-con-voto-dividido-505819 | 2026-11-11 |
| F15 | Claves de conducción para ahorrar gasolina (dato SDA) | El Tiempo | https://www.eltiempo.com/bogota/claves-de-conduccion-para-ahorrar-gasolina-432002 | 2026-11-11 |
| F16 | Kia K3: costo mensual en Colombia | El Colombiano | https://www.elcolombiano.com/negocios/kia-k3-costo-mensual-colombia-DG34989875 | 2026-11-11 |
| F17 | Mantenimiento y reparación subieron más que la inflación | Portafolio (Asopartes) | https://www.portafolio.co/economia/finanzas/tener-carro-en-colombia-ahora-cuesta-mas-mantenimiento-y-reparacion-subieron-mas-que-la-inflacion-502447 | 2026-11-11 |
| F18 | Salario mínimo 2026 (Decretos 1469 y 1470 de 2025) | ConsultorSalud | https://consultorsalud.com/aumento-del-salario-minimo-en-colombia-2026/ | 2026-11-11 |
| F19 | Oferta: Asesor de servicio automotriz (Bogotá) | elempleo.com | https://www.elempleo.com/co/ofertas-trabajo/asesor-de-servicio-automotriz-1886335988 | 2026-11-11 |
| F20 | Sueldo de desarrollador/a de software en Colombia | Indeed Colombia | https://co.indeed.com/salaries/desarrollador-de-software-Salaries | 2026-11-11 |
| F21 | WhatsApp pricing update (desde 1-10-2026) | Chatalog | https://docs.chatalog.ai/platform-setup/whatsapp-connection-guide/whatsapp-pricing-update | 2026-11-11 |
| F22 | Vercel Pricing (Pro: asientos y crédito de uso) | Vercel | https://vercel.com/pricing | 2026-11-11 |
| F23 | Supabase Pricing (Pro y compute add-ons) | Supabase | https://supabase.com/pricing | 2026-11-11 |
| F24 | 360dialog Pricing (planes WhatsApp API por número) | 360dialog | https://360dialog.com/pricing | 2026-11-11 |
| F25 | WhatsApp API Pricing (tarifa por mensaje de Twilio) | Twilio | https://www.twilio.com/en-us/whatsapp/pricing | 2026-11-11 |
| F26 | Salarios promedio en Colombia (desarrollador junior/medio/senior, abr-2026) | Colombia Move | https://colombiamove.com/blog/es/average-salaries-colombia-by-industry/ | 2026-11-11 |
| F27 | Costo real de un empleado en Colombia 2026 | Buk | https://www.buk.co/blog/costo-real-de-un-empleado-en-colombia-2026 | 2026-11-11 |
| F28 | Promedio mensual EUR/USD 2026 | x-rates.com | https://www.x-rates.com/average/?from=EUR&to=USD&amount=1&year=2026 | 2026-11-11 |
| F29 | Desde hoy rige la jornada laboral de 42 horas en Colombia | Vanguardia | https://www.vanguardia.com/colombia/2026/07/15/desde-hoy-rige-la-jornada-laboral-de-42-horas-en-colombia-asi-queda-el-tiempo-del-almuerzo/ | 2026-11-11 |

**Cómo se verificó:** las páginas HTML se abrieron con WebFetch y contienen la cifra citada. Los PDF (F05, F06, F07, F09, F10) no se podían leer con WebFetch (texto comprimido); se descargaron y se leyeron con `pdftotext`. F19 es una oferta de empleo y puede desaparecer. F22–F29 se abrieron con WebFetch (v1.1); F26 (rangos por nivel) es un blog sin metodología y F27 tiene un total publicado que no cuadra con sus propias líneas (se usa solo el rango 1,38–1,58).

## 5 supuestos críticos a validar con el cliente

| # | Supuesto | Por qué es crítico | Experimento | Métrica y umbral |
|---|---|---|---|---|
| 1 | Retención actual (18 %) y meta (30 %) | Todo el beneficio es la diferencia entre ambas | Consulta al DMS (1 día) + piloto de 3 meses con grupo de control aleatorio | Retorno a 90 días: ≥ +4 pts sobre el control para la base |
| 2 | Opt-in (60 %) | Sin consentimiento no hay contacto (Ley 1581) | Campaña de autorización de 60 días en entrega y taller | % del segmento con autorización y prueba guardada: ≥ 50 % |
| 3 | Respuesta (45 %) y cita (40 %) | Multiplican el embudo | A/B por WhatsApp con ≥ 300 propietarios | Respuesta ≤ 72 h ≥ 35 %; cita ≥ 30 % de quienes responden |
| 4 | Ticket (USD 170) y margen (48 %) | Convierten citas en utilidad; la fuente actual es débil | Exportar 6 meses de órdenes 20.000–60.000 km y P&L de postventa | Ticket ≥ USD 130 y margen ≥ 40 %; si no, escenario pesimista |
| 5 | Visitas/año (1,2) | El BRD decía 2,0: pasar a 1,2 recorta ~40 % el ingreso de taller por vehículo retenido | Histórico del DMS por vehículo retenido | Visitas/año ≥ 1,0 |

## Revisión de costos (v1.1)

Objetivo: reemplazar costos sin fuente por derivaciones con fuente y supuestos de diseño declarados. Base de conversión: TRM 3.300 en los tres escenarios (el costo en pesos no se abarata en el pesimista).

| Supuesto (P / B / O) | Antes → Después | Por qué |
|---|---|---|
| Capex inicial | 80.000 / 60.000 / 45.000 → **71.800 / 47.500 / 17.300** | Salarios por nivel (F26) × carga 1,38–1,58 (F27) × equipo y meses supuestos. El optimista baja mucho (2 personas × 3 meses): es el menos creíble; sin DMS/CRM ni gerencia de proyecto. |
| Opex de plataforma | 2.000 / 1.500 / 1.000 → **735 / 315 / 120** | Precios publicados de Vercel, Supabase y 360dialog suman ~USD 145 en B. El resto (conector DMS/CRM, excedentes) es supuesto propio y es la mayor incertidumbre. |
| Opex de equipo | 4.500 / 3.000 / 2.200 → **3.380 / 1.435 / 635** | Solo costo incremental (fracción de operador + dev); antes se usaba un dev casi completo. Depende de las fracciones supuestas. |
| Costo hora asesor | 5 / 7 / 9 → **4 / 8 / 9** | Jornada de 42 h (182 h/mes, F29) y carga con fuente (F27); B sube al punto medio de la oferta (COP 3,25 M). |
| Horas ahorradas por cita | 0,15 / 0,25 / 0,35 → sin cambio | No hay fuente pública por cita; queda propio con estudio de tiempos. |
| Visitas, ticket, tasa de descuento, WhatsApp | sin cambio de valor | Solo notas: se declara qué parte es de la fuente y qué parte es supuesto propio (+0,2 visitas; USD 121 → 170; +5 pts de prima; margen del BSP y mezcla de mensajes). |

Lectura honesta: los costos con fuente salen **menores** que los supuestos v1.0, pero las cifras más bajas dependen de decisiones propias (equipo pequeño, fracciones de tiempo, conector DMS barato). El riesgo al alza que no está en el modelo: un BSP con margen por mensaje (Twilio, USD 0,005 por mensaje, F25) elevaría el costo de WhatsApp por conversación por encima del pesimista de USD 0,03 (≈ 0,045–0,055 solo de margen).

## Qué no sabemos

- **Retención real en Colombia** por edad del vehículo: no hay estudio público; solo datos de EE. UU. (Cox).
- **Margen de postventa de concesionarios colombianos**: no es público; usamos el rango de EE. UU.
- **Tarifario de mantenimiento por marca** en concesionarios: no encontramos listas oficiales; la única cifra es una nota de prensa (Kia K3).
- **Comisión de seguros** que paga una aseguradora a la agencia (SOAT y póliza voluntaria): depende del contrato; no verificado.
- **Tarifa oficial de Meta** para Colombia: la vimos en dos proveedores (FormBeep y Chatalog) que no coinciden (0,0125 vs 0,015 en marketing); el CSV oficial no se pudo abrir.
- **Kilometraje anual actual** en Colombia: el único dato oficial es de Bogotá y de 2019.
- **Tokens reales por conversación**: 6 turnos × 2.500 es un supuesto; T10 lo mide con evals.
- **Carga prestacional exacta**: F27 da 1,38–1,58 según ARL y exoneración; depende del contrato real. La jornada de 42 h (F29) es de prensa, no del texto de la ley.
- **Cobro del DMS/CRM** por acceso a API y tiempo real de integración: sin dato público; es el mayor riesgo de capex y opex de plataforma.
- **Cargo de alta/verificación de WhatsApp** (Meta): no pudimos confirmar si existe; cubierto con un único propio.
