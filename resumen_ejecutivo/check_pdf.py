"""Comprueba que inversion, VPN, payback (y beneficio) de los 3 escenarios estan en el PDF, con el formato de la plantilla."""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_pdf as b

R, _, _, _ = b.cargar()
texto = subprocess.run(["pdftotext", "-layout", str(b.SALIDA), "-"], capture_output=True, text=True, check=True).stdout
plano = " ".join(texto.split())
faltan = []
for k in b.ESC:
    s = R["escenarios"][k]
    for campo, val in (("inversion", b.usd(s["inversion"])), ("vpn", b.usd(s["vpn"])),
                       ("beneficio_3y", b.usd(s["beneficio_3y"])), ("payback", b.payback(s["payback_meses"])),
                       ("roi", b.roi(s["roi_3y"]))):
        if val not in plano:
            faltan.append((k, campo, val))
# payback por fila de tabla (evita falsos positivos con un "4" suelto)
fila = next((l for l in texto.splitlines() if "Payback" in l), "")
for k in b.ESC:
    pb = b.payback(R["escenarios"][k]["payback_meses"])
    if pb not in fila:
        faltan.append((k, "payback_en_fila", pb))
if faltan:
    print("FALTAN:", faltan)
    sys.exit(1)
print("OK: inversion, VPN, beneficio, payback y ROI de los 3 escenarios presentes (formato plantilla)")
