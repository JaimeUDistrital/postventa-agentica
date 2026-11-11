"""Referencia en Python puro del modelo financiero (misma lógica que las fórmulas del Excel).

Sirve para (a) generar financial_summary.json y (b) verificar el libro evaluado.
Cada mes t = 1..HORIZONTE_MESES; un escenario = un valor (pesimista/base/optimista) por supuesto.
"""

ESCENARIOS = ("pesimista", "base", "optimista")

# Parámetros estructurales del modelo (el Excel los escribe como celdas de entrada).
MODEL_PARAMS = {
    "horizonte_meses": 36,
    "meses_por_anio": 12,
    "delta_sensibilidad": 0.20,
    "payback_objetivo_meses": 24,
}

# Drivers de la sensibilidad (id de supuesto): los de mayor efecto sobre el beneficio.
DRIVERS = (
    "conversion_agendamiento",
    "ticket_promedio_taller_usd",
    "margen_bruto_taller",
    "tasa_opt_in",
    "tasa_respuesta_contacto",
    "retencion_taller_actual",
)


def scenario_params(assumptions: dict, scenario: str) -> dict:
    return {s["id"]: s[scenario] for s in assumptions["supuestos"]}


def monthly_rate(annual: float) -> float:
    return (1 + annual) ** (1 / MODEL_PARAMS["meses_por_anio"]) - 1


def simulate(p: dict) -> dict:
    """Devuelve series mensuales (listas) y el resumen del escenario."""
    n, mpa = MODEL_PARAMS["horizonte_meses"], MODEL_PARAMS["meses_por_anio"]
    capacidad_libre = (
        p["bahias_taller"] * p["servicios_por_bahia_dia"] * p["dias_operacion_mes"]
        * (1 - p["ocupacion_actual"])
    )
    series = {k: [] for k in (
        "atendidos", "contactados", "ingresos", "margen", "ahorro", "costos", "flujo", "acumulado")}
    acumulado = -p["capex_inicial_usd"]
    for t in range(1, n + 1):
        rampa = min(1, t / p["meses_rampa"])
        parque = p["parque_activo_vehiculos"] * (1 + p["crecimiento_parque_anual"]) ** (t / mpa)
        elegibles = parque * p["pct_parque_segmento_2a5"]
        optin = elegibles * p["tasa_opt_in"] * rampa
        servicios_mes = p["visitas_taller_por_vehiculo_anio"] / mpa
        contactados = optin * servicios_mes * (1 - p["retencion_taller_actual"])
        demanda = (contactados * p["tasa_respuesta_contacto"] * p["conversion_agendamiento"]
                   * (1 - p["tasa_no_show"]))
        tope_retencion = elegibles * servicios_mes * (
            p["retencion_taller_meta_a3"] - p["retencion_taller_actual"])
        atendidos = min(demanda, tope_retencion, capacidad_libre)

        ing_mant = atendidos * p["ticket_promedio_taller_usd"]
        ing_vc = atendidos * p["attach_venta_cruzada_desgaste"] * p["ticket_venta_cruzada_usd"]
        ing_seg = atendidos * p["conversion_seguros"] * p["comision_seguro_usd"]
        margen = (ing_mant * p["margen_bruto_taller"] + ing_vc * p["margen_venta_cruzada"] + ing_seg)
        ahorro = atendidos * p["horas_asesor_ahorradas_por_cita"] * p["costo_hora_asesor_usd"]
        costos = (contactados * (p["costo_ia_por_conversacion_usd"]
                                 + p["costo_whatsapp_por_conversacion_usd"])
                  + p["opex_plataforma_mensual_usd"] + p["opex_equipo_mensual_usd"])
        flujo = margen + ahorro - costos
        acumulado += flujo
        for k, v in zip(series, (atendidos, contactados, ing_mant + ing_vc + ing_seg,
                                 margen, ahorro, costos, flujo, acumulado)):
            series[k].append(v)

    capex = p["capex_inicial_usd"]
    negativos = sum(1 for a in series["acumulado"] if a < 0)
    tasa_m = monthly_rate(p["tasa_descuento_anual"])
    vpn = sum(f / (1 + tasa_m) ** (i + 1) for i, f in enumerate(series["flujo"])) - capex
    beneficio = sum(series["flujo"]) - capex
    series["resumen"] = {
        "ingresos_3y": sum(series["ingresos"]),
        "beneficio_3y": beneficio,
        "inversion": capex,
        "payback_meses": None if negativos >= n else negativos + 1,
        "roi_3y": beneficio / capex,
        "vpn": vpn,
    }
    return series


def run_all(assumptions: dict) -> dict:
    return {s: simulate(scenario_params(assumptions, s))["resumen"] for s in ESCENARIOS}


def sensitivity(assumptions: dict) -> dict:
    """±delta sobre cada driver del escenario base -> beneficio a 3 años y payback."""
    base = scenario_params(assumptions, "base")
    delta = MODEL_PARAMS["delta_sensibilidad"]
    out = {}
    for driver in DRIVERS:
        row = {}
        for key, sign in (("menos", -1), ("mas", 1)):
            res = simulate({**base, driver: base[driver] * (1 + sign * delta)})["resumen"]
            row[f"beneficio_{key}"] = res["beneficio_3y"]
            row[f"payback_{key}"] = res["payback_meses"]
        out[driver] = row
    return out


def breakeven(p: dict) -> dict:
    """Punto de equilibrio en régimen estable (sin rampa) por cita incremental."""
    conv_por_cita = 1 / (p["tasa_respuesta_contacto"] * p["conversion_agendamiento"]
                         * (1 - p["tasa_no_show"]))
    margen = (p["ticket_promedio_taller_usd"] * p["margen_bruto_taller"]
              + p["attach_venta_cruzada_desgaste"] * p["ticket_venta_cruzada_usd"]
              * p["margen_venta_cruzada"]
              + p["conversion_seguros"] * p["comision_seguro_usd"]
              + p["horas_asesor_ahorradas_por_cita"] * p["costo_hora_asesor_usd"]
              - conv_por_cita * (p["costo_ia_por_conversacion_usd"]
                                 + p["costo_whatsapp_por_conversacion_usd"]))
    opex = p["opex_plataforma_mensual_usd"] + p["opex_equipo_mensual_usd"]
    k = MODEL_PARAMS["payback_objetivo_meses"]
    n = MODEL_PARAMS["horizonte_meses"]
    sim = simulate(p)
    actuales = sim["atendidos"][-1]
    parque_n = p["parque_activo_vehiculos"] * (
        1 + p["crecimiento_parque_anual"]) ** (n / MODEL_PARAMS["meses_por_anio"])
    payback = (opex * k + p["capex_inicial_usd"]) / (margen * k)
    parque_nec = payback / (actuales / parque_n)
    return {
        "margen_por_cita": margen,
        "citas_mes_equilibrio_operativo": opex / margen,
        "citas_mes_payback_24": payback,
        "citas_mes_actuales": actuales,
        "brecha_citas_mes": payback - actuales,
        "parque_necesario_payback_24": parque_nec,
        "sedes_equivalentes": parque_nec / p["parque_activo_vehiculos"],
    }
