# -*- coding: utf-8 -*-
"""Figuras A-12..A-14: consola de seguridad, IA y evidencia (corte 80 tablas)."""
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent / "figuras"
OUT.mkdir(exist_ok=True)
FONT = "Helvetica"

def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))

def nodo(nombre, color, bg, cols):
    rows = [
        f'<tr><td colspan="3" bgcolor="{color}" align="left">'
        f'<font color="white" point-size="11"><b>{esc(nombre)}</b></font></td></tr>'
    ]
    for tag, col, ty in cols:
        name = f'<b><u>{esc(col)}</u></b>' if "PK" in tag else (
            f'<i>{esc(col)}</i>' if "FK" in tag else esc(col)
        )
        cbg = bg if tag.strip() else "white"
        rows.append(
            f'<tr>'
            f'<td align="left" bgcolor="{cbg}"><font point-size="9" color="#555555">{esc(tag or " ")}</font></td>'
            f'<td align="left" bgcolor="{cbg}"><font point-size="10">{name}</font></td>'
            f'<td align="left" bgcolor="{cbg}"><font point-size="9" color="#444444">{esc(ty)}</font></td>'
            f'</tr>'
        )
    return (
        f'"{nombre}" [label=<<table border="1" cellborder="0" cellspacing="0" cellpadding="1" color="{color}">'
        + "".join(rows) + "</table>>];"
    )

def render(name, title, color, bg, tables, edges):
    lines = [
        "digraph x {",
        f'graph [fontname="{FONT}", bgcolor="white", pad="0.08", nodesep="0.3", ranksep="0.45",'
        f' splines="spline", rankdir="LR", labelloc="t", labeljust="l",'
        f' label=<<font point-size="12"><b>{esc(title)}</b></font>>];',
        f'node [shape=plaintext, fontname="{FONT}"];',
        f'edge [fontname="{FONT}", color="{color}", penwidth="1.2", arrowsize="0.8", dir="both"];',
    ]
    for t, cols in tables:
        lines.append(nodo(t, color, bg, cols))
    for a, b, lab in edges:
        lines.append(
            f'"{a}" -> "{b}" [arrowtail="crow", arrowhead="none",'
            f' label=<<font point-size="9" color="#555555">{esc(lab)}</font>>];'
        )
    lines.append("}")
    dot = "\n".join(lines)
    (OUT / f"{name}.dot").write_text(dot, encoding="utf-8")
    subprocess.run(["dot", "-Tsvg", "-o", str(OUT / f"{name}.svg")], input=dot, text=True, check=True)
    subprocess.run(["dot", "-Tpng", "-Gdpi=200", "-o", str(OUT / f"{name}.png")], input=dot, text=True, check=True)
    print("wrote", name)

# A-12 consola seguridad
render(
    "er80_12_consola_seguridad",
    "Figura A-12. Consola y seguridad (tablas A-61 a A-67)",
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
        ("tickets_soporte", [("PK", "id", "text")]),
    ],
    [("ticket_mensajes", "tickets_soporte", "id_ticket")],
)

# A-13 IA
render(
    "er80_13_inteligencia_artificial",
    "Figura A-13. Inteligencia artificial (tablas A-68 a A-76)",
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
)

# A-14 evidencia
render(
    "er80_14_evidencia_disputas",
    "Figura A-14. Evidencia y disputas escalables (tablas A-77 a A-80)",
    "#7A4E3A",
    "#F3EBE6",
    [
        ("evidencia_nonces", [("PK", "id", "uuid"), ("", "nonce", "text"), ("", "id_trabajo", "text")]),
        ("evidencia_procedencia", [("PK", "id", "uuid"), ("", "id_foto", "text"), ("", "confianza", "text")]),
        ("alertas_evidencia", [("PK", "id", "uuid"), ("", "tipo", "text"), ("", "hash_perceptual", "text")]),
        ("reembolsos_automaticos", [("PK", "id_disputa", "text"), ("", "estado", "text"), ("", "id_pago", "text")]),
        ("fotos_trabajo", [("PK", "id", "text")]),
        ("disputas", [("PK", "id", "text")]),
    ],
    [
        ("evidencia_procedencia", "fotos_trabajo", "id_foto"),
        ("reembolsos_automaticos", "disputas", "id_disputa"),
    ],
)
