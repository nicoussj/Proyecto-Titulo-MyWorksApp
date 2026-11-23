#!/usr/bin/env python3
"""Defensa visual de MyWorksApp. Una idea por lámina, fondo claro, naranja y azul."""

from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn as dqn
from docx.shared import Cm, Pt, RGBColor as DocxRGB
from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt as Ppt

ROOT = Path(__file__).resolve().parent
FASE = ROOT.parent
VIDEO = FASE / "video" / "myworksapp_presentacion.mp4"
WEB = ROOT / "portada_web.png"
ER = ROOT / "er_defensa.png"
POSTER = ROOT / "video_poster.png"
PPTX = FASE / "Presentacion_final_MyWorksApp.pptx"
PAUTA = FASE / "Pauta_presentacion_demo.docx"

W, H = 13.333333, 7.5
NAVY = RGBColor(0x00, 0x20, 0x5B)
NAVY2 = RGBColor(0x1A, 0x3A, 0x6E)
ORANGE = RGBColor(0xFF, 0x5E, 0x03)
SOFT = RGBColor(0xFF, 0xF1, 0xE8)
CREAM = RGBColor(0xF7, 0xF5, 0xF2)
INK = RGBColor(0x12, 0x14, 0x1A)
MUTED = RGBColor(0x5C, 0x63, 0x70)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREEN = RGBColor(0x1B, 0x6B, 0x43)
GSOFT = RGBColor(0xE8, 0xF6, 0xEE)
LINE = RGBColor(0xE6, 0xDF, 0xD6)
WINE = RGBColor(0x8C, 0x2F, 0x39)

TOTAL = 17


def rgb(color: RGBColor) -> tuple[int, int, int]:
    return (color[0], color[1], color[2])


def run(paragraph, text, size, color, bold=False, align=None):
    paragraph.alignment = align if align is not None else paragraph.alignment
    r = paragraph.add_run()
    r.text = text
    r.font.size = Ppt(size)
    r.font.color.rgb = color
    r.font.bold = bold
    r.font.name = "Inter"
    r.font.italic = False
    rpr = r._r.get_or_add_rPr()
    for tag in ("a:latin", "a:ea", "a:cs"):
        node = rpr.find(qn(tag))
        if node is None:
            node = rpr.makeelement(qn(tag), {"typeface": "Inter"})
            rpr.append(node)
        else:
            node.set("typeface", "Inter")
    return r


def text(slide, x, y, w, h, lines, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = shape.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    tf.anchor = anchor
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = line.get("align", align)
        p.space_before = Ppt(line.get("before", 0))
        p.space_after = Ppt(line.get("after", 0))
        run(p, line["t"], line["s"], line["c"], line.get("b", False))
    return shape


def box(slide, x, y, w, h, fill, line=None, radius=0.12, width=1.25):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h)
    )
    shape.adjustments[0] = radius
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Ppt(width)
    sp = shape._element.spPr
    effect = etree.SubElement(sp, qn("a:effectLst"))
    shadow = etree.SubElement(
        effect,
        qn("a:outerShdw"),
        {"blurRad": "180000", "dist": "50000", "dir": "2700000", "algn": "tl", "rotWithShape": "0"},
    )
    color = etree.SubElement(shadow, qn("a:srgbClr"), {"val": "1A2433"})
    etree.SubElement(color, qn("a:alpha"), {"val": "12000"})
    return shape


def oval(slide, x, y, w, h, fill, line=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Ppt(1.5)
    return shape


def rule(slide, x, y, w, color=ORANGE, weight=2.25):
    shape = slide.shapes.add_connector(
        MSO_CONNECTOR.STRAIGHT, Inches(x), Inches(y), Inches(x + w), Inches(y)
    )
    shape.line.color.rgb = color
    shape.line.width = Ppt(weight)
    return shape


def vrule(slide, x, y1, y2, color=NAVY2, weight=2.0):
    shape = slide.shapes.add_connector(
        MSO_CONNECTOR.STRAIGHT, Inches(x), Inches(y1), Inches(x), Inches(y2)
    )
    shape.line.color.rgb = color
    shape.line.width = Ppt(weight)
    return shape


def bg(slide, color=CREAM):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = color


def bar(slide):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(W), Inches(0.08))
    shape.fill.solid()
    shape.fill.fore_color.rgb = ORANGE
    shape.line.fill.background()


def footer(slide, n):
    rule(slide, 0.62, 7.12, 12.1, LINE, 1.0)
    text(
        slide, 0.62, 7.18, 9.2, 0.26,
        [{"t": "MyWorksApp    ·    Duoc UC Puerto Montt    ·    PTY4614", "s": 11, "c": MUTED}],
        anchor=MSO_ANCHOR.MIDDLE,
    )
    text(
        slide, 11.4, 7.18, 1.3, 0.26,
        [{"t": f"{n:02d}", "s": 12, "c": NAVY, "b": True, "align": PP_ALIGN.RIGHT}],
        align=PP_ALIGN.RIGHT,
        anchor=MSO_ANCHOR.MIDDLE,
    )


def chrome(slide, kicker, title, subtitle=None):
    bg(slide)
    bar(slide)
    text(slide, 0.62, 0.28, 10, 0.28, [{"t": kicker.upper(), "s": 13, "c": ORANGE, "b": True}])
    text(slide, 0.62, 0.54, 12.1, 0.52, [{"t": title, "s": 32, "c": NAVY, "b": True}])
    if subtitle:
        text(slide, 0.62, 1.12, 12.1, 0.36, [{"t": subtitle, "s": 16, "c": MUTED}])
        return 1.62
    return 1.28


def prepare_images():
    if VIDEO.exists() and not POSTER.exists():
        subprocess.check_call(
            [
                "ffmpeg", "-y", "-ss", "3", "-i", str(VIDEO),
                "-frames:v", "1", "-update", "1", str(POSTER),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    poster = Image.open(POSTER).convert("RGBA")
    poster.thumbnail((1600, 900), Image.Resampling.LANCZOS)
    overlay = Image.new("RGBA", poster.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx, cy = poster.size[0] // 2, poster.size[1] // 2
    r = 54
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, 230))
    draw.polygon([(cx - 16, cy - 24), (cx - 16, cy + 24), (cx + 26, cy)], fill=(0, 32, 91, 255))
    poster = Image.alpha_composite(poster, overlay)
    poster = round_image(poster, 36)
    poster.save(ROOT / "video_poster_slide.png")

    web = Image.open(WEB).convert("RGBA")
    web.thumbnail((1400, 880), Image.Resampling.LANCZOS)
    round_image(web, 28).save(ROOT / "portada_web_slide.png")


def round_image(im: Image.Image, radius: int) -> Image.Image:
    im = im.convert("RGBA")
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), radius=radius, fill=255)
    im.putalpha(mask)
    return im


def new_slide(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def portada(prs):
    s = new_slide(prs)
    bg(s)
    panel = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(8.15), Inches(H))
    panel.fill.solid()
    panel.fill.fore_color.rgb = NAVY
    panel.line.fill.background()
    accent = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(8.15), 0, Inches(0.09), Inches(H))
    accent.fill.solid()
    accent.fill.fore_color.rgb = ORANGE
    accent.line.fill.background()
    mark = box(s, 0.72, 0.62, 0.62, 0.62, ORANGE, radius=0.22)
    text(s, 0.72, 0.62, 0.62, 0.62, [{"t": "M", "s": 26, "c": WHITE, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 0.72, 1.55, 6.8, 0.32, [{"t": "DUOC UC    ·    SEDE PUERTO MONTT", "s": 14, "c": ORANGE, "b": True}])
    text(s, 0.72, 2.15, 6.9, 1.15, [{"t": "MyWorksApp", "s": 60, "c": WHITE, "b": True}])
    rule(s, 0.74, 3.45, 2.1, ORANGE, 3.5)
    text(
        s, 0.72, 3.7, 6.7, 1.15,
        [{"t": "Elegir un oficio con precio,\nnota y pago retenido.", "s": 24, "c": WHITE}],
    )
    text(s, 8.6, 1.85, 4.2, 0.28, [{"t": "CAPSTONE", "s": 13, "c": ORANGE, "b": True}])
    text(s, 8.6, 2.15, 4.2, 0.6, [{"t": "PTY4614", "s": 36, "c": NAVY, "b": True}])
    rule(s, 8.6, 2.9, 1.5, ORANGE, 2.5)
    names = ["Mathias Jara", "Nicolás Chiguay", "Gabriel Valderas"]
    for i, name in enumerate(names):
        y = 3.25 + i * 0.58
        oval(s, 8.62, y + 0.08, 0.16, 0.16, ORANGE)
        text(s, 8.95, y, 3.6, 0.36, [{"t": name, "s": 18, "c": INK}])
    text(s, 8.6, 6.55, 4.2, 0.32, [{"t": "Noviembre 2026", "s": 14, "c": MUTED}])
    # El recuadro del logo no debe tapar la letra: el texto va después.
    mark._element.getparent().remove(mark._element)
    s.shapes._spTree.insert(3, mark._element)


def problema(prs):
    s = new_slide(prs)
    chrome(s, "Problema", "Contratar un oficio sigue a ciegas", "El cliente no tiene datos ni una garantía del pago.")
    footer(s, 2)
    cards = [
        ("01", "Por un mensaje", "El acuerdo no queda\ncomo un pedido."),
        ("02", "Sin nota ni tarifa", "No se compara al profesional\nni queda rastro del trabajo."),
        ("03", "Pago sin garantía", "Se adelanta, o se cobra\ncuando ya terminó."),
    ]
    for i, (n, title, body) in enumerate(cards):
        x = 0.62 + i * 4.15
        box(s, x, 2.05, 3.9, 4.35, WHITE, LINE, 0.08)
        oval(s, x + 0.32, 2.4, 0.78, 0.78, SOFT)
        text(s, x + 0.32, 2.4, 0.78, 0.78, [{"t": n, "s": 18, "c": ORANGE, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.32, 3.5, 3.25, 0.9, [{"t": title, "s": 24, "c": NAVY, "b": True}])
        text(s, x + 0.32, 4.55, 3.25, 1.2, [{"t": body, "s": 16, "c": MUTED}])


def solucion(prs):
    s = new_slide(prs)
    chrome(s, "Solución", "Se elige con datos y el pago se retiene", "La aplicación, el sitio y la consola muestran el mismo pedido.")
    footer(s, 3)
    items = [
        ("01", "Cercanía, nota y tarifa", "El catálogo ordena con esos tres datos."),
        ("02", "El dinero espera", "El pago se retiene hasta la conformidad."),
        ("03", "Un solo pedido", "Las tres pantallas leen la misma información."),
    ]
    for i, (n, title, body) in enumerate(items):
        x = 0.62 + i * 4.15
        box(s, x, 2.15, 3.9, 4.2, WHITE, LINE, 0.08)
        box(s, x, 2.15, 3.9, 0.12, ORANGE, radius=0.0)
        text(s, x + 0.32, 2.55, 3.2, 0.7, [{"t": n, "s": 28, "c": ORANGE, "b": True}])
        text(s, x + 0.32, 3.4, 3.25, 1.15, [{"t": title, "s": 24, "c": NAVY, "b": True}])
        text(s, x + 0.32, 4.7, 3.25, 1.1, [{"t": body, "s": 16, "c": MUTED}])


def clientes(prs):
    s = new_slide(prs)
    chrome(s, "Producto", "Tres clientes, un mismo pedido", "La captura es la portada real de myworksapp.cl.")
    footer(s, 4)
    s.shapes.add_picture(str(ROOT / "portada_web_slide.png"), Inches(0.55), Inches(1.7), Inches(7.55), Inches(4.72))
    items = [
        ("App Flutter", "La usan el cliente y el profesional."),
        ("Web en Vercel", "Ahí se busca el oficio y se reserva."),
        ("Consola Tauri", "Verifica, media y revisa la operación."),
    ]
    for i, (title, body) in enumerate(items):
        y = 1.7 + i * 1.58
        box(s, 8.35, y, 4.4, 1.45, WHITE, LINE, 0.12)
        oval(s, 8.55, y + 0.48, 0.22, 0.22, ORANGE)
        text(s, 8.95, y + 0.22, 3.55, 0.45, [{"t": title, "s": 18, "c": NAVY, "b": True}])
        text(s, 8.95, y + 0.7, 3.55, 0.5, [{"t": body, "s": 14, "c": MUTED}])


def infraestructura(prs):
    s = new_slide(prs)
    chrome(s, "Infraestructura", "El teléfono no cobra", "El pago se procesa en el servidor.")
    footer(s, 5)
    clients = ["App Flutter", "Web en Vercel", "Consola Tauri"]
    xs = [0.7, 4.9, 9.1]
    for x, name in zip(xs, clients):
        box(s, x, 1.75, 3.5, 1.15, WHITE, LINE, 0.16)
        text(s, x, 1.75, 3.5, 1.15, [{"t": name, "s": 18, "c": NAVY, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    # Bus y bajadas.
    rule(s, 2.45, 3.22, 8.4, NAVY2, 2.25)
    for x in xs:
        vrule(s, x + 1.75, 2.9, 3.22, NAVY2, 2.25)
    vrule(s, 6.66, 3.22, 3.55, NAVY2, 2.25)
    box(s, 1.9, 3.55, 9.5, 1.85, WHITE, NAVY, 0.1, 1.75)
    text(s, 2.15, 3.7, 9.0, 0.45, [{"t": "Supabase", "s": 22, "c": NAVY, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER)
    chips = ["PostgreSQL", "Auth", "Funciones de pago"]
    for i, name in enumerate(chips):
        cx = 2.25 + i * 3.0
        box(s, cx, 4.35, 2.75, 0.72, SOFT, radius=0.4)
        text(s, cx, 4.35, 2.75, 0.72, [{"t": name, "s": 15, "c": NAVY, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    vrule(s, 6.66, 5.4, 5.75, ORANGE, 2.25)
    box(s, 4.55, 5.75, 4.2, 0.95, NAVY, radius=0.4)
    text(s, 4.55, 5.75, 4.2, 0.95, [{"t": "Transbank", "s": 20, "c": WHITE, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def uso(prs):
    s = new_slide(prs)
    chrome(s, "Uso", "Del oficio al pago retenido")
    footer(s, 6)
    s.shapes.add_picture(str(ROOT / "video_poster_slide.png"), Inches(0.55), Inches(1.55), Inches(7.7), Inches(4.33))
    text(s, 0.7, 6.0, 7.3, 0.35, [{"t": "2 min 11 s    ·    con voz    ·    hasta el pago retenido", "s": 14, "c": MUTED}])
    box(s, 8.5, 1.7, 4.25, 4.7, WHITE, LINE, 0.08)
    text(s, 8.8, 2.0, 3.7, 0.4, [{"t": "EN LA SALA", "s": 13, "c": ORANGE, "b": True}])
    text(s, 8.8, 2.5, 3.7, 2.2, [{"t": "El video muestra\nel recorrido.", "s": 26, "c": NAVY, "b": True}])
    text(s, 8.8, 4.9, 3.7, 1.1, [{"t": "Después se repite\nen vivo.", "s": 20, "c": INK}])


def recorrido(prs):
    s = new_slide(prs)
    chrome(s, "Demostración", "El mismo camino, en vivo", "Se recorre otra vez, del oficio a la conformidad.")
    footer(s, 7)
    steps = ["Oficio", "Hora", "Pago", "PIN", "Foto", "Conforme"]
    rule(s, 1.15, 3.55, 11.0, LINE, 4)
    for i, name in enumerate(steps):
        x = 0.85 + i * 2.05
        oval(s, x + 0.42, 3.15, 0.8, 0.8, ORANGE if i in (2, 5) else NAVY)
        text(s, x + 0.42, 3.15, 0.8, 0.8, [{"t": str(i + 1), "s": 20, "c": WHITE, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x, 4.15, 1.65, 0.45, [{"t": name, "s": 16, "c": NAVY, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER)


def pago(prs):
    s = new_slide(prs)
    chrome(s, "Pago", "La tarjeta sirve para el pedido siguiente", "Ambiente de integración, con tarjetas de prueba.")
    footer(s, 8)
    items = [
        ("01", "Se reutiliza", "El primer pago inscribe la tarjeta."),
        ("02", "Invitado", "Quien no tiene cuenta paga en Webpay."),
        ("03", "Cobro adicional", "El cliente lo aprueba y el trabajo sigue."),
        ("04", "Correo", "Cuando el pago entra, llega el aviso."),
    ]
    for i, (n, title, body) in enumerate(items):
        x = 0.55 + (i % 4) * 3.2
        box(s, x, 2.15, 3.02, 4.15, WHITE, LINE, 0.1)
        text(s, x + 0.22, 2.45, 2.5, 0.55, [{"t": n, "s": 22, "c": ORANGE, "b": True}])
        text(s, x + 0.22, 3.25, 2.55, 1.2, [{"t": title, "s": 22, "c": NAVY, "b": True}])
        text(s, x + 0.22, 4.6, 2.55, 1.2, [{"t": body, "s": 15, "c": MUTED}])


def disputa(prs):
    s = new_slide(prs)
    chrome(s, "Disputa", "La misma disputa en los tres", "La consola, el cliente y el trabajador leen una sola fila.")
    footer(s, 9)
    box(s, 4.35, 1.7, 4.6, 1.05, NAVY, radius=0.18)
    text(s, 4.35, 1.7, 4.6, 1.05, [{"t": "Una sola fila", "s": 24, "c": WHITE, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    rule(s, 2.55, 3.05, 8.4, ORANGE, 2.25)
    vrule(s, 6.65, 2.75, 3.05, ORANGE, 2.25)
    labels = [("Consola", "Quien administra"), ("App del cliente", "Quien reclama"), ("App del trabajador", "La otra parte")]
    for i, (title, body) in enumerate(labels):
        x = 0.7 + i * 4.2
        vrule(s, x + 1.85, 3.05, 3.4, ORANGE, 2.25)
        box(s, x, 3.4, 3.7, 2.75, WHITE, LINE, 0.1)
        oval(s, x + 1.55, 3.75, 0.55, 0.55, SOFT)
        text(s, x + 0.25, 4.5, 3.2, 0.55, [{"t": title, "s": 20, "c": NAVY, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER)
        text(s, x + 0.25, 5.1, 3.2, 0.55, [{"t": body, "s": 15, "c": MUTED, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER)


def objetivos(prs):
    s = new_slide(prs)
    chrome(s, "Objetivos", "Lo que el proyecto se fijó")
    footer(s, 10)
    goals = [
        ("80 %", "Al menos el 80 % de los usuarios completa la contratación en menos de 10 minutos."),
        ("100 %", "El 100 % de los pagos de prueba queda retenido hasta la conformidad."),
        ("100 %", "El 100 % de las tablas con seguridad por fila y sin accesos indebidos."),
        ("≤ 5 min", "La reserva, desde abrir la plataforma hasta confirmar, con mediana de 5 minutos o menos."),
    ]
    for i, (metric, sentence) in enumerate(goals):
        y = 1.4 + i * 1.35
        box(s, 0.55, y, 8.15, 1.22, WHITE, LINE, 0.12)
        text(s, 0.75, y, 1.7, 1.22, [{"t": metric, "s": 22, "c": ORANGE, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        text(s, 2.5, y + 0.18, 5.95, 0.9, [{"t": sentence, "s": 15, "c": INK}], anchor=MSO_ANCHOR.MIDDLE)
    box(s, 8.9, 1.4, 3.9, 5.28, NAVY, radius=0.1)
    text(s, 9.15, 1.65, 3.4, 0.4, [{"t": "LO QUE YA SE VIO", "s": 13, "c": ORANGE, "b": True}])
    text(
        s, 9.15, 2.3, 3.4, 3.8,
        [{"t": "Las tablas tienen seguridad por fila; en la prueba de carga de noviembre no hubo fallas, y los pagos de prueba quedan retenidos.", "s": 18, "c": WHITE}],
    )


def scrum(prs):
    s = new_slide(prs)
    chrome(s, "Metodología", "Trabajamos con Scrum")
    footer(s, 11)
    roles = [
        ("Mathias Jara", "Product Owner y Scrum Master"),
        ("Nicolás Chiguay", "Desarrollo"),
        ("Gabriel Valderas", "Desarrollo"),
    ]
    for i, (name, role) in enumerate(roles):
        x = 0.55 + i * 4.2
        box(s, x, 1.35, 4.0, 1.05, WHITE, LINE, 0.14)
        oval(s, x + 0.18, 1.68, 0.18, 0.18, ORANGE)
        text(s, x + 0.5, 1.45, 3.3, 0.42, [{"t": name, "s": 16, "c": NAVY, "b": True}])
        text(s, x + 0.5, 1.85, 3.3, 0.35, [{"t": role, "s": 13, "c": MUTED}])
    box(s, 0.55, 2.6, 8.15, 2.55, WHITE, LINE, 0.08)
    text(s, 0.75, 2.72, 4, 0.3, [{"t": "Tablero en GitHub Projects", "s": 12, "c": MUTED}])
    columns = [
        ("Por hacer", []),
        ("En curso", ["Defensa"]),
        ("Listo", ["Reserva", "Pago retenido", "Pruebas"]),
    ]
    for i, (title, cards) in enumerate(columns):
        x = 0.75 + i * 2.6
        text(s, x, 3.08, 2.4, 0.32, [{"t": title, "s": 14, "c": NAVY, "b": True}])
        if not cards:
            box(s, x, 3.5, 2.4, 1.35, CREAM, LINE, 0.12)
        for j, card in enumerate(cards):
            box(s, x, 3.48 + j * 0.5, 2.4, 0.44, SOFT if title != "Listo" else GSOFT, radius=0.2)
            text(s, x + 0.12, 3.48 + j * 0.5, 2.16, 0.44, [{"t": card, "s": 13, "c": INK}], anchor=MSO_ANCHOR.MIDDLE)
    chips = [
        ("Daily", "Por Discord"),
        ("Fin de semana", "Revisión y retrospectiva"),
        ("Sprints", "De una o dos semanas"),
        ("Terminado", "Funciona, otro lo revisa y las pruebas cierran"),
    ]
    for i, (title, body) in enumerate(chips):
        x = 0.55 + (i % 2) * 4.2
        y = 5.3 + (i // 2) * 0.85
        # The board is on the left; put the four facts in a right column instead.
    # Right column replaces the loop above. Clearer: draw them explicitly.
    facts = [
        ("Daily", "Por Discord, en los días de trabajo."),
        ("Fin de semana", "Revisión y retrospectiva."),
        ("Sprints", "De una o dos semanas."),
        ("Terminado", "Funciona, otro lo revisa, y las pruebas cierran."),
    ]
    for i, (title, body) in enumerate(facts):
        y = 2.6 + i * 1.05
        box(s, 8.9, y, 3.9, 0.95, WHITE, LINE, 0.14)
        text(s, 9.1, y + 0.08, 3.5, 0.36, [{"t": title, "s": 15, "c": NAVY, "b": True}])
        text(s, 9.1, y + 0.44, 3.5, 0.42, [{"t": body, "s": 12, "c": MUTED}])


def avance(prs):
    s = new_slide(prs)
    chrome(s, "Avance", "Tres momentos, ya entregados", "Cada momento quedó entregado.")
    footer(s, 12)
    rule(s, 1.7, 3.55, 9.9, LINE, 4)
    items = [
        ("1", "Problema y alcance", "Se definió qué había que resolver."),
        ("2", "Construcción", "Aplicación, sitio, consola y pago."),
        ("3", "Pruebas y defensa", "Se hicieron las pruebas y esta defensa."),
    ]
    for i, (n, title, body) in enumerate(items):
        x = 0.85 + i * 4.15
        oval(s, x + 1.25, 3.15, 0.8, 0.8, ORANGE if i == 2 else NAVY)
        text(s, x + 1.25, 3.15, 0.8, 0.8, [{"t": n, "s": 22, "c": WHITE, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x, 4.2, 3.4, 0.55, [{"t": title, "s": 18, "c": NAVY, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER)
        text(s, x, 4.8, 3.4, 0.8, [{"t": body, "s": 15, "c": MUTED, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER)


def modelo(prs):
    s = new_slide(prs)
    bg(s)
    # La imagen ocupa la lámina. El fondo claro coincide con el diagrama.
    s.shapes.add_picture(str(ER), Inches(0.15), Inches(0.08), Inches(13.03), Inches(7.05))
    text(
        s, 11.55, 7.12, 1.5, 0.28,
        [{"t": "13", "s": 12, "c": NAVY, "b": True, "align": PP_ALIGN.RIGHT}],
        align=PP_ALIGN.RIGHT,
    )


def tablas(prs):
    s = new_slide(prs)
    chrome(s, "Datos", "Tres tablas mandan")
    footer(s, 14)
    # esquemas mínimos
    specs = [
        ("perfiles", [((0.35, 0.85), "Persona"), ((1.85, 0.85), "Rol")], [(1.35, 1.15, 1.85, 1.15)], "Quién es la persona y su rol. Sin esto no hay cliente ni profesional."),
        ("trabajos", [((0.2, 0.85), "Cliente"), ((1.45, 0.85), "Pedido"), ((2.7, 0.85), "Profesional")], [(1.15, 1.15, 1.45, 1.15), (2.4, 1.15, 2.7, 1.15)], "Une al cliente con el profesional, la fecha y el estado. Es el centro del flujo."),
        ("pagos", [((0.35, 0.85), "Monto"), ((1.9, 0.85), "Retenido")], [(1.3, 1.15, 1.9, 1.15)], "El dinero queda retenido hasta la conformidad. Sin esta tabla no hay garantía."),
    ]
    for i, (name, nodes, arrows, caption) in enumerate(specs):
        x = 0.45 + i * 4.28
        box(s, x, 1.45, 4.1, 4.15, WHITE, LINE, 0.08)
        text(s, x + 0.2, 1.6, 3.7, 0.4, [{"t": name, "s": 20, "c": ORANGE, "b": True}])
        for (nx, ny), label in nodes:
            box(s, x + nx, 1.45 + ny, 1.15 if name != "trabajos" else 1.05, 0.62, SOFT if label != "Pedido" else NAVY, radius=0.18)
            color = NAVY if label != "Pedido" else WHITE
            text(s, x + nx, 1.45 + ny, 1.15 if name != "trabajos" else 1.05, 0.62, [{"t": label, "s": 12, "c": color, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        for x1, y1, x2, y2 in arrows:
            rule(s, x + x1, 1.45 + y1, x2 - x1, ORANGE, 2.25)
        text(s, x + 0.22, 4.15, 3.7, 1.15, [{"t": caption, "s": 14, "c": INK}])
    text(
        s, 0.55, 5.75, 12.2, 1.05,
        [
            {"t": "Esas tres mandan. El resto cuelga de ellas:", "s": 16, "c": NAVY, "b": True},
            {"t": "mensajes, evidencia, calificación, disputa, horarios y direcciones.", "s": 16, "c": NAVY, "b": True, "before": 2},
        ],
    )


def orden(prs):
    s = new_slide(prs)
    chrome(s, "Modelo", "Cada dato vive en su tabla", "Si un dato cambia, se cambia en un solo lugar.")
    footer(s, 15)
    box(s, 4.55, 2.55, 3.3, 1.7, NAVY, radius=0.1)
    text(s, 4.55, 2.75, 3.3, 0.7, [{"t": "Ficha", "s": 26, "c": WHITE, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER)
    text(s, 4.55, 3.4, 3.3, 0.5, [{"t": "el profesional", "s": 14, "c": RGBColor(0xFF, 0xD8, 0xC2), "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER)
    sats = [("Servicios", 0.7, 2.28), ("Precios", 0.7, 3.55), ("Horarios", 9.3, 2.95)]
    for name, x, y in sats:
        box(s, x, y, 2.7, 1.15, WHITE, LINE, 0.16)
        text(s, x, y, 2.7, 1.15, [{"t": name, "s": 18, "c": NAVY, "b": True, "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    rule(s, 3.4, 2.85, 1.15, ORANGE, 2.5)
    rule(s, 3.4, 4.12, 1.15, ORANGE, 2.5)
    rule(s, 7.85, 3.52, 1.45, ORANGE, 2.5)
    box(s, 9.15, 5.35, 3.5, 1.2, GSOFT, radius=0.16)
    text(s, 9.3, 5.5, 3.2, 0.4, [{"t": "Seguridad por fila", "s": 16, "c": GREEN, "b": True}])
    text(s, 9.3, 5.95, 3.2, 0.4, [{"t": "En todas las tablas.", "s": 14, "c": INK}])


def cierre(prs):
    s = new_slide(prs)
    bg(s)
    bar(s)
    footer(s, 16)
    text(s, 0.8, 1.7, 11.5, 0.35, [{"t": "PARA TERMINAR", "s": 14, "c": ORANGE, "b": True}])
    text(s, 0.8, 2.15, 11.5, 1.3, [{"t": "Elegir con datos.", "s": 48, "c": NAVY, "b": True}])
    text(s, 0.8, 3.5, 11.5, 1.2, [{"t": "El pago espera la conformidad.", "s": 36, "c": INK}])
    words = ["Cercanía", "Nota", "Garantía"]
    for i, word in enumerate(words):
        x = 0.8 + i * 3.3
        oval(s, x, 5.35, 0.22, 0.22, ORANGE)
        text(s, x + 0.4, 5.25, 2.6, 0.42, [{"t": word, "s": 20, "c": NAVY, "b": True}])


def preguntas(prs):
    s = new_slide(prs)
    bg(s)
    bar(s)
    text(s, 0.8, 1.55, 11.5, 0.35, [{"t": "MYWORKSAPP", "s": 14, "c": ORANGE, "b": True}])
    text(s, 0.8, 2.05, 12, 1.4, [{"t": "Preguntas\nde la comisión", "s": 54, "c": NAVY, "b": True}])
    text(s, 0.8, 4.7, 8, 0.5, [{"t": "Gracias.", "s": 24, "c": INK}])
    text(s, 0.8, 5.35, 10, 0.4, [{"t": "Mathias indica quién responde.", "s": 18, "c": MUTED}])
    text(s, 0.8, 6.45, 11, 0.35, [{"t": "Mathias Jara    ·    Nicolás Chiguay    ·    Gabriel Valderas", "s": 16, "c": NAVY}])


def build_pptx():
    prepare_images()
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)
    prs.core_properties.title = "MyWorksApp — Defensa final"
    prs.core_properties.author = "Mathias Jara, Nicolás Chiguay, Gabriel Valderas"
    prs.core_properties.subject = "Capstone PTY4614"
    builders = [
        portada, problema, solucion, clientes, infraestructura, uso, recorrido,
        pago, disputa, objetivos, scrum, avance, modelo, tablas, orden, cierre, preguntas,
    ]
    for build in builders:
        build(prs)
    prs.save(PPTX)
    print(f"pptx {PPTX} slides {len(builders)}")


def shade(cell, hex_color):
    tc = cell._tePr if hasattr(cell, "_tePr") else cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(dqn("w:fill"), hex_color)
    shd.set(dqn("w:val"), "clear")
    tcPr.append(shd)


def set_run(paragraph, text, size=12, bold=False, color=None, font="Calibri"):
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.space_before = Pt(0)
    r = paragraph.add_run()
    r.text = text
    r.bold = bold
    r.font.size = Pt(size)
    r.font.name = font
    if color:
        r.font.color.rgb = color
    return r


def build_pauta():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Cm(1.6)
    section.bottom_margin = Cm(1.6)
    section.left_margin = Cm(1.7)
    section.right_margin = Cm(1.7)
    title = doc.add_paragraph()
    set_run(title, "Pauta de presentación y demo · MyWorksApp", 18, True, DocxRGB(0x00, 0x20, 0x5B))
    sub = doc.add_paragraph()
    set_run(
        sub,
        "Defensa final Capstone · Duoc UC Puerto Montt · PTY4614 · 17 láminas en 20 minutos. La última es Preguntas de la comisión.",
        11,
        False,
        DocxRGB(0x5C, 0x63, 0x70),
    )
    h = doc.add_paragraph()
    set_run(h, "1. Orden de exposición", 14, True, DocxRGB(0x00, 0x20, 0x5B))
    p = doc.add_paragraph()
    set_run(
        p,
        "Habla una sola persona a la vez. Quien termina su bloque pasa la palabra con una frase breve. La defensa dura 20 minutos, con el video y la repetición en vivo. Se expone hasta la lámina 17 y ahí se detiene.",
        11,
    )
    rows = [
        ("#", "Bloque", "Lámina", "Expone", "Tiempo"),
        ("1", "Portada", "1", "Mathias Jara", "0:40 · 0:00"),
        ("2", "Problema", "2", "Mathias Jara", "1:00 · 0:40"),
        ("3", "Solución", "3", "Mathias Jara", "1:00 · 1:40"),
        ("4", "Tres clientes", "4", "Gabriel Valderas", "0:50 · 2:40"),
        ("5", "Infraestructura", "5", "Gabriel Valderas", "1:00 · 3:30"),
        ("6", "Uso, con el video", "6", "Mathias Jara", "2:30 · 4:30"),
        ("7", "Recorrido en vivo", "7", "Mathias y Gabriel", "2:40 · 7:00"),
        ("8", "Pago", "8", "Mathias Jara", "0:55 · 9:40"),
        ("9", "Disputa", "9", "Nicolás Chiguay", "0:50 · 10:35"),
        ("10", "Objetivos", "10", "Mathias Jara", "1:40 · 11:25"),
        ("11", "Scrum", "11", "Mathias Jara", "1:10 · 13:05"),
        ("12", "Avance", "12", "Nicolás Chiguay", "0:45 · 14:15"),
        ("13", "Modelo entidad-relación", "13", "Gabriel Valderas", "1:15 · 15:00"),
        ("14", "Tres tablas", "14", "Gabriel Valderas", "1:30 · 16:15"),
        ("15", "Orden del modelo", "15", "Gabriel Valderas", "0:55 · 17:45"),
        ("16", "Cierre", "16", "Mathias Jara", "0:40 · 18:40"),
        ("17", "Preguntas de la comisión", "17", "Mathias asigna", "0:40 · 19:20"),
    ]
    table = doc.add_table(rows=len(rows), cols=5)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    widths = [Cm(1.2), Cm(5.4), Cm(2.0), Cm(4.2), Cm(3.6)]
    for i, row in enumerate(rows):
        for j, value in enumerate(row):
            cell = table.rows[i].cells[j]
            cell.text = ""
            paragraph = cell.paragraphs[0]
            set_run(
                paragraph,
                value,
                10,
                bold=(i == 0),
                color=DocxRGB(0xFF, 0xFF, 0xFF) if i == 0 else DocxRGB(0x12, 0x14, 0x1A),
            )
            cell.width = widths[j]
            if i == 0:
                shade(cell, "00205B")
    h = doc.add_paragraph()
    set_run(h, "2. El video y la repetición en vivo", 14, True, DocxRGB(0x00, 0x20, 0x5B))
    p = doc.add_paragraph()
    set_run(
        p,
        "En la lámina 6 se dice: «El video muestra el recorrido, del oficio al pago retenido.» Se reproduce Fase 2/video/myworksapp_presentacion.mp4. Dura 2 minutos 11 segundos y tiene voz. Al terminar, en la lámina 7 se repite el mismo camino en vivo. Antes de empezar, el sitio y la aplicación quedan con la sesión iniciada, y el archivo listo para reproducir.",
        11,
    )
    h = doc.add_paragraph()
    set_run(h, "3. Dos pantallas, un rol por pantalla", 14, True, DocxRGB(0x00, 0x20, 0x5B))
    p = doc.add_paragraph()
    set_run(p, "Proyector, cliente: el sitio myworksapp.cl. Lo opera Mathias Jara. Segunda pantalla, trabajador: la aplicación del profesional, con Enlace Móvil o scrcpy. Lo opera Gabriel Valderas. En Windows: Win + P y Extender. Cada ventana permanece en su pantalla, con el rótulo CLIENTE o TRABAJADOR.", 11)
    h = doc.add_paragraph()
    set_run(h, "4. Guion de la demostración", 14, True, DocxRGB(0x00, 0x20, 0x5B))
    for line in [
        "1. El cliente busca el oficio y compara cercanía, nota y tarifa.",
        "2. Reserva el día y la hora, y confirma el pedido.",
        "3. Paga en Webpay, en el ambiente de integración. El pago se retiene. Si la tarjeta ya está inscrita, el pedido siguiente la reutiliza. Quien entra como invitado paga en Webpay.",
        "4. El profesional inicia con el PIN y deja la foto del trabajo.",
        "5. En un pedido de demostración ya terminado, el cliente marca «Recibo conforme» y el pago se libera.",
        "6. Si Transbank se demora, se usa el pedido que ya está retenido. Habla quien opera.",
        "En la lámina de la disputa, mostrar el mismo caso en la consola, en la aplicación del cliente y en la del trabajador. El caso de demostración es el de Camila Soto y María Fuentes.",
    ]:
        item = doc.add_paragraph()
        set_run(item, line, 11)
    h = doc.add_paragraph()
    set_run(h, "5. Reglas para hablar", 14, True, DocxRGB(0x00, 0x20, 0x5B))
    for line in [
        "Una voz a la vez. No completar ni corregir en voz alta al compañero.",
        "En las preguntas, Mathias Jara indica quién responde: producto y pagos, Mathias; metodología y avance, Mathias y Nicolás; datos, seguridad y modelo, Gabriel; pruebas y documentación, Nicolás.",
    ]:
        item = doc.add_paragraph()
        set_run(item, line, 11)
    h = doc.add_paragraph()
    set_run(h, "6. Lista para el día anterior", 14, True, DocxRGB(0x00, 0x20, 0x5B))
    for line in [
        "Ensayo cronometrado de las 17 láminas en 20 minutos, con el video y la demostración.",
        "Tener a mano Fase 2/video/myworksapp_presentacion.mp4 y reproducirlo en la lámina 6.",
        "Presentación en pptx y en pdf, guardada en el computador.",
        "Teléfono del trabajador con la aplicación, cargado y con la sesión del profesional iniciada.",
        "Sesión del cliente iniciada en el sitio, y sesión de administración iniciada en la consola.",
        "Datos de la tarjeta de prueba anotados. El ambiente es el de integración.",
        "Pedido de demostración listo para marcar «Recibo conforme».",
        "Disputa de Camila Soto y María Fuentes lista para abrirla en la consola y en las dos aplicaciones.",
        "scrcpy o Enlace Móvil probados. Cable de datos y adaptador HDMI en la mochila.",
        "Internet de la sala probado, y un punto de acceso móvil de respaldo.",
        "Notificaciones en silencio. Brillo al máximo. El sitio myworksapp.cl cargado antes de empezar.",
    ]:
        item = doc.add_paragraph()
        set_run(item, "☐   " + line, 11)
    end = doc.add_paragraph()
    set_run(
        end,
        "Pauta de la defensa final. Diecisiete láminas, veinte minutos. La lámina 17 es Preguntas de la comisión y no hay láminas después.",
        11,
        True,
        DocxRGB(0x00, 0x20, 0x5B),
    )
    doc.save(PAUTA)
    print(f"pauta {PAUTA}")


if __name__ == "__main__":
    build_pptx()
    build_pauta()
