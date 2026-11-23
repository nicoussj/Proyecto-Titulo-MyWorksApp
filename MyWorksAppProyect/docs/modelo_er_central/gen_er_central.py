#!/usr/bin/env python3
"""Diagrama de las 12 tablas centrales de MyWorksApp.

Las cajas y las flechas están medidas para que ninguna relación cruce a otra.
La orden apunta al trabajo en el texto de su caja: dibujar esa flecha cruzaría
el chat. El markdown explica esa clave con su cardinalidad.
"""

import math
from pathlib import Path

import cairosvg

OUT = Path(__file__).resolve().parent

NAVY = "#1F4E79"
AMBER = "#8A4B08"
GREEN = "#1B6B43"
WINE = "#8C2F39"
SLATE = "#3E4651"
INK = "#1C2430"
MUTED = "#4E5963"

W, H = 1160, 980
BOX_W, BOX_H = 236, 124
GAP_X, GAP_Y = 168, 72
OX, OY = 52, 92


def esc(texto):
    return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def columnas():
    return [OX + i * (BOX_W + GAP_X) for i in range(3)]


def filas():
    return [OY + i * (BOX_H + GAP_Y) for i in range(4)]


def caja(x, y, titulo, sql, color, lineas):
    partes = [
        f'<rect x="{x}" y="{y}" width="{BOX_W}" height="{BOX_H}" rx="8" '
        f'fill="white" stroke="{color}" stroke-width="2"/>',
        f'<rect x="{x}" y="{y}" width="{BOX_W}" height="36" rx="8" fill="{color}"/>',
        f'<rect x="{x}" y="{y + 24}" width="{BOX_W}" height="12" fill="{color}"/>',
        f'<text x="{x + 12}" y="{y + 16}" fill="white" font-size="14" font-weight="700">'
        f"{esc(titulo)}</text>",
        f'<text x="{x + 12}" y="{y + 31}" fill="#F4F8FC" font-size="11">{esc(sql)}</text>',
    ]
    for i, linea in enumerate(lineas):
        peso = ' font-weight="700"' if linea.startswith("clave") else ""
        partes.append(
            f'<text x="{x + 12}" y="{y + 56 + i * 18}" fill="{INK}" font-size="12.5"{peso}>'
            f"{esc(linea)}</text>"
        )
    return "\n".join(partes)


def unit(dx, dy):
    n = math.hypot(dx, dy) or 1.0
    return dx / n, dy / n


def simbolo(x, y, ux, uy, tipo, color):
    """Dibuja la cardinalidad hacia afuera de la caja. Devuelve cuánto retrocede la línea."""
    px, py = -uy, ux
    partes = []
    if tipo == "n":
        # Tres dedos separados. El del medio llega más lejos para que no parezca una flecha.
        for lado, largo, grueso in ((-10, 13, 1.7), (0, 18, 2.4), (10, 13, 1.7)):
            partes.append(
                f'<line x1="{x + ux * 1:.1f}" y1="{y + uy * 1:.1f}" '
                f'x2="{x + ux * largo + px * lado:.1f}" y2="{y + uy * largo + py * lado:.1f}" '
                f'stroke="{color}" stroke-width="{grueso}" stroke-linecap="round"/>'
            )
        partes.append(
            f'<circle cx="{x + ux * 21:.1f}" cy="{y + uy * 21:.1f}" r="3.4" '
            f'fill="white" stroke="{color}" stroke-width="1.6"/>'
        )
        retro = 28
    elif tipo == "01":
        partes.append(
            f'<line x1="{x + ux * 3 + px * 7:.1f}" y1="{y + uy * 3 + py * 7:.1f}" '
            f'x2="{x + ux * 3 - px * 7:.1f}" y2="{y + uy * 3 - py * 7:.1f}" '
            f'stroke="{color}" stroke-width="2" stroke-linecap="round"/>'
        )
        partes.append(
            f'<circle cx="{x + ux * 13:.1f}" cy="{y + uy * 13:.1f}" r="3.4" '
            f'fill="white" stroke="{color}" stroke-width="1.6"/>'
        )
        retro = 20
    elif tipo == "1":
        partes.append(
            f'<line x1="{x + ux * 4 + px * 7:.1f}" y1="{y + uy * 4 + py * 7:.1f}" '
            f'x2="{x + ux * 4 - px * 7:.1f}" y2="{y + uy * 4 - py * 7:.1f}" '
            f'stroke="{color}" stroke-width="2" stroke-linecap="round"/>'
        )
        retro = 12
    else:
        raise ValueError(tipo)
    return "\n".join(partes), retro


def flecha(puntos, en_inicio, en_fin, color, trazo="solid"):
    """puntos[0] es la tabla hija (guarda la clave). puntos[-1] es la padre."""
    x0, y0 = puntos[0]
    x1, y1 = puntos[1]
    ux, uy = unit(x1 - x0, y1 - y0)
    marca0, retro0 = simbolo(x0, y0, ux, uy, en_inicio, color)
    xn, yn = puntos[-1]
    xp, yp = puntos[-2]
    vx, vy = unit(xn - xp, yn - yp)
    marca1, retro1 = simbolo(xn, yn, -vx, -vy, en_fin, color)
    ruta = [(x0 + ux * retro0, y0 + uy * retro0), *puntos[1:-1], (xn - vx * retro1, yn - vy * retro1)]
    d = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in ruta)
    dash = ' stroke-dasharray="5 4"' if trazo == "dashed" else ""
    return (
        f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.7"{dash} '
        f'stroke-linejoin="round" stroke-linecap="round"/>\n{marca0}\n{marca1}'
    )


def texto(x, y, cadena, color, size=12, peso="600", ancla="start"):
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" fill="{color}" font-size="{size}" '
        f'font-weight="{peso}" text-anchor="{ancla}">{esc(cadena)}</text>'
    )


def svg():
    c, r = columnas(), filas()
    mitad = BOX_H / 2

    def derecha(col, fila):
        return c[col] + BOX_W, r[fila] + mitad

    def izquierda(col, fila):
        return c[col], r[fila] + mitad

    def arriba(col, fila, dx):
        return c[col] + dx, r[fila]

    def abajo(col, fila, dx):
        return c[col] + dx, r[fila] + BOX_H

    partes = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        '<rect width="100%" height="100%" fill="white"/>',
        '<style>text { font-family: "Liberation Sans", "Nimbus Sans", sans-serif; }</style>',
        texto(36, 32, "MyWorksApp — tablas centrales del pedido", INK, 22, "700"),
        texto(36, 54, "Doce tablas. La pata de gallo está en la tabla que guarda la clave foránea.", MUTED, 13, "500"),
        texto(36, 74, "Raya = uno.   Círculo = puede no existir.   Pata de gallo = varios.", MUTED, 13, "500"),
    ]

    # Pasillos. Cada flecha usa el suyo y no entra en el de otra.
    pasillo_evidencia = c[1] - 36
    pasillo_calificacion = c[1] - 92
    margen = 18
    hueco_bajo_trabajo = r[1] + BOX_H + 22

    relaciones = []

    # Dirección → perfil. Horizontal, uno a varias.
    relaciones.append(flecha([derecha(0, 0), izquierda(1, 0)], "n", "1", NAVY))
    # Ficha → perfil. Uno a cero o uno.
    relaciones.append(flecha([izquierda(2, 0), derecha(1, 0)], "01", "1", NAVY))
    # Tarjeta → perfil, por el hueco de arriba, a la izquierda de las dos flechas del trabajo.
    tx, ty = c[0] + BOX_W - 28, r[1]
    relaciones.append(flecha(
        [(tx, ty), (tx, r[0] + BOX_H + 18), (c[1] + 28, r[0] + BOX_H + 18), abajo(1, 0, 28)],
        "01", "1", GREEN,
    ))
    # Cliente, obligatorio. Profesional, opcional.
    relaciones.append(flecha([arriba(1, 1, 78), abajo(1, 0, 78)], "n", "1", NAVY))
    relaciones.append(flecha([arriba(1, 1, 176), abajo(1, 0, 176)], "n", "01", AMBER, "dashed"))
    # Pago → trabajo.
    relaciones.append(flecha([izquierda(2, 1), derecha(1, 1)], "n", "1", GREEN))
    # Orden → pago. La orden también guarda id_trabajo; esa flecha no se dibuja.
    relaciones.append(flecha([arriba(2, 2, 168), abajo(2, 1, 168)], "n", "01", GREEN, "dashed"))
    # Evidencia → trabajo, pasillo cercano al trabajo.
    ex, ey = derecha(0, 2)
    relaciones.append(flecha(
        [(ex, ey), (pasillo_evidencia, ey), (pasillo_evidencia, r[1] + 34), (c[1], r[1] + 34)],
        "n", "1", WINE,
    ))
    # Calificación, por el margen izquierdo y el hueco que hay bajo la tarjeta.
    # Su tramo vertical no baja hasta la evidencia, así que no la cruza.
    cx, cy = c[0], r[3] + mitad
    relaciones.append(flecha(
        [
            (cx, cy),
            (margen, cy),
            (margen, hueco_bajo_trabajo),
            (pasillo_calificacion, hueco_bajo_trabajo),
            (pasillo_calificacion, r[1] + BOX_H - 26),
            (c[1], r[1] + BOX_H - 26),
        ],
        "n", "1", WINE,
    ))
    # Mensaje → trabajo, vertical y corta.
    relaciones.append(flecha([arriba(1, 2, 118), abajo(1, 1, 118)], "n", "1", WINE))
    # Disputa, por el pasillo derecho, y entra al trabajo por abajo a la derecha del chat.
    dx, dy = derecha(1, 3)
    relaciones.append(flecha(
        [
            (dx, dy),
            (c[2] - 28, dy),
            (c[2] - 28, r[1] + BOX_H + 48),
            (c[1] + 196, r[1] + BOX_H + 48),
            abajo(1, 1, 196),
        ],
        "n", "1", WINE,
    ))
    partes.extend(relaciones)

    # Etiquetas en huecos, separadas de la línea.
    partes.append(texto((c[0] + BOX_W + c[1]) / 2, r[0] + 46, "uno a varias", NAVY, 12, "600", "middle"))
    partes.append(texto((c[1] + BOX_W + c[2]) / 2, r[0] + 46, "uno a 0..1", NAVY, 12, "600", "middle"))
    partes.append(texto(c[0] + 8, r[0] + BOX_H + 34, "tarjeta, uno a 0..1", GREEN, 12))
    partes.append(texto(c[1] + 86, r[0] + BOX_H + 28, "cliente", NAVY, 12))
    partes.append(texto(c[1] + 86, r[0] + BOX_H + 44, "uno a varios", NAVY, 12))
    partes.append(texto(c[1] + BOX_W + 8, r[0] + BOX_H + 28, "profesional", AMBER, 12))
    partes.append(texto(c[1] + BOX_W + 8, r[0] + BOX_H + 44, "0..1 a varios", AMBER, 12))
    partes.append(texto(c[1] + BOX_W + 10, r[1] + 30, "varios pagos", GREEN, 12))
    partes.append(texto(c[1] + BOX_W + 10, r[1] + 46, "un principal activo", GREEN, 12))
    partes.append(texto(c[2] + 8, r[1] + BOX_H + 32, "id_pago, opcional", GREEN, 12))
    partes.append(texto(pasillo_evidencia - 8, r[2] - 14, "evidencia, uno a varias", WINE, 12, "600", "end"))
    partes.append(texto(28, hueco_bajo_trabajo + 36, "calificación, una por sentido", WINE, 12))
    partes.append(texto(c[1] + 8, r[1] + BOX_H + 36, "chat, uno a varios", WINE, 12))
    partes.append(texto(c[1] + BOX_W + 8, r[3] + 28, "disputa, uno a varias", WINE, 12))

    cajas = [
        (0, 0, "Dirección del cliente", "direcciones_cliente", NAVY,
         ["clave id", "id_usuario → perfil", "etiqueta y dirección"]),
        (1, 0, "Perfil", "perfiles", NAVY,
         ["clave id = auth.users.id", "nombre, rol y estado", "correo, copia de Auth"]),
        (2, 0, "Ficha del profesional", "trabajadores", NAVY,
         ["clave id_usuario → perfil", "profesión y verificación", "nota, copia calculada"]),
        (0, 1, "Tarjeta Oneclick", "metodos_pago_oneclick", GREEN,
         ["clave id_usuario → perfil", "últimos 4 y estado", "token solo en el servidor"]),
        (1, 1, "Trabajo", "trabajos", AMBER,
         ["clave id", "cliente y profesional", "estado y estado del pago"]),
        (2, 1, "Pago", "pagos", GREEN,
         ["clave id", "id_trabajo → trabajo", "tipo, estado y monto", "un principal activo"]),
        (0, 2, "Evidencia", "fotos_trabajo", WINE,
         ["clave id", "id_trabajo → trabajo", "foto o video del hecho"]),
        (1, 2, "Mensaje", "mensajes", WINE,
         ["clave id", "id_trabajo → trabajo", "remitente y destinatario"]),
        (2, 2, "Orden de cambio", "ordenes_cambio", GREEN,
         ["clave id", "id_trabajo → trabajo", "monto y estado", "id_pago, opcional"]),
        (0, 3, "Calificación", "calificaciones", WINE,
         ["clave id", "id_trabajo → trabajo", "una por trabajo y sentido", "puntaje de 1 a 5"]),
        (1, 3, "Disputa", "disputas", WINE,
         ["clave id", "id_trabajo → trabajo", "motivo y resolución"]),
        (2, 3, "Auditoría de la consola", "auditoria_consola", SLATE,
         ["clave id", "id_actor, sin clave foránea", "acción, antes y después"]),
    ]
    for col, fila, titulo, sql, color, lineas in cajas:
        partes.append(caja(c[col], r[fila], titulo, sql, color, lineas))

    partes.append(texto(
        c[2], r[3] + BOX_H + 20,
        "Sin flecha: el registro queda aunque se borre la cuenta.",
        SLATE, 12, "500",
    ))

    yb = H - 70
    partes.append(
        f'<rect x="28" y="{yb}" width="{W - 56}" height="54" rx="8" fill="#F4F7FB" stroke="#D5DDE5"/>'
    )
    partes.append(texto(44, yb + 20, "Lectura del pedido", INK, 13, "700"))
    partes.append(texto(
        44, yb + 40,
        "1. El perfil reserva.   2. El pago principal queda retenido.   3. Se hace el trabajo.   4. Hay evidencia.   5. Conformidad, o disputa.",
        INK, 13, "500",
    ))
    partes.append("</svg>")
    return "\n".join(partes)


def main():
    src = svg()
    (OUT / "er_central.svg").write_text(src, encoding="utf-8")
    cairosvg.svg2png(
        bytestring=src.encode("utf-8"),
        write_to=str(OUT / "er_central.png"),
        output_width=W * 2,
        output_height=H * 2,
    )
    print("ok", W, H)


if __name__ == "__main__":
    main()
