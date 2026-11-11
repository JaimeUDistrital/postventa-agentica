/**
 * Esquema de `data/assumptions.json`: fuente única de supuestos para Excel, PDF y prototipo.
 * Los ids de REQUIRED_ASSUMPTION_IDS son contrato entre T01 (valores) y T07 (Excel):
 * solo el Orquestador añade o renombra ids.
 */
import { z } from "zod";

export const REQUIRED_ASSUMPTION_IDS = [
  // Mercado y parque
  "parque_activo_vehiculos",
  "pct_parque_segmento_2a5",
  "crecimiento_parque_anual",
  // Comportamiento y funnel
  "retencion_taller_actual",
  "retencion_taller_meta_a3",
  "visitas_taller_por_vehiculo_anio",
  "tasa_opt_in",
  "tasa_respuesta_contacto",
  "conversion_agendamiento",
  "tasa_no_show",
  "meses_rampa",
  // Economía por servicio
  "ticket_promedio_taller_usd",
  "margen_bruto_taller",
  "attach_venta_cruzada_desgaste",
  "ticket_venta_cruzada_usd",
  "margen_venta_cruzada",
  "conversion_seguros",
  "comision_seguro_usd",
  // Capacidad del taller
  "bahias_taller",
  "servicios_por_bahia_dia",
  "dias_operacion_mes",
  "ocupacion_actual",
  // Costos de IA y operación
  "costo_ia_por_conversacion_usd",
  "costo_whatsapp_por_conversacion_usd",
  "opex_plataforma_mensual_usd",
  "opex_equipo_mensual_usd",
  "horas_asesor_ahorradas_por_cita",
  "costo_hora_asesor_usd",
  // Inversión y finanzas
  "capex_inicial_usd",
  "tasa_descuento_anual",
  "trm_cop_usd",
  // Política del agente (la usa el prototipo)
  "tope_descuento_pct",
  "max_contactos_30_dias",
  "hold_reserva_minutos",
] as const;

export type AssumptionId = (typeof REQUIRED_ASSUMPTION_IDS)[number];

export const Source = z.object({
  id: z.string().regex(/^F\d{2,3}$/, "Ids de fuente: F01, F02…"),
  titulo: z.string().min(3),
  editor: z.string().min(2),
  url: z.string().url(),
  fecha_consulta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const Assumption = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  nombre: z.string().min(3),
  unidad: z.string().min(1),
  pesimista: z.number(),
  base: z.number(),
  optimista: z.number(),
  fuente_id: z.string().nullable(),
  tipo: z.enum(["mercado", "propio"]),
  estado: z.enum(["borrador", "final"]),
  /** Cómo se valida con el cliente (experimento, métrica, umbral). */
  validacion: z.string(),
  nota: z.string().optional(),
});

export const AssumptionsFile = z
  .object({
    version: z.string(),
    mercado: z.literal("Colombia"),
    moneda: z.literal("USD"),
    actualizado: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    supuestos: z.array(Assumption),
    fuentes: z.array(Source),
  })
  .superRefine((file, ctx) => {
    const ids = new Set<string>();
    const fuentes = new Set(file.fuentes.map((f) => f.id));
    for (const s of file.supuestos) {
      if (ids.has(s.id)) ctx.addIssue({ code: "custom", message: `Supuesto duplicado: ${s.id}` });
      ids.add(s.id);
      const asc = s.pesimista <= s.base && s.base <= s.optimista;
      const desc = s.pesimista >= s.base && s.base >= s.optimista;
      if (!asc && !desc)
        ctx.addIssue({ code: "custom", message: `${s.id}: P/B/O no es monótono` });
      if (s.fuente_id !== null && !fuentes.has(s.fuente_id))
        ctx.addIssue({ code: "custom", message: `${s.id}: fuente ${s.fuente_id} no existe` });
      if (s.tipo === "mercado" && s.fuente_id === null)
        ctx.addIssue({ code: "custom", message: `${s.id}: tipo mercado exige fuente_id` });
      if (s.tipo === "propio" && s.validacion.trim().length < 10)
        ctx.addIssue({ code: "custom", message: `${s.id}: supuesto propio exige validacion` });
    }
    for (const req of REQUIRED_ASSUMPTION_IDS)
      if (!ids.has(req)) ctx.addIssue({ code: "custom", message: `Falta supuesto requerido: ${req}` });
  });

export type Source = z.infer<typeof Source>;
export type Assumption = z.infer<typeof Assumption>;
export type AssumptionsFile = z.infer<typeof AssumptionsFile>;
