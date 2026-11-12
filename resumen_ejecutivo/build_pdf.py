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
        ("Inversión inicial", lambda s: usd(s["inversion"])),
        ("Beneficio neto en 3 años", lambda s: usd(s["beneficio_3y"])),
        ("Valor presente neto (VPN)", lambda s: usd(s["vpn"])),
        ("Payback (meses)", lambda s: payback(s["payback_meses"])),
        ("Retorno sobre la inversión (ROI)", lambda s: roi(s["roi_3y"])),
    ]
    h = "<table class='t'><tr><th style='width:42%'>USD</th>" + "".join(f"<th>{NOMBRE[k]}</th>" for k in ESC) + "</tr>"
    for nom, f in filas:
        h += f"<tr><td>{e(nom)}</td>" + "".join(f"<td class='n'>{e(f(S[k]))}</td>" for k in ESC) + "</tr>"
    return h + "</table><p class='peq'>Payback: meses hasta recuperar la inversi\u00f3n. \u00ab> 36\u00bb = no la recupera en 36 meses.</p>"


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
        f"<p>En el escenario base, el asistente generaría unas <b>{num1(b['citas_mes_actuales'])} citas adicionales al mes</b> al final del tercer año. "
        + (f"Eso cubre su costo mensual, con poco margen (el punto de equilibrio es {num1(b['citas_mes_equilibrio_operativo'])} citas), pero no recupera la inversión: "
           if ok_op else f"Eso no cubre su costo mensual (el punto de equilibrio es {num1(b['citas_mes_equilibrio_operativo'])} citas) ni recupera la inversión: ")
        + f"para recuperarla en 24 meses harían falta <b>{num1(b['citas_mes_payback_24'])} citas al mes</b>, el volumen de unas {num1(b['sedes_equivalentes'])} sedes como la modelada.</p>"
        "<p>El resultado depende de dos datos que hoy no están medidos: cuántos clientes vuelven al taller y cuántos responden al mensaje. "
        f"Si se acercan al escenario optimista, la inversión se recupera en {payback(S['optimista']['payback_meses'])} meses; si se parecen al pesimista, el proyecto no es viable.</p>"
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


PLANTILLA = """<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen ejecutivo - Postventa con IA</title>
<style>
@page { size: Letter; margin: 0.42in 0.5in 0.42in 0.5in; @bottom-center { content: "Postventa con IA · Propuesta al comité · pág. " counter(page) " de " counter(pages); font: 8.5pt $css_font; color:#333 } }
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
<h1>Postventa con IA: que el cliente vuelva al taller después de la garantía</h1>
<div class="sub">Propuesta al comité directivo · Agencia multimarca en Colombia (caso ficticio) · Cifras en USD, supuestos v$vers del $fecha</div>

<div class="caja"><b>Lo que pedimos:</b> aprobar un piloto de 6 meses en una sede para comprobar si un asistente por WhatsApp logra que más clientes vuelvan al taller. No pedimos el despliegue en toda la red: con las cifras de hoy, el escenario base no recupera la inversión en 3 años, y los dos datos que deciden el caso no están medidos. El piloto sirve para medirlos.</div>

<h2>1. El problema</h2>
<p>Cuando termina la garantía, la agencia pierde al cliente. El mantenimiento, el SOAT y la siguiente compra se van a talleres independientes y a aseguradoras externas, y las bahías del taller quedan vacías entre semana. Hoy la postventa espera a que el cliente llame, y los mensajes que se envían son genéricos: no tienen en cuenta el kilometraje ni la historia del vehículo.</p>
<p>En Estados Unidos, solo el $vuelve % de los dueños de carros de hasta 2 años vuelve al concesionario que se lo vendió; en 2023 era el $antes % (Cox Automotive). En Colombia no hay un dato público equivalente. El brief indica una retención del $ret_a, y es lo primero que el piloto debe confirmar.</p>

<h2>2. Segmento: a quién servimos primero</h2>
<p>Propietarios de vehículos de 2 a 5 años, entre 20.000 y 60.000 km. Es el momento en que vence la garantía de fábrica y el cliente empieza a buscar talleres más baratos. En el parque modelado son unos <b>$seg vehículos</b> ($pct_seg de $parque); la cifra real se toma del sistema de gestión de la agencia.</p>

<h2>3. Propuesta de valor</h2>
<ul>
<li><b>Propietario:</b> recibe un aviso solo cuando su carro lo necesita, con el precio del tarifario y la cita agendada en el mismo chat.</li>
<li><b>Asesor de servicio:</b> deja de atender llamadas repetitivas. Recibe citas confirmadas y, cuando un caso lo requiere, un resumen para atenderlo.</li>
<li><b>Jefe de taller:</b> ocupa las bahías en las horas de menos demanda, sin sobrecargar las horas pico.</li>
<li><b>Gerencia:</b> mide retención y margen mes a mes, con datos propios.</li>
</ul>

<h2>4. Ecosistema y prioridades</h2>
<p>El asistente habla con el cliente por WhatsApp y trabaja sobre los sistemas que ya tiene la agencia: CRM, inventario de repuestos, tarifario y agenda del taller. Las aseguradoras aliadas se suman en una etapa posterior.</p>
<ol style="margin:0 0 2pt 0;padding-left:13pt">
<li><b>Primero, el mantenimiento por kilometraje.</b> Es donde más clientes se pierden. El kilometraje estimado es el dato más confiable para saber cuándo escribir, y cada cita ocupa una bahía.</li>
<li><b>Segundo, el paquete de desgaste en la misma visita</b> (frenos, batería, llantas). Se ofrece cuando el cliente ya viene, así que cuesta poco venderlo.</li>
<li><b>Después:</b> SOAT y pólizas, que requieren integrar a las aseguradoras; garantías, que tienen riesgo legal y por eso el asistente solo las pasa a una persona; y recompra del vehículo, para la que aún falta historial.</li>
</ol>

<h2>5. Solución agéntica</h2>
<p>Cuatro agentes con funciones separadas. La IA entiende al cliente y redacta las respuestas; los precios, las reservas y las reglas de seguridad los calcula un código fijo que la IA no puede cambiar.</p>
<table class="t">
<tr><th style="width:15%">Agente</th><th style="width:31%">Qué hace</th><th style="width:25%">Qué decide solo</th><th>Qué no puede hacer</th></tr>
<tr><td><b>Proactivo</b></td><td>Detecta los vehículos que se acercan a su mantenimiento y prepara el primer mensaje.</td><td>Informar.</td><td>Escribir a quien no autorizó el contacto, ni más de $maxc vez al mes.</td></tr>
<tr><td><b>Asistente de postventa</b></td><td>Conversa por WhatsApp: cotiza, revisa repuestos y agenda.</td><td>Informar, recomendar y reservar la cita cuando el cliente la confirma.</td><td>Inventar precios, dar descuentos de más del $tope, diagnosticar fallas o aprobar garantías.</td></tr>
<tr><td><b>Guardián</b></td><td>Revisa cada mensaje antes y después de la IA.</td><td>Bloquear, ocultar datos personales y pasar el caso a una persona.</td><td>Ser desactivado por la IA: no usa IA.</td></tr>
<tr><td><b>Copiloto del asesor</b></td><td>Resume el caso para la persona que lo toma.</td><td>Sugerir el siguiente paso.</td><td>Hablar con el cliente.</td></tr>
</table>
<p><b>Controles.</b> Solo se escribe a quien autorizó el contacto (Ley 1581 de 2012). Los precios salen siempre del tarifario. La cita se aparta $hold minutos, nunca se reserva dos veces y solo se confirma cuando el cliente lo dice. Los datos personales se ocultan antes de llegar a la IA. El caso pasa a una persona ante síntomas de riesgo (frenos, humo, testigos en rojo), garantías, repuestos agotados, clientes molestos o intentos de manipulación. Cada decisión queda registrada para auditoría.</p>
<p class="peq"><b>Prototipo:</b> $url_demo · <b>Código:</b> $url_repo</p>
</div>

<div class="fin">
<h2 style="margin-top:0">6. Valor esperado e inversión</h2>
<p class="peq">Modelo financiero a 36 meses (enero de 2027 a diciembre de 2029), tres escenarios. Cifras en USD, con una tasa de cambio de $trm pesos por dólar.</p>
<div class="dos">
<div style="flex:1.45">$tabla</div>
<div style="flex:0 0 235pt;padding-top:1pt">$grafico</div>
</div>
<div class="caja">$lectura</div>
<p>El costo de la IA es bajo: USD $ia_b por conversación en el escenario base, más USD $wa_b de WhatsApp. No es lo que decide el caso; lo deciden la retención y la respuesta de los clientes.</p>

<h2>7. Principales riesgos</h2>
<ul>
<li><b>Retención y respuesta sin medir.</b> El primer mes del piloto mide la línea base real antes de seguir invirtiendo.</li>
<li><b>Consentimiento y datos personales.</b> Solo se escribe con autorización y los datos se ocultan antes de llegar a la IA.</li>
<li><b>Que la IA invente un precio o una promesa.</b> Los precios salen del tarifario y el Guardián bloquea lo que no viene de los sistemas.</li>
<li><b>Integración más difícil que en el prototipo.</b> Se conecta un sistema a la vez: primero el CRM, después la agenda del taller.</li>
<li><b>Baja adopción de los asesores.</b> Reciben citas confirmadas y casos resumidos, y revisan cada semana cómo respondió el asistente.</li>
</ul>

<h2>8. Plan de 6 meses y decisión solicitada</h2>
<ul>
<li><b>Mes 1:</b> medir la retención, el ticket y el margen reales, y pedir a los clientes autorización de contacto. <b>Se continúa si</b> acepta al menos el $g_optin y la retención real se parece a la del modelo; si no, se recalcula o se detiene.</li>
<li><b>Meses 2 y 3:</b> conectar el CRM y luego la agenda del taller, y ajustar el asistente con conversaciones reales.</li>
<li><b>Meses 3 a 5:</b> piloto con un grupo de control. <b>Se continúa si</b> responde al menos el $g_resp, agenda al menos el $g_conv de quienes responden y las citas perdidas no pasan del $g_nos_v.</li>
<li><b>Mes 6:</b> se propone escalar solo si la retención del grupo atendido sube hacia el $g_ret (hoy $ret_a) y el margen por cita cubre el costo de operación. Si no, el piloto se cierra.</li>
</ul>
<p class="peq">Los umbrales son los valores del escenario pesimista. Indicadores de seguimiento: autorizaciones, respuesta, citas agendadas, inasistencias, ocupación de bahías, margen por visita, costo de IA por conversación, retención y precios distintos del tarifario (meta: cero).</p>

<div class="caja"><b>Decisión solicitada:</b> aprobar el piloto de 6 meses en una sede, con las tres compuertas anteriores, y decidir si se escala al terminar el mes 6. El presupuesto del piloto no está en el modelo financiero; se acuerda con el comité y cubre el equipo mínimo y la conexión con el CRM y la agenda del taller.</div>
<p class="peq">La agencia y los datos son ficticios. Este documento y el prototipo se construyeron con asistentes de IA, con supervisión y revisión humana; cada cifra tiene fuente o es un supuesto declarado en el modelo financiero.</p>
</div>
</body></html>"""


if __name__ == "__main__":
    from weasyprint import HTML

    html = construir()
    (Path(__file__).resolve().parent / "resumen.html").write_text(html, encoding="utf-8")
    HTML(string=html, base_url=str(RAIZ)).write_pdf(str(SALIDA))
    print("OK", SALIDA)
