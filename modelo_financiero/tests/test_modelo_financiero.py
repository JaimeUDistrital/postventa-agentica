import json
import math

import openpyxl
import pytest

import generate_financial_model as gfm
import reference_model as ref

SHEETS = [
    "Supuestos_y_Fuentes",
    "Funnel_y_Operacion_3Y",
    "Caso_Negocio_Escenarios",
    "Sensibilidad",
    "Plan_Validacion",
    "Punto_Equilibrio",
]
ERRORS = ("#REF!", "#NAME?", "#DIV/0!", "#VALUE!", "#N/A", "#NUM!")
SCENARIOS = ("pesimista", "base", "optimista")


@pytest.fixture(scope="module")
def reference():
    return ref.run_all(gfm.load_assumptions())


def test_a_hojas_y_numero_de_formulas(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path)
    assert wb.sheetnames == SHEETS
    formulas_count = sum(
        1
        for ws in wb
        for row in ws.iter_rows()
        for c in row
        if isinstance(c.value, str) and c.value.startswith("=")
    )
    assert formulas_count >= 300
    assert wb.calculation.fullCalcOnLoad is True


def test_b_sin_errores_al_evaluar(evaluated):
    bad = []
    for key, rng in evaluated.all_values().items():
        for v in rng.value.ravel():
            if isinstance(v, str) and v.startswith(ERRORS):
                bad.append((key, v))
            if hasattr(v, "item") and isinstance(v.item(), float) and math.isnan(v.item()):
                bad.append((key, "nan"))
    assert not bad, bad[:10]


@pytest.mark.parametrize("scenario", SCENARIOS)
def test_c_cifras_clave_igual_a_referencia(evaluated, reference, scenario):
    for metric, cell in gfm.summary_cells(scenario).items():
        got = evaluated("Caso_Negocio_Escenarios", cell)
        want = reference[scenario][metric]
        if metric == "payback_meses":
            want = want if want is not None else "> 36"
            assert got == want, (metric, got, want)
        else:
            assert got == pytest.approx(want, rel=0.005, abs=1.0), (metric, got, want)


def test_d_payback_ordenado(evaluated):
    def months(scenario):
        v = evaluated("Caso_Negocio_Escenarios", gfm.summary_cells(scenario)["payback_meses"])
        return 37 if v == "> 36" else v

    p, b, o = (months(s) for s in SCENARIOS)
    assert p >= b >= o
    if 37 not in (p, b, o):
        assert p > b > o


def test_e_summary_json(reference):
    path = gfm.OUT_JSON
    assert path.exists()
    data = json.loads(path.read_text())
    assert data["version_supuestos"] == gfm.load_assumptions()["version"]
    assert data["fecha"]
    for s in SCENARIOS:
        for metric in ("ingresos_3y", "beneficio_3y", "inversion", "payback_meses", "roi_3y", "vpn"):
            assert metric in data["escenarios"][s]
            assert data["escenarios"][s][metric] == pytest.approx(reference[s][metric]) \
                or data["escenarios"][s][metric] is reference[s][metric]


def test_sensibilidad_caso_base_igual_a_escenario_base(evaluated, reference):
    got = evaluated("Sensibilidad", gfm.SENS_BASE_BENEFIT_CELL)
    assert got == pytest.approx(reference["base"]["beneficio_3y"], rel=0.005, abs=1.0)
    sens = ref.sensitivity(gfm.load_assumptions())
    for driver, row in gfm.sens_result_cells().items():
        for i, key in enumerate(("beneficio_menos", "beneficio_mas")):
            got = evaluated("Sensibilidad", row[i])
            assert got == pytest.approx(sens[driver][key], rel=0.005, abs=1.0)


BE_KEYS = ("margen_por_cita", "citas_mes_equilibrio_operativo", "citas_mes_payback_24",
           "citas_mes_actuales", "parque_necesario_payback_24", "sedes_equivalentes")


@pytest.mark.parametrize("scenario", SCENARIOS)
def test_f_punto_equilibrio_igual_a_referencia(evaluated, scenario):
    want = ref.breakeven(ref.scenario_params(gfm.load_assumptions(), scenario))
    for key, cell in gfm.breakeven_cells(scenario).items():
        got = evaluated("Punto_Equilibrio", cell)
        if key == "lectura":
            assert isinstance(got, str) and got
            continue
        assert got == pytest.approx(want[key], rel=0.005, abs=1e-6), (key, got, want[key])


@pytest.mark.parametrize("scenario", SCENARIOS)
def test_g_punto_equilibrio_coherencia(scenario):
    b = ref.breakeven(ref.scenario_params(gfm.load_assumptions(), scenario))
    assert b["margen_por_cita"] > 0
    assert b["citas_mes_payback_24"] >= b["citas_mes_equilibrio_operativo"]
    assert b["sedes_equivalentes"] > 0


def test_h_summary_json_punto_equilibrio():
    data = json.loads(gfm.OUT_JSON.read_text())
    for s in SCENARIOS:
        want = ref.breakeven(ref.scenario_params(gfm.load_assumptions(), s))
        for k in BE_KEYS:
            assert data["escenarios"][s][k] == pytest.approx(want[k], rel=0.005)
