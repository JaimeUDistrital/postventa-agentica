"""Fixtures compartidas: el libro se genera y se evalúa UNA vez por sesión de tests."""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import generate_financial_model as gfm  # noqa: E402


@pytest.fixture(scope="session")
def xlsx_path(tmp_path_factory) -> Path:
    path = tmp_path_factory.mktemp("xlsx") / "modelo.xlsx"
    gfm.build_workbook(gfm.load_assumptions()).save(path)
    return path


@pytest.fixture(scope="session")
def evaluated(xlsx_path):
    """Devuelve una función (hoja, celda) -> valor, con el libro evaluado por `formulas`."""
    import formulas

    solution = formulas.ExcelModel().loads(str(xlsx_path)).finish().calculate()
    prefix = f"[{xlsx_path.name}]"

    def get(sheet: str, cell: str):
        value = solution[f"'{prefix}{sheet.upper()}'!{cell}"].value[0, 0]
        return value.item() if hasattr(value, "item") else value

    def all_values():
        return solution

    get.all_values = all_values
    return get
