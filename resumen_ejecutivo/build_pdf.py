"""T13 - Resumen ejecutivo (PDF Carta, <= 2 paginas).
Todas las cifras salen de entregables/financial_summary.json y data/assumptions.json.
Uso: uv run --project modelo_financiero python resumen_ejecutivo/build_pdf.py
"""
import json
import re
from html import escape
from pathlib import Path
from string import Template

RAIZ = Path(__file__).resolve().parent.parent
SUMMARY = RAIZ / "entregables" / "financial_summary.json"
ASSUME = RAIZ / "data" / "assumptions.json"
META = Path(__file__).resolve().parent / "meta.json"
SALIDA = RAIZ / "entregables" / "RESUMEN_EJECUTIVO_COMITE.pdf"
ESC = ("pesimista", "base", "optimista")
NOMBRE = {"pesimista": "Pesimista", "base": "Base", "optimista": "Optimista"}


# ---------- formato (lo reutiliza check_pdf.py) ----------
def _miles(x, dec=0):
    s = f"{abs(x):,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("−" if round(x, dec) < 0 else "") + s


def usd(x):
    return _miles(x)


def num1(x):
    return _miles(x, 1)


def pct0(x):
    return _miles(x * 100) + " %"


def roi(x):
    return _miles(x * 100) + " %"


def payback(m):
    return "> 36" if m is None else str(int(m))


def usd3(x):
    return _miles(x, 3)


def e(x):
    return escape(str(x), quote=True)


def cargar():
    resumen = json.loads(SUMMARY.read_text(encoding="utf-8"))
    sup = json.loads(ASSUME.read_text(encoding="utf-8"))
    A = {s["id"]: s for s in sup["supuestos"]}
    meta = json.loads(META.read_text(encoding="utf-8"))
    return resumen, sup, A, meta


def grafico_vpn(S):
    """SVG en linea: VPN por escenario. Gris + etiqueta directa: legible en B/N."""
    W, H = 235, 150
    x0, x1 = 52, 228
    vals = [S[k]["vpn"] for k in ESC]
    vmax, vmin = max(vals + [0]), min(vals + [0])
    top, bot = 22, 112
    sc = (bot - top) / (vmax - vmin)
    y0 = top + vmax * sc
    fills = {"pesimista": "#ffffff", "base": "#b5b5b5", "optimista": "#4a4a4a"}
    bw, gap = 48, 10
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}pt" height="{H}pt" viewBox="0 0 {W} {H}" role="img" aria-label="VPN a 3 años por escenario">']
    out.append(f'<text x="2" y="11" font-size="11.5" font-weight="bold" font-family="Liberation Sans">VPN a 3 años (USD)</text>')
    out.append(f'<line x1="{x0-6}" y1="{y0:.1f}" x2="{x1}" y2="{y0:.1f}" stroke="#000" stroke-width="1"/>')
    for i, k in enumerate(ESC):
        v = S[k]["vpn"]
        x = x0 + i * (bw + gap)
        h = abs(v) * sc
        y = y0 - h if v >= 0 else y0
        out.append(f'<rect x="{x}" y="{y:.1f}" width="{bw}" height="{max(h,1):.1f}" fill="{fills[k]}" stroke="#000" stroke-width="1"/>')
        ly = y - 3 if v >= 0 else y + h + 11
        out.append(f'<text x="{x+bw/2}" y="{ly:.1f}" font-size="11.5" font-weight="bold" text-anchor="middle" font-family="Liberation Sans">{e(usd(v))}</text>')
        out.append(f'<text x="{x+bw/2}" y="{H-14}" font-size="11.5" text-anchor="middle" font-family="Liberation Sans">{NOMBRE[k]}</text>')
    out.append(f'<text x="2" y="{y0-3:.1f}" font-size="11.5" font-family="Liberation Sans">0</text>')
    out.append("</svg>")
    return "".join(out)


def tabla_negocio(S):
    filas = [
        ("Inversión inicial (USD)", lambda s: usd(s["inversion"])),
        ("Beneficio neto 3 años (USD)", lambda s: usd(s["beneficio_3y"])),
        ("VPN a 3 años (USD)", lambda s: usd(s["vpn"])),
        ("Payback (meses)", lambda s: payback(s["payback_meses"])),
        ("ROI a 3 años", lambda s: roi(s["roi_3y"])),
    ]
    h = "<table class='t'><tr><th style='width:38%'></th>" + "".join(f"<th>{NOMBRE[k]}</th>" for k in ESC) + "</tr>"
    for nom, f in filas:
        h += f"<tr><td>{e(nom)}</td>" + "".join(f"<td class='n'>{e(f(S[k]))}</td>" for k in ESC) + "</tr>"
    return h + "</table><p class='peq'>\u00ab> 36\u00bb = no recupera la inversi\u00f3n en 36 meses.</p>"


def construir():
    R, SUP, A, meta = cargar()
    S = R["escenarios"]
    b = S["base"]
    asum = lambda i, k="base": A[i][k]

    # Cifras de mercado citadas (F04), extraidas del texto de las fuentes: si cambian, falla.
    f04 = next(f for f in SUP["fuentes"] if f["id"] == "F04")
    perdida = re.search(r"Lost (\d+)%", f04["titulo"]).group(1)
    nota = A["retencion_taller_actual"]["nota"]
    vuelve = re.search(r"solo el (\d+) %", nota).group(1)
    antes = re.search(r"\((\d+) % en 2023\)", nota).group(1)

    seg = asum("parque_activo_vehiculos") * asum("pct_parque_segmento_2a5")
    ret_a, ret_m = asum("retencion_taller_actual"), asum("retencion_taller_meta_a3")
    ia = {k: asum("costo_ia_por_conversacion_usd", k) for k in ESC}
    wa = {k: asum("costo_whatsapp_por_conversacion_usd", k) for k in ESC}
    p = lambda i: pct0(asum(i, "pesimista"))

    ok_op = b["citas_mes_actuales"] >= b["citas_mes_equilibrio_operativo"]
    lectura = (
        f"En el base el embudo genera <b>{num1(b['citas_mes_actuales'])} citas/mes</b> en régimen (mes 36) frente a "
        f"<b>{num1(b['citas_mes_equilibrio_operativo'])}</b> de equilibrio operativo: "
        + ("cubre su costo mensual, pero con poco margen. " if ok_op else "no cubre su costo mensual. ")
        + f"Recuperar la inversión en 24 meses exige <b>{num1(b['citas_mes_payback_24'])} citas/mes</b>, "
        f"equivalente a <b>{num1(b['sedes_equivalentes'])} sedes</b> como la modelada. "
        "<b>Conclusión: el caso base no se paga solo en 36 meses; el éxito depende de que la retención y la conversión "
        "reales se acerquen al escenario optimista, y hoy no están medidas.</b> "
        f"Optimista: equilibrio en {num1(S['optimista']['citas_mes_equilibrio_operativo'])} citas/mes frente a "
        f"{num1(S['optimista']['citas_mes_actuales'])} generadas. "
        f"Pesimista: {num1(S['pesimista']['citas_mes_equilibrio_operativo'])} frente a {num1(S['pesimista']['citas_mes_actuales'])}."
    )

    v = dict(
        css_font="Liberation Sans, DejaVu Sans, sans-serif",
        perdida=e(perdida), vuelve=e(vuelve), antes=e(antes),
        ret_a=e(pct0(ret_a)), ret_m=e(pct0(ret_m)),
        seg=e(_miles(seg)), parque=e(_miles(asum("parque_activo_vehiculos"))), pct_seg=e(pct0(asum("pct_parque_segmento_2a5"))),
        tabla=tabla_negocio(S), grafico=grafico_vpn(S), lectura=lectura,
        ia_p=e(usd3(ia["pesimista"])), ia_b=e(usd3(ia["base"])), ia_o=e(usd3(ia["optimista"])),
        wa_b=e(usd3(wa["base"])),
        g_optin=e(p("tasa_opt_in")), g_resp=e(p("tasa_respuesta_contacto")), g_conv=e(p("conversion_agendamiento")),
        g_ret=e(p("retencion_taller_meta_a3")), g_nos=e(p("tasa_no_show").replace(" %", "")),
        g_nos_v=e(pct0(asum("tasa_no_show", "pesimista"))),
        tope=e(pct0(asum("tope_descuento_pct"))), maxc=e(_miles(asum("max_contactos_30_dias"))), hold=e(_miles(asum("hold_reserva_minutos"))),
        tope_r=e(_miles(A["tope_descuento_pct"]["base"] * 100)),
        vers=e(R["version_supuestos"]), fecha=e(R["fecha"]), trm=e(_miles(asum("trm_cop_usd"))),
        url_demo=e(meta["url_demo"]), url_repo=e(meta["url_repo"]),
        mesesr=e(_miles(asum("meses_rampa"))),
    )
    return Template(PLANTILLA).substitute(v)


PLANTILLA = """<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen ejecutivo - Postventa agéntica</title>
<style>
@page { size: Letter; margin: 0.42in 0.5in 0.42in 0.5in; @bottom-center { content: "Postventa agéntica · Resumen para el comité · pág. " counter(page) " de " counter(pages); font: 8.5pt $css_font; color:#333 } }
* { box-sizing: border-box; }
body { font: 8.6pt/1.28 $css_font; color:#111; margin:0; }
h1 { font-size: 15pt; margin:0 0 1pt 0; }
.sub { font-size: 8.6pt; color:#333; margin-bottom:4pt; border-bottom:1.2pt solid #000; padding-bottom:3pt; }
h2 { font-size: 10pt; margin:5pt 0 1.5pt 0; border-bottom:0.6pt solid #666; padding-bottom:0.5pt; }
p { margin:0 0 2.5pt 0; } ul { margin:0 0 2pt 0; padding-left:11pt; } li { margin:0 0 1pt 0; }
.pg { page-break-after: always; } .fin { page-break-inside: avoid; }
table.t { border-collapse: collapse; width:100%; margin:2pt 0 3pt 0; }
table.t th, table.t td { border:0.5pt solid #555; padding:1.2pt 3pt; text-align:left; font-size:8.6pt; }
table.t th { background:#ddd; } td.n { text-align:right; font-variant-numeric: tabular-nums; }
table.t td.c { text-align:left; }
.dos { display:flex; gap:8pt; } .dos > div { flex:1; }
.caja { border:1pt solid #000; padding:3pt 5pt; margin:3pt 0; background:#f1f1f1; }
.peq { font-size:8.5pt; color:#222; }
</style></head><body>

<div class="pg">
<h1>Postventa agéntica: retener al cliente después de la garantía</h1>
<div class="sub">Agencia automotriz multimarca (caso ficticio) · Colombia · Resumen para el comité directivo · Supuestos v$vers ($fecha) · USD</div>

<h2>1. Problema</h2>
<p>La agencia pierde al cliente cuando se acaba la garantía: mantenimiento, seguros y recompra se van a talleres de barrio y aseguradoras externas, y las bahías quedan vacías entre semana. La postventa es <b>reactiva</b> (espera a que el auto falle) y la comunicación es spam genérico, sin kilometraje ni momento de vida.
Referencia externa (EE. UU., no Colombia): los concesionarios perdieron $perdida % de sus visitas de servicio frente a la competencia desde 2018 y solo $vuelve % de los dueños de autos de hasta 2 años vuelve al concesionario que se lo vendió ($antes % en 2023) (Cox Automotive, F04).
En Colombia <b>no hay dato público de retención</b>: usamos $ret_a como retención actual del segmento (cifra del brief, sin medir) y es la primera cosa que hay que validar.</p>

<h2>2. Usuarios priorizados y segmento</h2>
<ol style="margin:0 0 2pt 0;padding-left:13pt">
<li><b>Propietario</b> del segmento: quiere aviso solo cuando su auto lo necesita, precio claro y reserva en un clic.</li>
<li><b>Asesor de servicio</b>: deja de responder lo repetitivo; recibe citas confirmadas y casos con contexto.</li>
<li><b>Jefe de taller</b>: llenar bahías en valle sin saturarlas.</li>
<li><b>Comité directivo</b> (decide y paga): retención y margen medibles a 3 años.</li>
</ol>
<p><b>Segmento de entrada:</b> vehículos de <b>2 a 5 años</b> (20.000–60.000 km), justo cuando salen de la garantía inicial y el cliente se va por precio o desconfianza. Con el parque modelado ($parque vehículos, $pct_seg en ese rango) son unos <b>$seg vehículos</b> (supuesto propio, a validar con el DMS).</p>

<h2>3. Ecosistema y journey: qué primero y por qué</h2>
<p><b>Ciclo:</b> entrega → garantía (años 0–2) → <b>años 2–5 (MVP)</b> → renovación y recompra (años 4–5). <b>Canales:</b> WhatsApp Business, web/app y asesor. <b>Aliados:</b> aseguradoras, llantas y baterías, financiera. <b>Sistemas:</b> CRM, inventario de repuestos, agenda de bahías y tarifario.</p>
<ol style="margin:0 0 2pt 0;padding-left:13pt">
<li><b>Primero: mantenimiento preventivo por kilometraje</b> (con cotización cerrada, stock verificado y bahía reservada). Es el punto de mayor fuga, su disparador (km estimado e historial) es el dato más fiable y llena bahías de forma recurrente.</li>
<li><b>Segundo: paquete de desgaste en la misma visita</b> (frenos, llantas, batería): casi no cuesta captarlo si el cliente ya viene.</li>
<li><b>Después:</b> SOAT y póliza (dependen de integraciones con aseguradoras), garantía (riesgo legal: el agente solo escala) y recompra (falta historial).</li>
</ol>

<h2>4. Solución agéntica</h2>
<table class="t">
<tr><th style="width:17%">Agente</th><th style="width:43%">Qué hace</th><th>Autonomía</th></tr>
<tr><td><b>Proactivo</b></td><td>Detecta el vehículo cerca de su hito de km y propone el contacto.</td><td>Informa; solo contacta con consentimiento.</td></tr>
<tr><td><b>Postventa</b></td><td>Conversa por WhatsApp: precio del tarifario, stock, reserva de bahía, apartado de repuesto.</td><td>Informa y recomienda; <b>ejecuta la reserva solo con confirmación explícita</b> del cliente.</td></tr>
<tr><td><b>Guardián</b></td><td>Revisa antes y después de cada turno: inyección de instrucciones, fraude, PII, síntomas críticos, precios.</td><td>Determinista, sin LLM; el LLM no puede anularlo.</td></tr>
<tr><td><b>Copiloto</b></td><td>Resume el caso para el asesor humano y sugiere el siguiente paso.</td><td>Solo resume; no habla con el cliente.</td></tr>
</table>
<p><b>Límites y controles:</b> opt-in obligatorio (Ley 1581 de 2012) y máximo $maxc contacto cada 30 días; descuento automático tope $tope; reserva con hold de $hold min y clave de idempotencia (no se duplica); datos personales (PII) enmascarados antes del modelo y de la traza; <b>handoff</b> (traspaso) a un asesor humano, con todo el contexto, ante falla mecánica grave, garantía, falta de stock, cliente molesto o intento de manipulación. Cada paso deja una traza auditable.</p>
<p class="peq"><b>Demo:</b> $url_demo · <b>Código:</b> $url_repo</p>
</div>

<div class="fin">
<h1>Caso de negocio y decisión solicitada</h1>
<div class="sub">3 escenarios a 36 meses (ene-2027 a dic-2029) · USD (TRM base $trm COP/USD) · cifras del modelo financiero, supuestos v$vers</div>

<div class="dos">
<div style="flex:1.45">$tabla</div>
<div style="flex:0 0 235pt;padding-top:1pt">$grafico</div>
</div>

<h2>Lectura honesta del punto de equilibrio</h2>
<div class="caja">$lectura</div>

<h2>Costo de IA por conversación</h2>
<p>Modelo de lenguaje: USD $ia_o (optimista) / <b>$ia_b (base)</b> / $ia_p (pesimista) por conversación, más USD $wa_b de WhatsApp en el base (precios de lista de Google y Meta; tokens por conversación supuestos, a medir en el piloto). Es un costo marginal pequeño frente a la inversión; lo que decide el caso es la retención y la conversión, no la IA.</p>

<h2>Recomendación</h2>
<p><b>Piloto acotado en 1 sede, 6 meses, con compuertas de go/no-go medibles.</b> No escalar a varias sedes salvo que se validen conversión y retención con datos propios. Con lo conocido hoy, aprobar el despliegue completo sería apostar sobre supuestos sin medir.</p>

<div class="dos">
<div>
<h2>Roadmap de 6 meses y compuertas</h2>
<ul>
<li><b>Mes 1:</b> línea base en el DMS (retención real, ticket, margen) + campaña de autorización. <b>Compuerta 1:</b> opt-in ≥ $g_optin y retención real consistente con el modelo; si no, recalcular o parar.</li>
<li><b>Meses 2–3:</b> integrar un sistema a la vez (CRM, luego taller) y afinar el agente con evals.</li>
<li><b>Meses 3–5:</b> piloto con grupo de control. <b>Compuerta 2:</b> respuesta ≥ $g_resp, respuesta→cita ≥ $g_conv, no-show ≤ $g_nos_v.</li>
<li><b>Mes 6:</b> <b>Compuerta 3:</b> la retención del grupo atendido avanza hacia la meta mínima de $g_ret (hoy $ret_a) y el margen por cita cubre el equilibrio operativo. Si pasa, propuesta de escalado; si no, se cierra.</li>
</ul>
<p class="peq">Umbrales = valor del escenario pesimista de cada supuesto.</p>
</div>
<div>
<h2>KPIs, equipo y riesgos</h2>
<ul>
<li><b>KPIs:</b> opt-in, respuesta, conversión a reserva, no-show, ocupación de bahías en valle, margen incremental por visita, costo de IA por conversación, retención en taller, precio distinto del tarifario (meta 0).</li>
<li><b>Asesores:</b> dejan lo repetitivo; reciben citas confirmadas y casos con contexto (garantías, síntomas de seguridad, falta de stock); revisión semanal de trazas.</li>
<li><b>Riesgos:</b> supuestos sin medir (retención, respuesta); consentimiento y datos personales; precios o promesas inventadas por el LLM (el Guardián valida contra tarifario); integración real más difícil que la simulada; adopción del asesor.</li>
</ul>
</div>
</div>

<div class="caja"><b>Decisión solicitada al comité:</b> aprobar el piloto de 6 meses en 1 sede con las 3 compuertas anteriores y reservar la decisión de escalar hasta la compuerta 3. El costo del piloto no está calculado en el modelo; se acota al mínimo del equipo y la integración con CRM y taller, y se define con el comité.</div>
<p class="peq"><b>Declaración de uso de IA:</b> esta solución y este documento se construyeron con asistentes de IA bajo supervisión humana; las cifras tienen fuente o son supuestos declarados (ver <i>FUENTES_MERCADO.md</i> y el modelo financiero). La agencia y los datos del prototipo son ficticios.</p>
</div>
</body></html>"""


if __name__ == "__main__":
    from weasyprint import HTML

    html = construir()
    (Path(__file__).resolve().parent / "resumen.html").write_text(html, encoding="utf-8")
    HTML(string=html, base_url=str(RAIZ)).write_pdf(str(SALIDA))
    print("OK", SALIDA)
