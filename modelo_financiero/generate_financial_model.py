"""Genera MODELO_FINANCIERO_POSTVENTA_3Y.xlsx y financial_summary.json desde data/assumptions.json.

Uso: uv run python generate_financial_model.py
Todas las celdas de cálculo son fórmulas que apuntan a la hoja Supuestos_y_Fuentes
(entradas en azul). Las cifras de financial_summary.json salen de reference_model.py.
"""
import datetime as dt
import json
from dataclasses import dataclass
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter as L

import reference_model as ref

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ASSUMPTIONS_JSON = ROOT / "data" / "assumptions.json"
OUT_XLSX = ROOT / "entregables" / "MODELO_FINANCIERO_POSTVENTA_3Y.xlsx"
OUT_JSON = ROOT / "entregables" / "financial_summary.json"

S_SUP, S_FUN, S_CASO, S_SENS, S_VAL, S_BE = (
    "Supuestos_y_Fuentes", "Funnel_y_Operacion_3Y", "Caso_Negocio_Escenarios",
    "Sensibilidad", "Plan_Validacion", "Punto_Equilibrio")
LABEL = {"pesimista": "Pesimista", "base": "Base", "optimista": "Optimista"}
SCEN_COL = {"pesimista": "D", "base": "E", "optimista": "F"}  # columnas en Supuestos
FIRST_MONTH_COL = 3
N = ref.MODEL_PARAMS["horizonte_meses"]
LAST_COL = L(FIRST_MONTH_COL + N - 1)
TOTAL_COL = L(FIRST_MONTH_COL + N)
PROPIO = "Propio (T07) – validar"

BLUE = Font(color="0000FF")
BOLD = Font(bold=True)
HEAD = Font(bold=True, color="FFFFFF")
HEAD_FILL = PatternFill("solid", fgColor="1F3864")
INPUT_FILL = PatternFill("solid", fgColor="FFF2CC")
BLOCK_FILL = PatternFill("solid", fgColor="D9E1F2")
F_INT, F_USD, F_PCT, F_DEC = "#,##0", "#,##0;[Red]-#,##0", "0.0%", "#,##0.00"

# Semana objetivo del plan de validación por grupo de supuestos (entradas editables).
WEEK_BY_ID = {
    "parque_activo_vehiculos": 1, "pct_parque_segmento_2a5": 1, "crecimiento_parque_anual": 2,
    "retencion_taller_actual": 2, "retencion_taller_meta_a3": 12, "visitas_taller_por_vehiculo_anio": 2,
    "tasa_opt_in": 4, "tasa_respuesta_contacto": 6, "conversion_agendamiento": 6, "tasa_no_show": 4,
    "meses_rampa": 12, "ticket_promedio_taller_usd": 2, "margen_bruto_taller": 3,
    "attach_venta_cruzada_desgaste": 8, "ticket_venta_cruzada_usd": 3, "margen_venta_cruzada": 3,
    "conversion_seguros": 10, "comision_seguro_usd": 3, "bahias_taller": 1,
    "servicios_por_bahia_dia": 2, "dias_operacion_mes": 1, "ocupacion_actual": 2,
    "costo_ia_por_conversacion_usd": 4, "costo_whatsapp_por_conversacion_usd": 2,
    "opex_plataforma_mensual_usd": 3, "opex_equipo_mensual_usd": 3,
    "horas_asesor_ahorradas_por_cita": 8, "costo_hora_asesor_usd": 2, "capex_inicial_usd": 3,
    "tasa_descuento_anual": 2, "trm_cop_usd": 1, "tope_descuento_pct": 4,
    "max_contactos_30_dias": 4, "hold_reserva_minutos": 4,
}
DEFAULT_WEEK = 6

# --------------------------------------------------------------------------- entradas


def load_assumptions(path: Path = ASSUMPTIONS_JSON) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


@dataclass
class Layout:
    """Dónde vive cada supuesto y cada parámetro del modelo en Supuestos_y_Fuentes."""
    rows: dict  # id de supuesto o de parámetro -> fila

    def ref(self, key: str, scenario: str = "base") -> str:
        col = "E" if key in ref.MODEL_PARAMS else SCEN_COL[scenario]
        return f"{S_SUP}!${col}${self.rows[key]}"


# --------------------------------------------------------------------------- utilidades de hoja


def header(ws, row: int, values: list, start_col: int = 1) -> None:
    for i, v in enumerate(values):
        c = ws.cell(row=row, column=start_col + i, value=v)
        c.font, c.fill = HEAD, HEAD_FILL
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def month_header(ws, row: int, first_label: str) -> None:
    header(ws, row, [first_label, "Unidad"])
    for i in range(N):
        c = ws.cell(row=row, column=FIRST_MONTH_COL + i,
                    value=dt.date(2027 + i // 12, i % 12 + 1, 1))
        c.number_format, c.font, c.fill = "mmm-yy", HEAD, HEAD_FILL
        c.alignment = Alignment(horizontal="center")
    c = ws.cell(row=row, column=FIRST_MONTH_COL + N, value="Total 36m")
    c.font, c.fill = HEAD, HEAD_FILL


def title(ws, text: str, note: str) -> None:
    ws["A1"], ws["A1"].font = text, Font(bold=True, size=14)
    ws["A2"], ws["A2"].font = note, Font(italic=True, color="595959")


def set_widths(ws, widths: dict, month_width: float = 11) -> None:
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    for i in range(N + 1):
        letter = L(FIRST_MONTH_COL + i)
        if letter not in widths:
            ws.column_dimensions[letter].width = month_width


# --------------------------------------------------------------------------- hoja 1


def build_supuestos(wb: Workbook, data: dict) -> Layout:
    ws = wb.active
    ws.title = S_SUP
    title(ws, "Supuestos y fuentes (USD, Colombia)",
          f"Versión de supuestos: {data['version']} · actualizado {data['actualizado']}. "
          "Azul = entrada editable; todo el libro calcula desde estas celdas.")
    header(ws, 4, ["Id", "Descripción", "Unidad", "Pesimista", "Base", "Optimista", "Tipo",
                   "Fuente / experimento de validación"])
    fuentes = {f["id"]: f for f in data["fuentes"]}
    rows = {}
    for i, s in enumerate(data["supuestos"]):
        r = 5 + i
        rows[s["id"]] = r
        src = (f"{s['fuente_id']} – {fuentes[s['fuente_id']]['titulo']} – "
               f"{fuentes[s['fuente_id']]['url']}" if s["fuente_id"] else
               f"Experimento de validación: {s['validacion']}")
        for col, v in enumerate([s["id"], s["nombre"], s["unidad"], s["pesimista"], s["base"],
                                 s["optimista"], s["tipo"], src], start=1):
            ws.cell(row=r, column=col, value=v)
        pct = s["unidad"].startswith("%")
        for col in (4, 5, 6):
            c = ws.cell(row=r, column=col)
            c.font, c.fill = BLUE, INPUT_FILL
            c.number_format = F_PCT if pct else "#,##0.00##"
    r = 5 + len(data["supuestos"]) + 1
    ws.cell(row=r, column=1, value="Parámetros del modelo (estructurales)").font = BOLD
    descriptions = {
        "horizonte_meses": ("Horizonte del modelo", "meses"),
        "meses_por_anio": ("Meses por año", "meses"),
        "delta_sensibilidad": ("Variación ± de la sensibilidad", "%"),
        "payback_objetivo_meses": ("Payback objetivo del punto de equilibrio", "meses"),
    }
    for key, value in ref.MODEL_PARAMS.items():
        r += 1
        rows[key] = r
        ws.cell(row=r, column=1, value=key)
        ws.cell(row=r, column=2, value=descriptions[key][0])
        ws.cell(row=r, column=3, value=descriptions[key][1])
        c = ws.cell(row=r, column=5, value=value)
        c.font, c.fill = BLUE, INPUT_FILL
        c.number_format = F_PCT if key == "delta_sensibilidad" else "0"
        ws.cell(row=r, column=7, value=PROPIO)
    r += 2
    ws.cell(row=r, column=1, value="Tabla de fuentes").font = BOLD
    header(ws, r + 1, ["Id", "Título", "Editor", "URL", "Fecha de consulta"])
    for j, f in enumerate(data["fuentes"]):
        for col, v in enumerate([f["id"], f["titulo"], f["editor"], f["url"], f["fecha_consulta"]],
                                start=1):
            ws.cell(row=r + 2 + j, column=col, value=v)
    set_widths_simple(ws, {"A": 36, "B": 52, "C": 14, "D": 12, "E": 12, "F": 12, "G": 22, "H": 90})
    ws.freeze_panes = "C5"
    return Layout(rows)


def set_widths_simple(ws, widths: dict) -> None:
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


# --------------------------------------------------------------------------- bloques mensuales


class Ctx:
    """Contexto de una columna-mes: resuelve supuestos y celdas de otras filas."""

    def __init__(self, col: str, prev, ref_fn, loc: dict, mpa: str):
        self.c, self.p, self.ref, self.loc, self.mpa = col, prev, ref_fn, loc, mpa

    def at(self, key: str) -> str:
        prefix, row = self.loc[key]
        return f"{prefix}{self.c}{row}"

    def before(self, key: str) -> str:
        prefix, row = self.loc[key]
        return f"{prefix}{self.p}{row}"

    def rng(self, key: str) -> str:
        prefix, row = self.loc[key]
        return f"{prefix}${L(FIRST_MONTH_COL)}${row}:${LAST_COL}${row}"


def _mes(x):
    return "=1" if x.p is None else f"={x.before('mes')}+1"


def _acum(x):
    first = f"=-{x.ref('capex_inicial_usd')}+{x.at('flujo')}"
    return first if x.p is None else f"={x.before('acumulado')}+{x.at('flujo')}"


# (key, etiqueta, unidad, formato, función(ctx)->fórmula, con_total)
FUNNEL_SPECS = [
    ("mes", "Mes del horizonte", "#", "0", _mes, False),
    ("rampa", "Rampa de adopción", "%", F_PCT,
     lambda x: f"=MIN(1,{x.at('mes')}/{x.ref('meses_rampa')})", False),
    ("parque", "Parque activo total", "vehículos", F_INT,
     lambda x: f"={x.ref('parque_activo_vehiculos')}*(1+{x.ref('crecimiento_parque_anual')})^({x.at('mes')}/{x.mpa})", False),
    ("elegibles", "Parque elegible (segmento 2 a 5 años)", "vehículos", F_INT,
     lambda x: f"={x.at('parque')}*{x.ref('pct_parque_segmento_2a5')}", False),
    ("optin", "Con opt-in (× rampa)", "vehículos", F_INT,
     lambda x: f"={x.at('elegibles')}*{x.ref('tasa_opt_in')}*{x.at('rampa')}", False),
    ("contactados", "Contactados (= conversaciones; solo vehículos que hoy se fugan)", "contactos/mes", F_INT,
     lambda x: f"={x.at('optin')}*{x.ref('visitas_taller_por_vehiculo_anio')}/{x.mpa}*(1-{x.ref('retencion_taller_actual')})", True),
    ("respondieron", "Respondieron", "contactos/mes", F_INT,
     lambda x: f"={x.at('contactados')}*{x.ref('tasa_respuesta_contacto')}", True),
    ("agendados", "Agendados", "citas/mes", F_INT,
     lambda x: f"={x.at('respondieron')}*{x.ref('conversion_agendamiento')}", True),
    ("demanda", "Demanda atendible (agendados menos no-show)", "citas/mes", F_INT,
     lambda x: f"={x.at('agendados')}*(1-{x.ref('tasa_no_show')})", True),
    ("tope_retencion", "Tope por meta de retención (año 3)", "citas/mes", F_INT,
     lambda x: f"={x.at('elegibles')}*{x.ref('visitas_taller_por_vehiculo_anio')}/{x.mpa}*({x.ref('retencion_taller_meta_a3')}-{x.ref('retencion_taller_actual')})", False),
    ("capacidad", "Capacidad libre de bahías", "citas/mes", F_INT,
     lambda x: f"={x.ref('bahias_taller')}*{x.ref('servicios_por_bahia_dia')}*{x.ref('dias_operacion_mes')}*(1-{x.ref('ocupacion_actual')})", False),
    ("atendidos", "Atendidos = MIN(demanda, tope de retención, capacidad)", "citas/mes", F_INT,
     lambda x: f"=MIN({x.at('demanda')},{x.at('tope_retencion')},{x.at('capacidad')})", True),
    ("uso_capacidad", "Uso de la capacidad libre", "%", F_PCT,
     lambda x: f"=IF({x.at('capacidad')}>0,{x.at('atendidos')}/{x.at('capacidad')},0)", False),
    ("retencion_lograda", "Retención lograda (actual + incremental)", "%", F_PCT,
     lambda x: f"={x.ref('retencion_taller_actual')}+IF({x.at('elegibles')}>0,{x.at('atendidos')}/({x.at('elegibles')}*{x.ref('visitas_taller_por_vehiculo_anio')}/{x.mpa}),0)", False),
]

FIN_SPECS = [
    ("ing_mant", "Ingresos de mantenimiento", "USD", F_USD,
     lambda x: f"={x.at('atendidos')}*{x.ref('ticket_promedio_taller_usd')}", True),
    ("ing_vc", "Ingresos de venta cruzada (desgaste)", "USD", F_USD,
     lambda x: f"={x.at('atendidos')}*{x.ref('attach_venta_cruzada_desgaste')}*{x.ref('ticket_venta_cruzada_usd')}", True),
    ("ing_seg", "Comisiones de seguros", "USD", F_USD,
     lambda x: f"={x.at('atendidos')}*{x.ref('conversion_seguros')}*{x.ref('comision_seguro_usd')}", True),
    ("ingresos", "Ingresos totales", "USD", F_USD,
     lambda x: f"={x.at('ing_mant')}+{x.at('ing_vc')}+{x.at('ing_seg')}", True),
    ("mg_mant", "Margen bruto de mantenimiento", "USD", F_USD,
     lambda x: f"={x.at('ing_mant')}*{x.ref('margen_bruto_taller')}", True),
    ("mg_vc", "Margen bruto de venta cruzada", "USD", F_USD,
     lambda x: f"={x.at('ing_vc')}*{x.ref('margen_venta_cruzada')}", True),
    ("mg_seg", "Margen de comisiones (100 %)", "USD", F_USD,
     lambda x: f"={x.at('ing_seg')}", True),
    ("margen", "Margen bruto total", "USD", F_USD,
     lambda x: f"={x.at('mg_mant')}+{x.at('mg_vc')}+{x.at('mg_seg')}", True),
    ("ahorro", "Ahorro de horas de asesor", "USD", F_USD,
     lambda x: f"={x.at('atendidos')}*{x.ref('horas_asesor_ahorradas_por_cita')}*{x.ref('costo_hora_asesor_usd')}", True),
    ("costo_ia", "Costo de IA (conversaciones × costo)", "USD", F_USD,
     lambda x: f"={x.at('contactados')}*{x.ref('costo_ia_por_conversacion_usd')}", True),
    ("costo_wa", "Costo de WhatsApp (conversaciones × costo)", "USD", F_USD,
     lambda x: f"={x.at('contactados')}*{x.ref('costo_whatsapp_por_conversacion_usd')}", True),
    ("opex_plat", "Opex de plataforma", "USD", F_USD,
     lambda x: f"={x.ref('opex_plataforma_mensual_usd')}", True),
    ("opex_eq", "Opex de equipo", "USD", F_USD,
     lambda x: f"={x.ref('opex_equipo_mensual_usd')}", True),
    ("costos", "Costos de operación totales", "USD", F_USD,
     lambda x: f"={x.at('costo_ia')}+{x.at('costo_wa')}+{x.at('opex_plat')}+{x.at('opex_eq')}", True),
    ("flujo", "Flujo mensual (margen + ahorro − costos)", "USD", F_USD,
     lambda x: f"={x.at('margen')}+{x.at('ahorro')}-{x.at('costos')}", True),
    ("acumulado", "Flujo acumulado (incluye inversión inicial)", "USD", F_USD, _acum, False),
]


def write_block(ws, top: int, name: str, specs: list, ref_fn, mpa: str,
                external: dict | None = None, prefix: str = "") -> dict:
    """Escribe un bloque (título, filas de specs × 36 meses). Devuelve {key: (prefijo, fila)}."""
    ws.cell(row=top, column=1, value=name).font = BOLD
    for col in range(1, FIRST_MONTH_COL + N + 1):
        ws.cell(row=top, column=col).fill = BLOCK_FILL
    first = top + 1
    loc = dict(external or {})
    loc.update({spec[0]: (prefix, first + i) for i, spec in enumerate(specs)})
    for i, (key, label, unit, fmt, fn, total) in enumerate(specs):
        r = first + i
        ws.cell(row=r, column=1, value=label)
        ws.cell(row=r, column=2, value=unit)
        for m in range(N):
            col = L(FIRST_MONTH_COL + m)
            prev = L(FIRST_MONTH_COL + m - 1) if m else None
            c = ws.cell(row=r, column=FIRST_MONTH_COL + m, value=fn(Ctx(col, prev, ref_fn, loc, mpa)))
            c.number_format = fmt
        if total:
            c = ws.cell(row=r, column=FIRST_MONTH_COL + N,
                        value=f"=SUM({L(FIRST_MONTH_COL)}{r}:{LAST_COL}{r})")
            c.number_format, c.font = fmt, BOLD
    return loc


# --------------------------------------------------------------------------- hojas 2 y 3

SUMMARY_TOP = 5
SUMMARY_KEYS = ["ingresos_3y", "margen_bruto_3y", "ahorro_asesor_3y", "costos_3y", "inversion",
                "beneficio_3y", "payback_meses", "roi_3y", "tasa_mensual", "vpn"]
JSON_METRICS = ["ingresos_3y", "beneficio_3y", "inversion", "payback_meses", "roi_3y", "vpn"]
SUMMARY_COL = {"pesimista": "C", "base": "D", "optimista": "E"}


def summary_cells(scenario: str) -> dict:
    """Celdas (hoja Caso_Negocio_Escenarios) con las cifras clave del escenario."""
    return {k: f"{SUMMARY_COL[scenario]}{SUMMARY_TOP + SUMMARY_KEYS.index(k)}" for k in JSON_METRICS}


def payback_formula(acum_range: str, horizon: str) -> str:
    return (f'=IF(COUNTIF({acum_range},"<0")>={horizon},"> 36",'
            f'COUNTIF({acum_range},"<0")+1)')


def build_funnel(wb: Workbook, lay: Layout) -> dict:
    ws = wb.create_sheet(S_FUN)
    title(ws, "Funnel y operación a 36 meses (ene-2027 a dic-2029)",
          "Tres escenarios en paralelo. Parque → elegibles → opt-in → contactados → agendados → atendidos, "
          "con tope MIN(demanda, retención, capacidad de bahías).")
    month_header(ws, 4, "Concepto")
    mpa = lay.ref("meses_por_anio")
    top, blocks = 5, {}
    for scen in ref.ESCENARIOS:
        blocks[scen] = write_block(ws, top, f"ESCENARIO {LABEL[scen].upper()}", FUNNEL_SPECS,
                                   lambda k, s=scen: lay.ref(k, s), mpa)
        top += len(FUNNEL_SPECS) + 2
    set_widths(ws, {"A": 62, "B": 14})
    ws.freeze_panes = "C5"
    return blocks


def build_caso(wb: Workbook, lay: Layout, funnel: dict) -> None:
    ws = wb.create_sheet(S_CASO)
    title(ws, "Caso de negocio por escenario (USD)",
          "Resumen arriba; detalle mensual por escenario debajo. Beneficio 3 años = Σ flujo − inversión; "
          "ROI = beneficio / inversión; VPN = NPV(tasa mensual, flujos) − inversión.")
    header(ws, 4, ["Métrica", "Unidad"] + [LABEL[s] for s in ref.ESCENARIOS])
    mpa, horizon = lay.ref("meses_por_anio"), lay.ref("horizonte_meses")
    top = SUMMARY_TOP + len(SUMMARY_KEYS) + 2
    blocks = {}
    for scen in ref.ESCENARIOS:
        ext = {k: (f"{S_FUN}!", r) for k, (_, r) in funnel[scen].items()}
        month_header(ws, top + 1, f"Detalle mensual · {LABEL[scen]}")
        blocks[scen] = write_block(ws, top + 2, f"ESCENARIO {LABEL[scen].upper()}", FIN_SPECS,
                                   lambda k, s=scen: lay.ref(k, s), mpa, external=ext)
        top += len(FIN_SPECS) + 4
    labels = {
        "ingresos_3y": ("Ingresos 3 años", "USD", F_USD), "margen_bruto_3y": ("Margen bruto 3 años", "USD", F_USD),
        "ahorro_asesor_3y": ("Ahorro horas de asesor 3 años", "USD", F_USD),
        "costos_3y": ("Costos de operación 3 años (IA, WhatsApp, opex)", "USD", F_USD),
        "inversion": ("Inversión inicial", "USD", F_USD), "beneficio_3y": ("Beneficio neto 3 años", "USD", F_USD),
        "payback_meses": ("Payback", "meses", "0"), "roi_3y": ("ROI 3 años", "%", F_PCT),
        "tasa_mensual": ("Tasa de descuento mensual", "%", "0.000%"), "vpn": ("VPN", "USD", F_USD),
    }
    for i, key in enumerate(SUMMARY_KEYS):
        ws.cell(row=SUMMARY_TOP + i, column=1, value=labels[key][0])
        ws.cell(row=SUMMARY_TOP + i, column=2, value=labels[key][1])
    for scen in ref.ESCENARIOS:
        loc, col = blocks[scen], SUMMARY_COL[scen]
        rng = lambda k: f"${L(FIRST_MONTH_COL)}${loc[k][1]}:${LAST_COL}${loc[k][1]}"
        cell = lambda k: f"{col}{SUMMARY_TOP + SUMMARY_KEYS.index(k)}"
        total = lambda k: f"={TOTAL_COL}{loc[k][1]}"
        formulas = {
            "ingresos_3y": total("ingresos"), "margen_bruto_3y": total("margen"),
            "ahorro_asesor_3y": total("ahorro"), "costos_3y": total("costos"),
            "inversion": f"={lay.ref('capex_inicial_usd', scen)}",
            "beneficio_3y": f"=SUM({rng('flujo')})-{cell('inversion')}",
            "payback_meses": payback_formula(rng("acumulado"), horizon),
            "roi_3y": f"={cell('beneficio_3y')}/{cell('inversion')}",
            "tasa_mensual": f"=(1+{lay.ref('tasa_descuento_anual', scen)})^(1/{mpa})-1",
            "vpn": f"=NPV({cell('tasa_mensual')},{rng('flujo')})-{cell('inversion')}",
        }
        for key, f in formulas.items():
            c = ws[cell(key)]
            c.value, c.number_format = f, labels[key][2]
            c.font = BOLD if key in JSON_METRICS else Font()
            c.alignment = Alignment(horizontal="right")
    set_widths(ws, {"A": 62, "B": 14, "C": 14, "D": 14, "E": 14})
    ws.freeze_panes = "C5"


# --------------------------------------------------------------------------- hoja 4

SENS_TABLE_TOP = 8
SENS_BASE_BENEFIT_CELL = f"C{SENS_TABLE_TOP + len(ref.DRIVERS) + 1}"
SENS_BASE_PAYBACK_CELL = f"C{SENS_TABLE_TOP + len(ref.DRIVERS) + 2}"


def sens_result_cells() -> dict:
    """driver -> (celda beneficio −Δ, celda beneficio +Δ) en la hoja Sensibilidad."""
    return {d: (f"D{SENS_TABLE_TOP + i}", f"E{SENS_TABLE_TOP + i}") for i, d in enumerate(ref.DRIVERS)}


def build_sensibilidad(wb: Workbook, lay: Layout, data: dict) -> None:
    ws = wb.create_sheet(S_SENS)
    title(ws, "Sensibilidad del escenario base: ±Δ en 6 drivers",
          "Nota: cada caso recalcula el modelo completo del escenario base (mismo funnel y flujo, bloques "
          "debajo de la tabla) cambiando UN driver en ±Δ; Δ está en Supuestos_y_Fuentes (parámetros).")
    delta = lay.ref("delta_sensibilidad")
    ws["A4"], ws["C4"] = "Variación aplicada (±)", f"={delta}"
    ws["C4"].number_format = F_PCT
    ws["A5"] = "Beneficio neto 3 años = Σ flujo mensual − inversión inicial (USD)."
    header(ws, SENS_TABLE_TOP - 1, ["Driver (id)", "Descripción", "Valor base", "Beneficio −Δ", "Beneficio +Δ",
                                    "Cambio vs base −Δ", "Cambio vs base +Δ", "Payback −Δ", "Payback +Δ",
                                    "Oscilación (|+Δ − −Δ|)"])
    names = {s["id"]: s["nombre"] for s in data["supuestos"]}
    mpa, horizon, capex = lay.ref("meses_por_anio"), lay.ref("horizonte_meses"), None
    top = SENS_TABLE_TOP + len(ref.DRIVERS) + 5
    cases = [("base", None, 0)] + [(d, s, sg) for d in ref.DRIVERS for s, sg in (("menos", -1), ("mas", 1))]
    results = {}
    for driver, tag, sign in cases:
        def ref_fn(k, driver=driver, sign=sign):
            base = lay.ref(k, "base")
            return f"({base}*(1+({sign})*{delta}))" if k == driver and sign else base
        label = "CASO BASE" if tag is None else f"{driver} {'−' if sign < 0 else '+'}Δ"
        specs = FUNNEL_SPECS + FIN_SPECS
        loc = write_block(ws, top, label, specs, ref_fn, mpa)
        r_end = top + 1 + len(specs)
        flujo = f"{L(FIRST_MONTH_COL)}{loc['flujo'][1]}:{LAST_COL}{loc['flujo'][1]}"
        acum = f"{L(FIRST_MONTH_COL)}{loc['acumulado'][1]}:{LAST_COL}{loc['acumulado'][1]}"
        ws.cell(row=r_end, column=1, value="Beneficio neto 3 años")
        c = ws.cell(row=r_end, column=3, value=f"=SUM({flujo})-{ref_fn('capex_inicial_usd')}")
        c.number_format, c.font = F_USD, BOLD
        ws.cell(row=r_end + 1, column=1, value="Payback (meses)")
        ws.cell(row=r_end + 1, column=3, value=payback_formula(acum, horizon)).font = BOLD
        results[(driver, tag)] = (f"C{r_end}", f"C{r_end + 1}")
        top = r_end + 4
    base_b, base_p = results[("base", None)]
    ws[SENS_BASE_BENEFIT_CELL.replace("C", "A")] = "Caso base (recalculado)"
    ws[SENS_BASE_BENEFIT_CELL], ws[SENS_BASE_PAYBACK_CELL] = f"={base_b}", f"={base_p}"
    ws[SENS_BASE_BENEFIT_CELL].number_format = F_USD
    ws[SENS_BASE_PAYBACK_CELL.replace("C", "A")] = "Payback caso base (meses)"
    for i, driver in enumerate(ref.DRIVERS):
        r = SENS_TABLE_TOP + i
        ws.cell(row=r, column=1, value=driver)
        ws.cell(row=r, column=2, value=names.get(driver, driver))
        c = ws.cell(row=r, column=3, value=f"={lay.ref(driver, 'base')}")
        c.number_format = "#,##0.00##"
        ws.cell(row=r, column=4, value=f"={results[(driver, 'menos')][0]}")
        ws.cell(row=r, column=5, value=f"={results[(driver, 'mas')][0]}")
        ws.cell(row=r, column=6, value=f"=D{r}-{SENS_BASE_BENEFIT_CELL}")
        ws.cell(row=r, column=7, value=f"=E{r}-{SENS_BASE_BENEFIT_CELL}")
        ws.cell(row=r, column=8, value=f"={results[(driver, 'menos')][1]}")
        ws.cell(row=r, column=9, value=f"={results[(driver, 'mas')][1]}")
        ws.cell(row=r, column=10, value=f"=ABS(E{r}-D{r})")
        for col in (4, 5, 6, 7, 10):
            ws.cell(row=r, column=col).number_format = F_USD
        for col in (8, 9):
            ws.cell(row=r, column=col).alignment = Alignment(horizontal="right")
    set_widths(ws, {"A": 62, "B": 44, "C": 14, "D": 14, "E": 14, "F": 16, "G": 16, "H": 12, "I": 12, "J": 18})
    ws.freeze_panes = "C8"


# --------------------------------------------------------------------------- hoja 5


def build_validacion(wb: Workbook, lay: Layout, data: dict) -> None:
    ws = wb.create_sheet(S_VAL)
    title(ws, "Plan de validación de supuestos",
          "Umbral de éxito: el valor observado no debe ser peor que el pesimista. Semana objetivo = semana del "
          "piloto en que se mide (entrada editable).")
    header(ws, 4, ["Id", "Supuesto", "Experimento de validación", "Métrica", "Unidad", "Valor base",
                   "Umbral de éxito (pesimista)", "Semana objetivo"])
    for i, s in enumerate(data["supuestos"]):
        r = 5 + i
        ws.cell(row=r, column=1, value=s["id"])
        ws.cell(row=r, column=2, value=s["nombre"])
        ws.cell(row=r, column=3, value=s["validacion"])
        ws.cell(row=r, column=4, value=f"Valor observado de «{s['nombre']}» frente al base")
        ws.cell(row=r, column=5, value=s["unidad"])
        fmt = F_PCT if s["unidad"].startswith("%") else "#,##0.00##"
        for col, scen in ((6, "base"), (7, "pesimista")):
            c = ws.cell(row=r, column=col, value=f"={lay.ref(s['id'], scen)}")
            c.number_format = fmt
        c = ws.cell(row=r, column=8, value=WEEK_BY_ID.get(s["id"], DEFAULT_WEEK))
        c.font, c.fill = BLUE, INPUT_FILL
        for col in (2, 3, 4):
            ws.cell(row=r, column=col).alignment = Alignment(wrap_text=True, vertical="top")
    set_widths_simple(ws, {"A": 36, "B": 40, "C": 70, "D": 44, "E": 14, "F": 12, "G": 16, "H": 12})
    ws.freeze_panes = "C5"


# --------------------------------------------------------------------------- hoja 6

BE_TOP = 5
BE_KEYS = ["conv_por_cita", "margen_por_cita", "opex_mensual", "citas_mes_equilibrio_operativo",
           "citas_mes_payback_24", "citas_mes_actuales", "brecha", "parque_mes_36",
           "parque_necesario_payback_24", "sedes_equivalentes", "lectura"]
BE_JSON = ["margen_por_cita", "citas_mes_equilibrio_operativo", "citas_mes_payback_24",
           "citas_mes_actuales", "parque_necesario_payback_24", "sedes_equivalentes"]


def breakeven_cells(scenario: str) -> dict:
    """Celdas (hoja Punto_Equilibrio) de las cifras clave del escenario (+ la frase de lectura)."""
    return {k: f"{SUMMARY_COL[scenario]}{BE_TOP + BE_KEYS.index(k)}" for k in BE_JSON + ["lectura"]}


def build_equilibrio(wb: Workbook, lay: Layout, funnel: dict) -> None:
    ws = wb.create_sheet(S_BE)
    title(ws, "Punto de equilibrio por cita incremental (USD)",
          "Régimen estable, sin rampa de adopción ni crecimiento del parque: las citas necesarias se comparan "
          "con las que el embudo atiende en el mes 36 (régimen). Payback objetivo: 24 meses (parámetro del modelo).")
    header(ws, 4, ["Métrica", "Unidad"] + [LABEL[s] for s in ref.ESCENARIOS])
    labels = {
        "conv_por_cita": ("Conversaciones por cita = 1/(respuesta × conversión × (1 − no-show))", "conv/cita", F_DEC),
        "margen_por_cita": ("Margen de contribución por cita (mant. + venta cruzada + seguros + ahorro asesor − IA y WhatsApp)", "USD/cita", F_DEC),
        "opex_mensual": ("Opex mensual total (plataforma + equipo)", "USD/mes", F_USD),
        "citas_mes_equilibrio_operativo": ("Citas incrementales/mes para flujo operativo ≥ 0", "citas/mes", F_DEC),
        "citas_mes_payback_24": ("Citas incrementales/mes para recuperar la inversión en 24 meses = (opex × 24 + capex)/(margen × 24)", "citas/mes", F_DEC),
        "citas_mes_actuales": ("Citas/mes que el embudo atiende en régimen (mes 36)", "citas/mes", F_DEC),
        "brecha": ("Brecha = necesarias (payback 24) − actuales", "citas/mes", F_DEC),
        "parque_mes_36": ("Parque activo del embudo en el mes 36", "vehículos", F_INT),
        "parque_necesario_payback_24": ("Parque activo necesario para payback en 24 meses (embudo por vehículo, escalado lineal)", "vehículos", F_INT),
        "sedes_equivalentes": ("Sedes equivalentes = parque necesario / parque activo actual", "sedes", F_DEC),
        "lectura": ("Lectura", "texto", "General"),
    }
    for i, key in enumerate(BE_KEYS):
        ws.cell(row=BE_TOP + i, column=1, value=labels[key][0]).alignment = Alignment(wrap_text=True)
        ws.cell(row=BE_TOP + i, column=2, value=labels[key][1])
    objetivo = lay.ref("payback_objetivo_meses")
    for scen in ref.ESCENARIOS:
        col = SUMMARY_COL[scen]
        R = lambda k, s=scen: lay.ref(k, s)
        c = lambda k: f"{col}{BE_TOP + BE_KEYS.index(k)}"
        loc = funnel[scen]
        f = {
            "conv_por_cita": f"=1/({R('tasa_respuesta_contacto')}*{R('conversion_agendamiento')}*(1-{R('tasa_no_show')}))",
            "margen_por_cita": (
                f"={R('ticket_promedio_taller_usd')}*{R('margen_bruto_taller')}"
                f"+{R('attach_venta_cruzada_desgaste')}*{R('ticket_venta_cruzada_usd')}*{R('margen_venta_cruzada')}"
                f"+{R('conversion_seguros')}*{R('comision_seguro_usd')}"
                f"+{R('horas_asesor_ahorradas_por_cita')}*{R('costo_hora_asesor_usd')}"
                f"-{c('conv_por_cita')}*({R('costo_ia_por_conversacion_usd')}+{R('costo_whatsapp_por_conversacion_usd')})"),
            "opex_mensual": f"={R('opex_plataforma_mensual_usd')}+{R('opex_equipo_mensual_usd')}",
            "citas_mes_equilibrio_operativo": f"={c('opex_mensual')}/{c('margen_por_cita')}",
            "citas_mes_payback_24": f"=({c('opex_mensual')}*{objetivo}+{R('capex_inicial_usd')})/({c('margen_por_cita')}*{objetivo})",
            "citas_mes_actuales": f"={S_FUN}!{LAST_COL}{loc['atendidos'][1]}",
            "brecha": f"={c('citas_mes_payback_24')}-{c('citas_mes_actuales')}",
            "parque_mes_36": f"={S_FUN}!{LAST_COL}{loc['parque'][1]}",
            "parque_necesario_payback_24": f"={c('citas_mes_payback_24')}/({c('citas_mes_actuales')}/{c('parque_mes_36')})",
            "sedes_equivalentes": f"={c('parque_necesario_payback_24')}/{R('parque_activo_vehiculos')}",
            "lectura": (f'=IF({c("brecha")}<=0,"Se paga en <= 24 meses",'
                        f'"Faltan "&ROUND({c("brecha")},0)&" citas/mes")'),
        }
        for key, formula in f.items():
            cell = ws[c(key)]
            cell.value, cell.number_format = formula, labels[key][2]
            cell.alignment = Alignment(horizontal="right")
            if key in BE_JSON:
                cell.font = BOLD
    ws.cell(row=BE_TOP + len(BE_KEYS) + 1, column=1, value=(
        "Nota: «citas incrementales» = citas que sin el agente no ocurrirían. Cálculo en régimen estable: no "
        "incluye la rampa de adopción (el payback real del flujo mensual es más lento). El parque necesario "
        "escala linealmente el embudo por vehículo del mes 36 y no re-aplica el tope de capacidad de bahías.")
        ).alignment = Alignment(wrap_text=True, vertical="top")
    set_widths_simple(ws, {"A": 80, "B": 12, "C": 24, "D": 24, "E": 24})
    ws.freeze_panes = "C5"


# --------------------------------------------------------------------------- orquestación


def build_workbook(data: dict) -> Workbook:
    missing = [k for k in REQUIRED_IDS if k not in {s["id"] for s in data["supuestos"]}]
    if missing:
        raise KeyError(f"Faltan supuestos en assumptions.json: {missing}")
    wb = Workbook()
    lay = build_supuestos(wb, data)
    funnel = build_funnel(wb, lay)
    build_caso(wb, lay, funnel)
    build_sensibilidad(wb, lay, data)
    build_validacion(wb, lay, data)
    build_equilibrio(wb, lay, funnel)
    wb.calculation.fullCalcOnLoad = True
    return wb


REQUIRED_IDS = [
    "parque_activo_vehiculos", "pct_parque_segmento_2a5", "crecimiento_parque_anual",
    "retencion_taller_actual", "retencion_taller_meta_a3", "visitas_taller_por_vehiculo_anio",
    "tasa_opt_in", "tasa_respuesta_contacto", "conversion_agendamiento", "tasa_no_show", "meses_rampa",
    "ticket_promedio_taller_usd", "margen_bruto_taller", "attach_venta_cruzada_desgaste",
    "ticket_venta_cruzada_usd", "margen_venta_cruzada", "conversion_seguros", "comision_seguro_usd",
    "bahias_taller", "servicios_por_bahia_dia", "dias_operacion_mes", "ocupacion_actual",
    "costo_ia_por_conversacion_usd", "costo_whatsapp_por_conversacion_usd",
    "opex_plataforma_mensual_usd", "opex_equipo_mensual_usd", "horas_asesor_ahorradas_por_cita",
    "costo_hora_asesor_usd", "capex_inicial_usd", "tasa_descuento_anual",
]


def write_summary(data: dict, path: Path = OUT_JSON) -> dict:
    summary = {
        "version_supuestos": data["version"],
        "fecha": dt.date.today().isoformat(),
        "moneda": data["moneda"],
        "escenarios": {s: {**r, **{k: ref.breakeven(ref.scenario_params(data, s))[k] for k in BE_JSON}}
                       for s, r in ref.run_all(data).items()},
    }
    path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return summary


def main() -> None:
    data = load_assumptions()
    OUT_XLSX.parent.mkdir(parents=True, exist_ok=True)
    build_workbook(data).save(OUT_XLSX)
    summary = write_summary(data)
    print(f"Escrito {OUT_XLSX}")
    print(f"Escrito {OUT_JSON}: {json.dumps(summary['escenarios'], ensure_ascii=False)}")


if __name__ == "__main__":
    main()
