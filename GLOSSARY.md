# Glosario

Términos del dominio automotriz y del producto, tal como se usan en este repo.

## Dominio postventa

- **Postventa**: servicios y ventas posteriores a la compra del vehículo (mantenimiento, repuestos, seguros).
- **Bahía**: puesto físico del taller donde se atiende un vehículo; su disponibilidad limita las citas.
- **OT (orden de trabajo)**: documento que registra qué se le hará al vehículo en el taller y su costo.
- **Hito de mantenimiento**: revisión programada por kilometraje (p. ej. 30.000 km) con su lista de tareas y tarifa.
- **Asesor de servicio**: persona de la agencia que atiende al cliente, aprueba lo sensible y recibe los handoffs.
- **Ticket**: valor promedio facturado por visita o cliente.
- **SOAT**: seguro obligatorio de accidentes de tránsito en Colombia.
- **Póliza todo riesgo**: seguro voluntario que cubre daños propios y a terceros; se ofrece mediante aliados.
- **Venta cruzada**: oferta de un producto adicional relacionado (p. ej. pastillas de freno junto al mantenimiento).
- **Fuga de clientes**: clientes que dejan de hacer su postventa en la agencia y van a talleres externos.
- **Retención**: proporción de clientes que siguen usando el postventa de la agencia.
- **Sin stock**: repuesto agotado en inventario; el agente ofrece alternativas tras la reposición y abre un caso.

## Consentimiento y riesgo

- **Opt-in / consentimiento**: autorización del cliente para recibir mensajes de WhatsApp; sin ella el agente no contacta.
- **PII**: datos personales identificables (cédula, celular, email, placa); se enmascaran en trazas y respuestas.
- **Síntoma crítico**: falla que compromete la seguridad (humo, freno sin respuesta, sobrecalentamiento); se escala a un humano.
- **Handoff**: traspaso de la conversación del agente a un asesor humano, con resumen y prioridad.
- **Manipulación (prompt injection)**: intento del cliente de saltarse reglas del agente (descuentos, rol de gerente).

## Producto y agente

- **Guardián**: capa determinista (reglas, sin LLM) que valida entradas y salidas, y que el LLM no puede anular.
- **Planner**: componente que decide el siguiente paso y las herramientas; hay uno determinista y otro con Gemini.
- **Modo determinista**: funcionamiento sin LLM, con reglas fijas; es el modo por defecto de la demo.
- **Traza**: registro ordenado de eventos de un turno (herramientas, políticas, estado) con PII enmascarada.
- **Autonomía (informar / recomendar / ejecutar)**: nivel de acción permitido al agente: solo dar información, sugerir, o actuar por sí mismo.
- **Código del jurado**: valor secreto de `DEMO_ACCESS_CODE` que, vía `?codigo=`, habilita Gemini en la demo pública.
- **Consola del asesor**: interfaz de la demo con clientes de hoy, conversación y panel de acciones.
- **Motor de reglas**: lo que la consola muestra como «Motor: reglas» cuando responde el planner determinista (modo determinista, sin IA). No es lo mismo que la «Demo guiada».
- **Demo guiada**: modo de uso por defecto de la consola: muestra los 3 pasos y el botón «Siguiente mensaje del cliente», que envía el guion del escenario.
- **Modo libre**: modo de uso como en producción: sin guion ni pasos; se escribe como cliente o se usan los botones de las tarjetas. Cambiar de modo no borra las conversaciones.
- **Agenda del taller**: pestaña de la consola con los cupos de cada bahía por día («Libre» / «Ocupado») y, resaltadas, las citas hechas en la demo con su estado («Reservada» / «Confirmada»).
- **Token de sesión**: estado firmado (HMAC) que viaja con cada turno; no hay base de datos.
- **Evals**: casos con criterios pasa/no pasa para medir al agente.

## Caso de negocio

- **Payback**: meses hasta recuperar la inversión inicial.
- **VPN (valor presente neto)**: suma de flujos futuros descontados menos la inversión; negativo implica que no se recupera.
- **ROI**: beneficio a 3 años dividido entre la inversión.
- **Punto de equilibrio**: citas por mes necesarias para cubrir los costos operativos.
- **Sede equivalente**: unidad de escala; cuántas sedes del tamaño modelado harían falta para alcanzar el payback objetivo.
- **Escenario (pesimista / base / optimista)**: conjunto de supuestos con los que se corre el modelo financiero.
- **Supuesto con fuente**: cifra de `data/assumptions.json` con su origen citado, o declarada como supuesto.
