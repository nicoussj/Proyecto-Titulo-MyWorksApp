# -*- coding: utf-8 -*-
"""Figuras A-12..A-14: consola, IA y evidencia (corte 80).

Sin título «Figura A-…» en el PNG (el Informe ya lo escribe).
Una imagen por figura, tablas repartidas en hoja apaisada.
"""
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent / "figuras"
OUT.mkdir(exist_ok=True)
FONT = "DejaVu Sans"
# Área útil aprox. de página apaisada del anexo (pt)
W_PT, H_PT = 678, 414


def esc(s):
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def nodo(nombre, color, bg, cols):
    rows = [
        f'<tr><td colspan="3" bgcolor="{color}" align="left">'
        f'<font color="white" point-size="11"><b>{esc(nombre)}</b></font></td></tr>'
    ]
    for tag, col, ty in cols:
        name = (
            f"<b><u>{esc(col)}</u></b>"
            if "PK" in tag
            else (f"<i>{esc(col)}</i>" if "FK" in tag else esc(col))
        )
        cbg = bg if tag.strip() else "white"
        rows.append(
            "<tr>"
            f'<td align="left" bgcolor="{cbg}"><font point-size="9" color="#555555">{esc(tag or " ")}</font></td>'
            f'<td align="left" bgcolor="{cbg}"><font point-size="10">{name}</font></td>'
            f'<td align="left" bgcolor="{cbg}"><font point-size="9" color="#444444">{esc(ty)}</font></td>'
            "</tr>"
        )
    return (
        f'"{nombre}" [label=<<table border="1" cellborder="0" cellspacing="0" '
        f'cellpadding="1" color="{color}">'
        + "".join(rows)
        + "</table>>];"
    )


def externo(nombre, color="#7F7F7F"):
    """Tabla de otro dominio (referencia)."""
    return (
        f'"{nombre}" [label=<<table border="1" cellborder="0" cellspacing="0" '
        f'cellpadding="2" color="{color}" style="dashed">'
        f'<tr><td bgcolor="#EFEFEF"><font point-size="10" color="#333333"><b>{esc(nombre)}</b></font></td></tr>'
        f'<tr><td><font point-size="9" color="#555555">en otra figura</font></td></tr>'
        f"</table>>];"
    )


def grid_ranks(names, cols):
    """Fuerza filas horizontales con edges invisibles."""
    lines = []
    for i in range(0, len(names), cols):
        row = names[i : i + cols]
        lines.append("{ rank=same; " + " ".join(f'"{n}"' for n in row) + " }")
        for a, b in zip(row, row[1:]):
            lines.append(f'"{a}" -> "{b}" [style="invis", dir="none"];')
    # vertical glue between first of each row
    firsts = [names[i] for i in range(0, len(names), cols)]
    for a, b in zip(firsts, firsts[1:]):
        lines.append(f'"{a}" -> "{b}" [style="invis", dir="none", weight="10"];')
    return lines


def size_pt(dot: str):
    svg = subprocess.run(
        ["dot", "-Tsvg"], input=dot, capture_output=True, text=True, check=True
    ).stdout
    import re

    w = float(re.search(r'width="([\d.]+)pt"', svg).group(1))
    h = float(re.search(r'height="([\d.]+)pt"', svg).group(1))
    return w, h


def render(name, color, bg, tables, edges, wrap=3, externals=None):
    externals = externals or []
    names = [t[0] for t in tables]
    best = None
    for rd, wr in (("TB", wrap), ("TB", wrap + 1), ("LR", wrap), ("LR", 2)):
        lines = [
            "digraph x {",
            f'graph [fontname="{FONT}", bgcolor="white", pad="0.08", nodesep="0.35", '
            f'ranksep="0.45", splines="spline", rankdir="{rd}", labelloc="t", labeljust="l"];',
            f'node [shape=plaintext, fontname="{FONT}"];',
            f'edge [fontname="{FONT}", color="{color}", penwidth="1.3", arrowsize="0.8", dir="both"];',
        ]
        for t, cols in tables:
            lines.append(nodo(t, color, bg, cols))
        for ext in externals:
            lines.append(externo(ext))
        for a, b, lab in edges:
            lines.append(
                f'"{a}" -> "{b}" [arrowtail="crowodot", arrowhead="teetee",'
                f' label=<<font point-size="9" color="#555555">{esc(lab)}</font>>];'
            )
        # Solo aplicar grid a nodos sin arista real, o a todos si hay pocas aristas
        connected = {x for a, b, _ in edges for x in (a, b)}
        sueltas = [n for n in names if n not in connected]
        if len(sueltas) >= 2:
            lines.extend(grid_ranks(sueltas, wr))
        elif len(edges) == 0:
            lines.extend(grid_ranks(names, wr))
        lines.append("}")
        dot = "\n".join(lines)
        w, h = size_pt(dot)
        # Preferir apaisado que quepa o se acerque al área de página
        score = abs(w / h - W_PT / H_PT) + (0 if w <= W_PT * 1.15 and h <= H_PT * 1.25 else 5)
        if best is None or score < best[0]:
            best = (score, rd, wr, w, h, dot)

    _, rd, wr, w, h, dot = best
    (OUT / f"{name}.dot").write_text(dot, encoding="utf-8")
    subprocess.run(
        ["dot", "-Tsvg", "-o", str(OUT / f"{name}.svg")], input=dot, text=True, check=True
    )
    subprocess.run(
        ["dot", "-Tpng", "-Gdpi=200", "-o", str(OUT / f"{name}.png")],
        input=dot,
        text=True,
        check=True,
    )
    print(f"wrote {name} rankdir={rd} wrap={wr} size_pt={round(w)}x{round(h)}")


# A-12 consola seguridad (sin título en imagen)
render(
    "er80_12_consola_seguridad",
    "#5B6E7A",
    "#E8EEF2",
    [
        ("bloqueos_ip", [("PK", "id", "uuid"), ("", "ip", "text"), ("", "activo", "bool")]),
        ("eventos_acceso", [("PK", "id", "uuid"), ("", "tipo", "text")]),
        ("incidentes_seguridad", [("PK", "id", "uuid"), ("", "severidad", "text")]),
        ("pruebas_seguridad", [("PK", "id", "uuid"), ("", "resultado", "text")]),
        ("respaldos_consola", [("PK", "id", "uuid"), ("", "sha256", "text")]),
        ("ticket_mensajes", [("PK", "id", "uuid"), ("FK", "id_ticket", "text")]),
        ("umbrales_seguridad", [("PK", "clave", "text"), ("", "valor", "int")]),
    ],
    [("ticket_mensajes", "tickets_soporte", "id_ticket")],
    wrap=4,
    externals=["tickets_soporte"],
)

# A-13 IA
render(
    "er80_13_inteligencia_artificial",
    "#3F6F5A",
    "#E6F0EA",
    [
        ("cola_moderacion", [("PK", "id", "uuid"), ("", "id_mensaje", "text")]),
        ("eventos", [("PK", "id", "uuid"), ("", "tipo", "text"), ("", "metadata", "jsonb")]),
        ("ia_banderas", [("PK", "clave", "text"), ("", "activa", "bool")]),
        ("ia_cambios_banco", [("PK", "id", "uuid"), ("", "user_id", "uuid")]),
        ("ia_cola_embeddings", [("PK", "id", "bigint"), ("", "estado", "text")]),
        ("ia_huellas", [("PK", "id", "uuid"), ("", "device_hash", "text")]),
        ("ia_pesos_busqueda", [("PK", "clave", "text"), ("", "peso", "numeric")]),
        ("ia_resumen_resenas", [("PK", "id_profesional", "uuid"), ("", "n_resenas", "int")]),
        ("ia_sugerencias_perfil", [("PK", "id", "uuid"), ("", "estado", "text")]),
    ],
    [],
    wrap=3,
)

# A-14 evidencia — fila de tablas nuevas arriba, referencias abajo
def render_a14():
    color, bg = "#7A4E3A", "#F3EBE6"
    tables = [
        (
            "evidencia_nonces",
            [("PK", "id", "uuid"), ("", "nonce", "text"), ("", "id_trabajo", "text")],
        ),
        (
            "evidencia_procedencia",
            [("PK", "id", "uuid"), ("FK", "id_foto", "text"), ("", "confianza", "text")],
        ),
        (
            "alertas_evidencia",
            [("PK", "id", "uuid"), ("", "tipo", "text"), ("", "hash_perceptual", "text")],
        ),
        (
            "reembolsos_automaticos",
            [("PK", "id_disputa", "text"), ("", "estado", "text"), ("", "id_pago", "text")],
        ),
    ]
    lines = [
        "digraph x {",
        f'graph [fontname="{FONT}", bgcolor="white", pad="0.08", nodesep="0.4", '
        f'ranksep="0.55", splines="spline", rankdir="TB", labelloc="t", labeljust="l"];',
        f'node [shape=plaintext, fontname="{FONT}"];',
        f'edge [fontname="{FONT}", color="{color}", penwidth="1.3", arrowsize="0.8", dir="both"];',
    ]
    for t, cols in tables:
        lines.append(nodo(t, color, bg, cols))
    lines.append(externo("fotos_trabajo"))
    lines.append(externo("disputas"))
    mains = [t[0] for t in tables]
    lines.append("{ rank=same; " + " ".join(f'"{n}"' for n in mains) + " }")
    for a, b in zip(mains, mains[1:]):
        lines.append(f'"{a}" -> "{b}" [style="invis", dir="none"];')
    lines.append('{ rank=same; "fotos_trabajo" "disputas" }')
    lines.append('"fotos_trabajo" -> "disputas" [style="invis", dir="none"];')
    lines.append(
        '"evidencia_procedencia" -> "fotos_trabajo" [arrowtail="crowodot", arrowhead="teetee",'
        ' label=<<font point-size="9" color="#555555">id_foto</font>>];'
    )
    lines.append(
        '"reembolsos_automaticos" -> "disputas" [arrowtail="crowodot", arrowhead="teetee",'
        ' label=<<font point-size="9" color="#555555">id_disputa</font>>];'
    )
    lines.append("}")
    dot = "\n".join(lines)
    w, h = size_pt(dot)
    name = "er80_14_evidencia_disputas"
    (OUT / f"{name}.dot").write_text(dot, encoding="utf-8")
    subprocess.run(
        ["dot", "-Tsvg", "-o", str(OUT / f"{name}.svg")], input=dot, text=True, check=True
    )
    subprocess.run(
        ["dot", "-Tpng", "-Gdpi=200", "-o", str(OUT / f"{name}.png")],
        input=dot,
        text=True,
        check=True,
    )
    print(f"wrote {name} custom size_pt={round(w)}x{round(h)}")


render_a14()
