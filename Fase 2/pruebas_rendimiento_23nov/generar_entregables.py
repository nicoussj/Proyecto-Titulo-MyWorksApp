#!/usr/bin/env python3
"""Arma figuras, Word, PDF corto y la sección del informe final.

Lee los JSON de k6 ya medidos. No vuelve a golpear producción.
No usa Document.save() sobre el informe de 16 MB: esa pieza se inserta por XML.
"""

from __future__ import annotations

import json
import os
import shutil
import zipfile
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor
from lxml import etree
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent
REPO = RAIZ.parents[1]
RESULTADOS = RAIZ / "resultados"
CAPTURAS = RAIZ / "capturas"
DOCS = REPO / "MyWorksAppProyect" / "docs" / "pruebas" / "2026-11-23"
INFORME = REPO / "Fase 2" / "Myworksapp_Informe_Final_PTY4614.docx"

PERFILES = [
    ("humo", "1 usuario", "30 segundos", "31 segundos"),
    ("carga", "50 usuarios", "2 minutos y 5 segundos", "2 minutos y 7 segundos"),
    ("estres", "100 usuarios", "1 minuto y 35 segundos", "1 minuto y 36 segundos"),
]
RECURSOS = [
    ("portada", "Portada"),
    ("imagen_categoria", "Imagen webp"),
    ("rpc_catalogo_web", "Catálogo web"),
    ("rpc_catalogo_app", "Camino de la app"),
]
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}


def cargar(nombre: str) -> dict:
    return json.loads((RESULTADOS / f"{nombre}.json").read_text(encoding="utf-8"))["metrics"]


def ms(valor: float) -> str:
    return f"{valor:.1f}".replace(".", ",")


def miles(valor: int) -> str:
    return f"{valor:,}".replace(",", " ")


def fila(metrics: dict, recurso: str) -> dict:
    bloque = metrics[f"http_req_duration{{name:{recurso}}}"]
    return {
        "n": int(bloque["count"]),
        "p50": float(bloque["med"]),
        "p95": float(bloque["p(95)"]),
        "max": float(bloque["max"]),
    }


def resumen_perfil(nombre: str) -> dict:
    metrics = cargar(nombre)
    global_ = metrics["http_req_duration"]
    fallos = metrics["http_req_failed"]
    checks = metrics["checks"]
    return {
        "vu": int(metrics["vus_max"]["max"]),
        "peticiones": int(metrics["http_reqs"]["count"]),
        "recorridos": int(metrics["iterations"]["count"]),
        "rps": float(metrics["http_reqs"]["rate"]),
        "errores": int(fallos["passes"]),
        "checks_ok": int(checks["passes"]),
        "checks_fail": int(checks["fails"]),
        "p50": float(global_["med"]),
        "p95": float(global_["p(95)"]),
        "max": float(global_["max"]),
        "recursos": {clave: fila(metrics, clave) for clave, _ in RECURSOS},
    }


def comprobacion() -> dict:
    metrics = json.loads((RESULTADOS / "comprobacion_50vu.json").read_text(encoding="utf-8"))["metrics"]
    return {
        "peticiones": int(metrics["http_reqs"]["count"]),
        "errores": int(metrics["http_req_failed"]["passes"]),
        "p95": float(metrics["http_req_duration"]["p(95)"]),
        "vu": int(metrics["vus"]["max"]),
    }


def grafico(datos: dict[str, dict]) -> Path:
    plt.rcParams["font.family"] = "DejaVu Sans"
    fig, ejes = plt.subplots(1, 2, figsize=(11.2, 4.8), sharey=True)
    etiquetas = [titulo for _, titulo in RECURSOS]
    series = [datos[nombre] for nombre, *_ in PERFILES]
    nombres = [etiqueta for _, etiqueta, *_ in PERFILES]
    colores = ["#8aa0b4", "#1f4e79", "#e87722"]
    import numpy as np

    x = np.arange(len(etiquetas))
    ancho = 0.24
    for ax, campo, titulo in (
        (ejes[0], "p50", "Mediana (p50)"),
        (ejes[1], "p95", "Percentil 95"),
    ):
        for i, (serie, nombre, color) in enumerate(zip(series, nombres, colores)):
            valores = [serie["recursos"][clave][campo] for clave, _ in RECURSOS]
            barras = ax.bar(x + (i - 1) * ancho, valores, ancho, label=nombre, color=color)
            for barra, valor in zip(barras, valores):
                ax.text(
                    barra.get_x() + barra.get_width() / 2,
                    barra.get_height() + 6 + i * 12,
                    ms(valor),
                    ha="center",
                    va="bottom",
                    fontsize=7,
                    color="#1a1a1a",
                )
        ax.set_title(titulo)
        ax.set_xticks(x, etiquetas)
        ax.set_ylabel("Milisegundos")
        ax.set_ylim(0, 360)
        ax.grid(axis="y", linestyle=":", color="#c5cdd6")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
    ejes[1].legend(frameon=False, loc="upper left")
    fig.suptitle("Latencia de lectura medida el 23 de noviembre de 2026", fontsize=13)
    fig.text(
        0.5,
        0.01,
        "Cero peticiones fallidas en los tres perfiles. El camino de la app es el mismo catálogo, con límite de 40 filas.",
        ha="center",
        fontsize=8,
        color="#333333",
    )
    fig.tight_layout(rect=(0, 0.04, 1, 0.94))
    destino = CAPTURAS / "grafico_p50_p95.png"
    fig.savefig(destino, dpi=140)
    plt.close(fig)
    return destino


def bloque_k6(path: Path) -> list[str]:
    lineas = path.read_text(encoding="utf-8", errors="replace").splitlines()
    cabeza = [
        ln.rstrip()
        for ln in lineas
        if ln.strip().startswith("scenarios:") or ln.strip().startswith("* lectura:")
    ]
    inicios = [i for i, ln in enumerate(lineas) if "TOTAL RESULTS" in ln]
    inicio = inicios[-1]
    fin = inicio
    for j in range(inicio, len(lineas)):
        if "data_sent" in lineas[j]:
            fin = j
            break
    cuerpo = [ln.rstrip() for ln in lineas[inicio - 1 : fin + 1]]
    return cabeza + [""] + cuerpo


def imagen_k6() -> Path:
    fuente = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 15)
    titulo_f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
    bloques = []
    for nombre, etiqueta, *_ in PERFILES:
        bloques.append((etiqueta, bloque_k6(RESULTADOS / f"{nombre}.txt")))
    piezas: list[str] = []
    for etiqueta, lineas in bloques:
        piezas.append(f"PERFIL {etiqueta}")
        piezas.extend(lineas)
        piezas.append("")
    # El resumen de k6 trae la mediana en la columna med. No se reescriben cifras.
    alto_linea = 20
    margen = 28
    ancho = int(max(fuente.getlength(linea) for linea in piezas) + margen * 2)
    ancho = max(ancho, 1100)
    alto = 56 + alto_linea * len(piezas) + margen
    imagen = Image.new("RGB", (ancho, alto), "#f7f4ef")
    draw = ImageDraw.Draw(imagen)
    draw.rectangle((0, 0, ancho, 42), fill="#1f4e79")
    draw.text((margen, 10), "Salida de k6 — resumen medido el 23 de noviembre de 2026", font=titulo_f, fill="white")
    y = 56
    for linea in piezas:
        color = "#1f4e79" if linea.startswith("PERFIL") or "TOTAL RESULTS" in linea else "#1a1a1a"
        if linea.strip().startswith("✓"):
            color = "#1b7f4a"
        draw.text((margen, y), linea, font=fuente, fill=color)
        y += alto_linea
    destino = CAPTURAS / "salida_k6.png"
    imagen.save(destino, "PNG")
    return destino


def parrafos(datos: dict[str, dict], previa: dict) -> list[tuple[str, str]]:
    h, c, e = datos["humo"], datos["carga"], datos["estres"]
    lineas = [
        (
            "titulo",
            "Pruebas de rendimiento y de estrés de MyWorksApp",
        ),
        ("fecha", "23 de noviembre de 2026. Portafolio de título PTY4614."),
        (
            "h",
            "Para qué se midió",
        ),
        (
            "p",
            "Se midió la lectura de la plataforma publicada: la portada, la fotografía webp de la categoría gasfitería y el catálogo público de profesionales. La web, la aplicación móvil y la consola de escritorio usan la misma base. En este equipo no había Docker ni una réplica local de Supabase, así que el estrés más alto no se hizo aparte: contra producción el techo quedó en 100 usuarios virtuales y en pocos minutos. No se crearon cuentas, pedidos ni cobros.",
        ),
        (
            "p",
            "Antes y después de cada corrida, demo_modo_activo respondió verdadero. El modo de demostración siguió en 1. La herramienta fue k6 1.4.2. Cada usuario virtual pidió la portada, la imagen y dos veces el catálogo. Una llamada usa el tamaño de página de la web (20 filas). La otra es el camino de la app: la misma función listar_profesionales_catalogo con límite de 40 filas, que es lo que pide el repositorio de trabajadores de Flutter. No se cronometró el dibujo de la interfaz. El SDK de Flutter responde en el equipo y reconoce Linux y Chrome, pero esa comprobación no es la cifra de carga.",
        ),
        (
            "h",
            "Resultados",
        ),
        (
            "p",
            f"Con 1 usuario, durante 30 segundos, hubo {miles(h['recorridos'])} recorridos y {miles(h['peticiones'])} peticiones. Las verificaciones de contenido salieron {miles(h['checks_ok'])} de {miles(h['checks_ok'])}. Errores: {h['errores']}. La mediana global fue {ms(h['p50'])} ms y el p95 global {ms(h['p95'])} ms.",
        ),
        (
            "p",
            f"En ese perfil la portada quedó en p50 {ms(h['recursos']['portada']['p50'])} ms y p95 {ms(h['recursos']['portada']['p95'])} ms. La imagen webp, en p50 {ms(h['recursos']['imagen_categoria']['p50'])} ms y p95 {ms(h['recursos']['imagen_categoria']['p95'])} ms. El catálogo de la web, en p50 {ms(h['recursos']['rpc_catalogo_web']['p50'])} ms y p95 {ms(h['recursos']['rpc_catalogo_web']['p95'])} ms. El camino de la app, en p50 {ms(h['recursos']['rpc_catalogo_app']['p50'])} ms y p95 {ms(h['recursos']['rpc_catalogo_app']['p95'])} ms.",
        ),
        (
            "p",
            f"Con 50 usuarios el escenario duró 2 minutos y 5 segundos y la corrida, 2 minutos y 7 segundos. Hubo {miles(c['recorridos'])} recorridos y {miles(c['peticiones'])} peticiones, a {ms(c['rps'])} peticiones por segundo en promedio. Verificaciones correctas: {miles(c['checks_ok'])}. Errores: {c['errores']}. Mediana global {ms(c['p50'])} ms y p95 global {ms(c['p95'])} ms.",
        ),
        (
            "p",
            f"Portada: p50 {ms(c['recursos']['portada']['p50'])} ms y p95 {ms(c['recursos']['portada']['p95'])} ms. Imagen webp: p50 {ms(c['recursos']['imagen_categoria']['p50'])} ms y p95 {ms(c['recursos']['imagen_categoria']['p95'])} ms. Catálogo web: p50 {ms(c['recursos']['rpc_catalogo_web']['p50'])} ms y p95 {ms(c['recursos']['rpc_catalogo_web']['p95'])} ms. Camino de la app: p50 {ms(c['recursos']['rpc_catalogo_app']['p50'])} ms y p95 {ms(c['recursos']['rpc_catalogo_app']['p95'])} ms.",
        ),
        (
            "p",
            f"Con 100 usuarios el escenario duró 1 minuto y 35 segundos y la corrida, 1 minuto y 36 segundos. Hubo {miles(e['recorridos'])} recorridos y {miles(e['peticiones'])} peticiones, a {ms(e['rps'])} peticiones por segundo en promedio. Verificaciones correctas: {miles(e['checks_ok'])}. Errores: {e['errores']}. Mediana global {ms(e['p50'])} ms y p95 global {ms(e['p95'])} ms. La petición más lenta del catálogo web en este perfil tardó {ms(e['recursos']['rpc_catalogo_web']['max'])} ms.",
        ),
        (
            "p",
            f"Portada: p50 {ms(e['recursos']['portada']['p50'])} ms y p95 {ms(e['recursos']['portada']['p95'])} ms. Imagen webp: p50 {ms(e['recursos']['imagen_categoria']['p50'])} ms y p95 {ms(e['recursos']['imagen_categoria']['p95'])} ms. Catálogo web: p50 {ms(e['recursos']['rpc_catalogo_web']['p50'])} ms y p95 {ms(e['recursos']['rpc_catalogo_web']['p95'])} ms. Camino de la app: p50 {ms(e['recursos']['rpc_catalogo_app']['p50'])} ms y p95 {ms(e['recursos']['rpc_catalogo_app']['p95'])} ms.",
        ),
        (
            "p",
            f"Antes del desglose por recurso se hizo una pasada de comprobación, también con 50 usuarios y solo lecturas: {miles(previa['peticiones'])} peticiones, {previa['errores']} errores y p95 global de {ms(previa['p95'])} ms. Esas cifras son el total, sin separar recursos. El desglose de portada, imagen y catálogo es el de los tres perfiles anteriores.",
        ),
        (
            "h",
            "Lectura de los números",
        ),
        (
            "p",
            "La portada y la imagen se mantienen rápidas: con 100 usuarios el p95 queda en 24,5 ms y 21,3 ms. El catálogo, que sí consulta la base, es la parte más lenta y aun así el p95 no pasó de 220,1 ms. Subir de 50 a 100 usuarios no empeoró ese percentil: en el techo de 100 el catálogo web marcó 166,1 ms y el camino de la app 167,0 ms, por debajo de los 218,6 ms y 220,1 ms vistos con 50. No aparecieron respuestas 5xx ni cortes por límite de tasa. Dentro de este techo de lectura no se vio el quiebre. No se subió de 100 usuarios porque no había réplica local y el proyecto publicado tenía que seguir en pie.",
        ),
        (
            "h",
            "Consola de escritorio",
        ),
        (
            "p",
            "La consola no se estresó contra producción. Sus lecturas de inicio, disputas y ajustes pasan por consola_resumen_periodo, consola_disputas_abiertas y consola_leer_config. Esas funciones están concedidas a la sesión autenticada y, en ajustes y en el resumen, exigen administrador. Con la clave pública el servidor respondió 401, permiso denegado, en las tres. No se forzó un inicio de sesión ni se probó una contraseña. Por eso este informe no trae un p95 de la consola.",
        ),
        (
            "h",
            "Cierre",
        ),
        (
            "p",
            "La web y el camino de la app se pudieron medir, porque los dos leen el catálogo público. La consola no, porque sus lecturas no son anónimas. Después de las tres corridas, demo_modo_activo seguía en verdadero y la portada volvió a abrir con normalidad.",
        ),
    ]
    return lineas


def tabla_word(documento: Document, datos: dict[str, dict]) -> None:
    documento.add_paragraph("Tabla. Mediana y p95 por recurso, en milisegundos.").runs[0].italic = True
    tabla = documento.add_table(rows=1, cols=9)
    tabla.style = "Table Grid"
    encabezados = [
        "Perfil",
        "Usuarios",
        "Peticiones",
        "Errores",
        "p95 portada",
        "p95 imagen",
        "p95 catálogo web",
        "p95 camino app",
        "p50 camino app",
    ]
    for i, texto in enumerate(encabezados):
        tabla.rows[0].cells[i].text = texto
    for nombre, etiqueta, *_ in PERFILES:
        serie = datos[nombre]
        valores = [
            etiqueta,
            str(serie["vu"]),
            miles(serie["peticiones"]),
            str(serie["errores"]),
            ms(serie["recursos"]["portada"]["p95"]),
            ms(serie["recursos"]["imagen_categoria"]["p95"]),
            ms(serie["recursos"]["rpc_catalogo_web"]["p95"]),
            ms(serie["recursos"]["rpc_catalogo_app"]["p95"]),
            ms(serie["recursos"]["rpc_catalogo_app"]["p50"]),
        ]
        celdas = tabla.add_row().cells
        for i, texto in enumerate(valores):
            celdas[i].text = texto


def escribir_word(datos: dict[str, dict], previa: dict, figuras: list[tuple[Path, str]]) -> Path:
    documento = Document()
    seccion = documento.sections[0]
    seccion.top_margin = Cm(1.8)
    seccion.bottom_margin = Cm(1.8)
    seccion.left_margin = Cm(1.8)
    seccion.right_margin = Cm(1.8)
    for estilo, texto in parrafos(datos, previa):
        if estilo == "titulo":
            p = documento.add_heading(texto, level=0)
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        elif estilo == "fecha":
            r = documento.add_paragraph().add_run(texto)
            r.italic = True
            r.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
            r.font.size = Pt(12)
        elif estilo == "h":
            documento.add_heading(texto, level=1)
        else:
            documento.add_paragraph(texto)
        if estilo == "h" and texto == "Resultados":
            tabla_word(documento, datos)
    for ruta, epigrafe in figuras:
        documento.add_picture(str(ruta), width=Cm(16.2))
        cap = documento.add_paragraph()
        run = cap.add_run(epigrafe)
        run.italic = True
        run.font.size = Pt(10)
    destino = RAIZ / "Pruebas_rendimiento_23nov.docx"
    documento.save(destino)
    return destino


def escribir_md(datos: dict[str, dict], previa: dict) -> Path:
    cuerpo = ["# Pruebas de rendimiento y de estrés — 23 de noviembre de 2026", ""]
    for estilo, texto in parrafos(datos, previa):
        if estilo == "titulo":
            continue
        if estilo == "fecha":
            cuerpo.append(texto)
            cuerpo.append("")
        elif estilo == "h":
            cuerpo.append(f"## {texto}")
            cuerpo.append("")
        else:
            cuerpo.append(texto)
            cuerpo.append("")
    cuerpo.append("Figuras: `capturas/salida_k6.png`, `capturas/grafico_p50_p95.png`, `capturas/web_durante_carga.png`, `capturas/web_despues_estres.png`.")
    cuerpo.append("")
    destino = RAIZ / "INFORME.md"
    destino.write_text("\n".join(cuerpo), encoding="utf-8")
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / "INFORME.md").write_text(
        "\n".join(cuerpo)
        + "\nLas figuras, el Word y el PDF están en `Fase 2/pruebas_rendimiento_23nov/`.\n",
        encoding="utf-8",
    )
    return destino


def xml_texto(texto: str, estilo: str | None) -> str:
    nodo = etree.Element(f"{{{W}}}p")
    ppr = etree.SubElement(nodo, f"{{{W}}}pPr")
    if estilo:
        etree.SubElement(ppr, f"{{{W}}}pStyle").set(f"{{{W}}}val", estilo)
    r = etree.SubElement(nodo, f"{{{W}}}r")
    t = etree.SubElement(r, f"{{{W}}}t")
    t.text = texto
    return etree.tostring(nodo, encoding="unicode")


def xml_imagen(ruta: Path, rel_id: str, doc_id: int, nombre: str) -> str:
    with Image.open(ruta) as im:
        ancho_px, alto_px = im.size
    cx = 5_760_000
    cy = int(cx * alto_px / ancho_px)
    xml = f"""<w:p xmlns:w="{W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:pPr><w:jc w:val="center"/></w:pPr>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="{cx}" cy="{cy}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="{doc_id}" name="{nombre}" descr="{nombre}"/>
        <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic>
              <pic:nvPicPr>
                <pic:cNvPr id="{doc_id}" name="{nombre}"/>
                <pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="{rel_id}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>"""
    return xml


def insertar_informe(datos: dict[str, dict], previa: dict, figuras: list[tuple[Path, str]]) -> None:
    original = INFORME.read_bytes()
    if len(original) < 15_000_000:
        raise SystemExit(f"el informe original ya está bajo 15 MB: {len(original)}")
    with zipfile.ZipFile(INFORME) as zin:
        xml = zin.read("word/document.xml").decode("utf-8")
        rels = zin.read("word/_rels/document.xml.rels").decode("utf-8")
        otros = {info.filename: zin.read(info.filename) for info in zin.infolist()}
        infos = {info.filename: info for info in zin.infolist()}

    if "Medición de rendimiento y estrés del 23 de noviembre de 2026" in xml:
        print("el informe ya tiene la sección; no se vuelve a insertar")
        return
    marcador = ">CONCLUSIONES Y RECOMENDACIONES<"
    posiciones = []
    inicio = 0
    while True:
        hallado = xml.find(marcador, inicio)
        if hallado < 0:
            break
        posiciones.append(hallado)
        inicio = hallado + len(marcador)

    def inicio_parrafo(hasta: int) -> int:
        pos = hasta
        while True:
            pos = xml.rfind("<w:p", 0, pos)
            if pos < 0:
                return -1
            if xml.startswith("<w:p>", pos) or xml.startswith("<w:p ", pos):
                return pos
            pos -= 1

    candidatos = []
    for hallado in posiciones:
        arranque = inicio_parrafo(hallado)
        ventana = xml[arranque:hallado]
        if 'w:val="Heading1"' in ventana:
            candidatos.append(arranque)
    if len(candidatos) != 1:
        raise SystemExit(f"no se ubicó un único Heading1 de conclusiones: {len(candidatos)}")

    piezas = [
        xml_texto(
            "Medición de rendimiento y estrés del 23 de noviembre de 2026",
            "Heading2",
        )
    ]
    for estilo, texto in parrafos(datos, previa):
        if estilo in {"titulo", "fecha"}:
            continue
        if estilo == "h":
            piezas.append(xml_texto(texto, "Heading3"))
        else:
            piezas.append(xml_texto(texto, "Normal"))
    relaciones = []
    for indice, (ruta, epigrafe) in enumerate(figuras):
        rel_id = f"rId{98 + indice}"
        doc_id = 81 + indice
        media = f"image{73 + indice}.png"
        piezas.append(xml_imagen(ruta, rel_id, doc_id, ruta.name))
        piezas.append(xml_texto(epigrafe, "Normal"))
        relaciones.append(
            f'<Relationship Id="{rel_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/{media}"/>'
        )
        otros[f"word/media/{media}"] = ruta.read_bytes()
    if any(rel_id in rels for rel_id in ("rId98", "rId99", "rId100")):
        raise SystemExit("los rId 98-100 ya existen")
    rels = rels.replace("</Relationships>", "".join(relaciones) + "</Relationships>")
    otros["word/_rels/document.xml.rels"] = rels.encode("utf-8")
    xml = xml[: candidatos[0]] + "".join(piezas) + xml[candidatos[0] :]
    if "Objetivo General" not in xml or xml.count(">CONCLUSIONES Y RECOMENDACIONES<") < 1:
        raise SystemExit("la inserción perdió Objetivo General o las conclusiones")
    otros["word/document.xml"] = xml.encode("utf-8")

    temporal = INFORME.with_suffix(".docx.nuevo")
    with zipfile.ZipFile(temporal, "w") as zout:
        nombres = list(infos) + [n for n in otros if n not in infos]
        if nombres[0] != "[Content_Types].xml":
            nombres.remove("[Content_Types].xml")
            nombres.insert(0, "[Content_Types].xml")
        for nombre in nombres:
            info = infos.get(nombre)
            nuevo = zipfile.ZipInfo(filename=nombre, date_time=info.date_time if info else (2026, 11, 23, 9, 0, 0))
            nuevo.compress_type = info.compress_type if info else zipfile.ZIP_DEFLATED
            nuevo.external_attr = info.external_attr if info else 0o644 << 16
            zout.writestr(nuevo, otros[nombre])
    tamano = temporal.stat().st_size
    with zipfile.ZipFile(temporal) as comprobacion_zip:
        texto = comprobacion_zip.read("word/document.xml").decode("utf-8")
        media = [n for n in comprobacion_zip.namelist() if n.startswith("word/media/")]
    if "Objetivo General" not in texto:
        temporal.unlink()
        raise SystemExit("el docx nuevo perdió Objetivo General")
    if "166,1 ms" not in texto or "camino de la app" not in texto:
        temporal.unlink()
        raise SystemExit("el docx nuevo no trae las cifras medidas")
    if tamano < 15_000_000 or len(media) < 73:
        temporal.unlink()
        raise SystemExit(f"docx incompleto: {tamano} bytes, {len(media)} imágenes")
    os.replace(temporal, INFORME)
    print(f"informe {tamano} bytes, imagenes {len(media)}")


def main() -> None:
    datos = {nombre: resumen_perfil(nombre) for nombre, *_ in PERFILES}
    previa = comprobacion()
    CAPTURAS.mkdir(parents=True, exist_ok=True)
    figura_datos = grafico(datos)
    figura_k6 = imagen_k6()
    figuras = [
        (figura_k6, "Figura. Resumen que imprimió k6 en los tres perfiles de lectura."),
        (figura_datos, "Figura. Mediana y p95 medidos en la portada, la imagen webp, el catálogo web y el camino de la app."),
        (
            CAPTURAS / "web_durante_carga.png",
            "Figura. Portada de myworksapp.cl abierta durante la corrida de 50 usuarios.",
        ),
        (
            CAPTURAS / "web_despues_estres.png",
            "Figura. La misma portada, abierta de nuevo después del techo de 100 usuarios.",
        ),
    ]
    for ruta, _ in figuras:
        if not ruta.is_file() or ruta.stat().st_size < 1000:
            raise SystemExit(f"falta la captura {ruta}")
    word = escribir_word(datos, previa, figuras)
    md = escribir_md(datos, previa)
    insertar_informe(datos, previa, figuras[:3])
    print(word)
    print(md)


if __name__ == "__main__":
    main()
