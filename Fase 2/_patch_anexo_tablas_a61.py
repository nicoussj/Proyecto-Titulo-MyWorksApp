# -*- coding: utf-8 -*-
"""Amplía el Anexo A (Tablas A-61…A-80) y lo inserta en el Informe final.

Fuentes (sin inventar tablas):
- Tablas A-61…A-76: las 16 de la Tabla 18 del Informe / catálogo 24-nov-2026.
  Tipos de consola: migraciones del repo. Tipos IA: sondeo PostgREST a la BD viva
  (errores 22P02 de filtro) el 26-nov-2026.
- Tablas A-77…A-80: migración 20261124140000_disputas_escalables.sql (en la BD viva).
"""
from __future__ import annotations

import re
import shutil
import zipfile
from pathlib import Path

from lxml import etree

ROOT = Path(__file__).resolve().parent
INFORME = ROOT / "Myworksapp_Informe_Final_PTY4614.docx"
ANEXO_MD = ROOT / "Anexo_A_Diccionario_de_tablas.md"
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
WIDTHS = ("2500", "2100", "4805")


def q(tag: str) -> str:
    return f"{{{W}}}{tag}"


def E(tag: str, **attrs):
    el = etree.Element(q(tag))
    for key, value in attrs.items():
        el.set(q(key), value)
    return el


def rpr(size="20", bold=False, color=None):
    node = E("rPr")
    node.append(E("rFonts", ascii="Arial", hAnsi="Arial", cs="Arial"))
    if bold:
        node.append(E("b"))
        node.append(E("bCs"))
    if color:
        node.append(E("color", val=color))
    node.append(E("sz", val=size))
    node.append(E("szCs", val=size))
    return node


def paragraph(
    text,
    size="20",
    bold=False,
    before="0",
    after="80",
    keep_next=False,
    color=None,
    page_break=False,
):
    node = E("p")
    pPr = E("pPr")
    if page_break:
        pPr.append(E("pageBreakBefore"))
    if keep_next:
        pPr.append(E("keepNext"))
        pPr.append(E("keepLines"))
    pPr.append(E("spacing", before=before, after=after, line="240", lineRule="auto"))
    pPr.append(rpr(size, bold, color))
    node.append(pPr)
    if text:
        run = E("r")
        run.append(rpr(size, bold, color))
        t = E("t")
        t.text = text
        if text.startswith(" ") or text.endswith(" "):
            t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        run.append(t)
        node.append(run)
    return node


def borde(tag):
    return E(tag, val="single", sz="4", space="0", color="9CC2E5")


def celda(texto, ancho, encabezado=False):
    tc = E("tc")
    tcPr = E("tcPr")
    tcPr.append(E("tcW", w=ancho, type="dxa"))
    if encabezado:
        tcPr.append(E("shd", val="clear", color="auto", fill="D9EAF7"))
    tc.append(tcPr)
    node = E("p")
    pPr = E("pPr")
    pPr.append(E("spacing", before="20", after="20", line="240", lineRule="auto"))
    pPr.append(rpr("18", encabezado))
    node.append(pPr)
    run = E("r")
    run.append(rpr("18", encabezado))
    t = E("t")
    t.text = texto
    run.append(t)
    node.append(run)
    tc.append(node)
    return tc


def tabla_atributos(columnas):
    tbl = E("tbl")
    tblPr = E("tblPr")
    tblPr.append(E("tblW", w="9405", type="dxa"))
    tblPr.append(E("jc", val="left"))
    tblPr.append(E("tblLayout", type="fixed"))
    borders = E("tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        borders.append(borde(lado))
    tblPr.append(borders)
    tbl.append(tblPr)
    grid = E("tblGrid")
    for ancho in WIDTHS:
        grid.append(E("gridCol", w=ancho))
    tbl.append(grid)

    def fila(valores, encabezado=False):
        tr = E("tr")
        trPr = E("trPr")
        trPr.append(E("cantSplit"))
        if encabezado:
            trPr.append(E("tblHeader"))
        tr.append(trPr)
        for valor, ancho in zip(valores, WIDTHS):
            tr.append(celda(valor, ancho, encabezado))
        return tr

    tbl.append(fila(("Atributo", "Tipo de dato", "Restricción"), True))
    for nombre, tipo, restr in columnas:
        tbl.append(fila((nombre, tipo, restr)))
    return tbl


# n, grupo, nombre, nota, columnas[(attr, tipo, restr)]
TABLAS = [
    (
        61,
        "Consola y seguridad",
        "bloqueos_ip",
        "Bloqueo de una dirección IP por la consola de defensa. Migración 20261122180400.",
        [
            ("id", "uuid", "PK, Obligatorio, Default gen_random_uuid()"),
            ("creado_en", "timestamptz", "Obligatorio, Default now()"),
            ("ip", "text", "Obligatorio"),
            ("hasta", "timestamptz", "Opcional"),
            ("motivo", "text", "Obligatorio"),
            ("activo", "boolean", "Obligatorio, Default true"),
        ],
    ),
    (
        62,
        "Consola y seguridad",
        "eventos_acceso",
        "Intento fallido de acceso (login o MFA) registrado para umbrales. Migración 20261122180200.",
        [
            ("id", "uuid", "PK, Obligatorio, Default gen_random_uuid()"),
            ("creado_en", "timestamptz", "Obligatorio, Default now()"),
            ("tipo", "text", "Obligatorio. login_fallido | mfa_fallido"),
            ("correo_enmascarado", "text", "Obligatorio"),
        ],
    ),
    (
        63,
        "Consola y seguridad",
        "incidentes_seguridad",
        "Incidente de seguridad visible en la consola. Migración 20261122180200.",
        [
            ("id", "uuid", "PK, Obligatorio, Default gen_random_uuid()"),
            ("creado_en", "timestamptz", "Obligatorio, Default now()"),
            ("tipo", "text", "Obligatorio"),
            ("severidad", "text", "Obligatorio. baja | media | alta"),
            ("resumen", "text", "Obligatorio"),
            ("detalle", "jsonb", "Obligatorio, Default {}"),
            ("estado", "text", "Obligatorio, Default abierto. abierto | reconocido"),
            ("id_usuario", "uuid", "Opcional"),
        ],
    ),
    (
        64,
        "Consola y seguridad",
        "pruebas_seguridad",
        "Resultado de una prueba de seguridad de la consola. Migración 20261122180400.",
        [
            ("id", "uuid", "PK, Obligatorio, Default gen_random_uuid()"),
            ("creado_en", "timestamptz", "Obligatorio, Default now()"),
            ("tipo", "text", "Obligatorio"),
            ("origen", "text", "Obligatorio, Default servidor. servidor | navegador"),
            ("resultado", "text", "Obligatorio. ok | aviso | fallo"),
            ("severidad", "text", "Obligatorio. baja | media | alta"),
            ("resumen", "text", "Obligatorio"),
            ("recomendacion", "text", "Obligatorio"),
            ("detalle", "jsonb", "Obligatorio, Default {}"),
        ],
    ),
    (
        65,
        "Consola y seguridad",
        "respaldos_consola",
        "Respaldo lógico de dominios de la consola. Migraciones 20261122180400 y 20261122190000.",
        [
            ("id", "uuid", "PK, Obligatorio, Default gen_random_uuid()"),
            ("creado_en", "timestamptz", "Obligatorio, Default now()"),
            ("tamano_bytes", "integer", "Obligatorio"),
            ("sha256", "text", "Obligatorio"),
            ("tablas", "text[]", "Obligatorio"),
            ("estado", "text", "Obligatorio, Default listo. listo | restaurado"),
            ("contenido", "text", "Opcional"),
            ("filas", "jsonb", "Obligatorio, Default {}"),
            ("ruta", "text", "Opcional"),
            ("origen", "text", "Obligatorio, Default manual"),
        ],
    ),
    (
        66,
        "Consola y seguridad",
        "ticket_mensajes",
        "Mensaje de un ticket de soporte leído por la consola. Migración 20261122180200.",
        [
            ("id", "uuid", "PK, Obligatorio, Default gen_random_uuid()"),
            ("id_ticket", "text", "FK → tickets_soporte.id, Obligatorio"),
            ("id_autor", "uuid", "Opcional"),
            ("cuerpo", "text", "Obligatorio (2–2000 caracteres)"),
            ("creado_en", "timestamptz", "Obligatorio, Default now()"),
        ],
    ),
    (
        67,
        "Consola y seguridad",
        "umbrales_seguridad",
        "Umbral de alerta de la consola (clave/valor y ventana). Migración 20261122180200.",
        [
            ("clave", "text", "PK, Obligatorio"),
            ("valor", "integer", "Obligatorio (0–100000)"),
            ("ventana_minutos", "integer", "Obligatorio (1–10080)"),
            ("descripcion", "text", "Obligatorio"),
        ],
    ),
    (
        68,
        "Inteligencia artificial",
        "cola_moderacion",
        "Caso de revisión de un mensaje por moderación asistida. Presente en el catálogo vivo (sin archivo de migración en el árbol); tipos sondeados el 26-nov-2026.",
        [
            ("id", "uuid", "PK, Obligatorio"),
            ("id_mensaje", "text", "Opcional"),
            ("motivo", "text", "Opcional"),
            ("detalle", "text", "Opcional"),
            ("estado", "text", "Opcional"),
            ("veredicto_llm", "text", "Opcional"),
            ("creado_en", "timestamptz", "Opcional"),
            ("revisado_por", "uuid", "Opcional"),
            ("revisado_en", "timestamptz", "Opcional"),
        ],
    ),
    (
        69,
        "Inteligencia artificial",
        "eventos",
        "Hecho registrado por el dominio de inteligencia artificial (bitácora). Presente en el catálogo vivo; tipos sondeados el 26-nov-2026.",
        [
            ("id", "uuid", "PK, Obligatorio"),
            ("user_id", "uuid", "Opcional"),
            ("tipo", "text", "Opcional"),
            ("entidad_id", "text", "Opcional"),
            ("metadata", "jsonb", "Opcional"),
            ("comuna", "text", "Opcional"),
            ("categoria", "text", "Opcional"),
            ("created_at", "timestamptz", "Opcional"),
        ],
    ),
    (
        70,
        "Inteligencia artificial",
        "ia_banderas",
        "Interruptor clave/valor de funciones de inteligencia artificial. Catálogo vivo; tipos sondeados el 26-nov-2026.",
        [
            ("clave", "text", "PK, Obligatorio"),
            ("activa", "boolean", "Opcional"),
            ("nota", "text", "Opcional"),
        ],
    ),
    (
        71,
        "Inteligencia artificial",
        "ia_cambios_banco",
        "Aviso de cambio de cuenta bancaria revisado por IA. Catálogo vivo; tipos sondeados el 26-nov-2026.",
        [
            ("id", "uuid", "PK, Obligatorio"),
            ("user_id", "uuid", "Opcional"),
            ("creado_en", "timestamptz", "Opcional"),
        ],
    ),
    (
        72,
        "Inteligencia artificial",
        "ia_cola_embeddings",
        "Encargo de vectorización de un texto. Catálogo vivo; tipos sondeados el 26-nov-2026.",
        [
            ("id", "bigint", "PK, Obligatorio"),
            ("tabla", "text", "Opcional"),
            ("entidad_id", "text", "Opcional"),
            ("texto", "text", "Opcional"),
            ("estado", "text", "Opcional"),
            ("creado_en", "timestamptz", "Opcional"),
        ],
    ),
    (
        73,
        "Inteligencia artificial",
        "ia_huellas",
        "Huella de dispositivo e IP asociada a un usuario. Catálogo vivo; tipos sondeados el 26-nov-2026.",
        [
            ("id", "uuid", "PK, Obligatorio"),
            ("user_id", "uuid", "Opcional"),
            ("device_hash", "text", "Opcional"),
            ("ip_hash", "text", "Opcional"),
            ("created_at", "timestamptz", "Opcional"),
        ],
    ),
    (
        74,
        "Inteligencia artificial",
        "ia_pesos_busqueda",
        "Peso de un factor de la búsqueda híbrida. Catálogo vivo; tipos sondeados el 26-nov-2026.",
        [
            ("clave", "text", "PK, Obligatorio"),
            ("peso", "numeric", "Opcional"),
            ("descripcion", "text", "Opcional"),
        ],
    ),
    (
        75,
        "Inteligencia artificial",
        "ia_resumen_resenas",
        "Resumen generado de reseñas por profesional. Catálogo vivo; tipos sondeados el 26-nov-2026.",
        [
            ("id_profesional", "uuid", "PK, Obligatorio"),
            ("resumen", "text", "Opcional"),
            ("n_resenas", "integer", "Opcional"),
            ("origen", "text", "Opcional"),
            ("generado_en", "timestamptz", "Opcional"),
        ],
    ),
    (
        76,
        "Inteligencia artificial",
        "ia_sugerencias_perfil",
        "Sugerencia de texto para el perfil de un profesional. Catálogo vivo; tipos sondeados el 26-nov-2026.",
        [
            ("id", "uuid", "PK, Obligatorio"),
            ("user_id", "uuid", "Opcional"),
            ("texto_sugerido", "text", "Opcional"),
            ("estado", "text", "Opcional"),
            ("creado_en", "timestamptz", "Opcional"),
        ],
    ),
    (
        77,
        "Evidencia y disputas escalables",
        "evidencia_nonces",
        "Nonce de un solo uso para capturar evidencia desde la cámara de la app. Migración 20261124140000.",
        [
            ("id", "uuid", "PK, Obligatorio, Default gen_random_uuid()"),
            ("nonce", "text", "Obligatorio, Único"),
            ("id_trabajo", "text", "Obligatorio"),
            ("id_usuario", "uuid", "Obligatorio"),
            ("creado_en", "timestamptz", "Obligatorio, Default now()"),
            ("expira_en", "timestamptz", "Obligatorio"),
            ("usado_en", "timestamptz", "Opcional"),
            ("id_foto", "text", "Opcional"),
        ],
    ),
    (
        78,
        "Evidencia y disputas escalables",
        "evidencia_procedencia",
        "Procedencia de una foto de trabajo (hash, GPS, nonce, confianza). Migración 20261124140000.",
        [
            ("id", "uuid", "PK, Obligatorio, Default gen_random_uuid()"),
            ("id_foto", "text", "Obligatorio"),
            ("id_trabajo", "text", "Obligatorio"),
            ("origen_captura", "text", "Opcional"),
            ("tipo_evidencia", "text", "Opcional"),
            ("hash_sha256", "text", "Opcional"),
            ("hash_original", "text", "Opcional"),
            ("hash_perceptual", "text", "Opcional"),
            ("latitud", "double precision", "Opcional"),
            ("longitud", "double precision", "Opcional"),
            ("distancia_metros", "numeric", "Opcional"),
            ("capturada_en", "timestamptz", "Opcional"),
            ("recibida_en", "timestamptz", "Obligatorio, Default now()"),
            ("nonce", "text", "Opcional"),
            ("confianza", "text", "Obligatorio"),
            ("motivo", "text", "Opcional"),
            ("duplicado_de", "text", "Opcional"),
            ("creado_en", "timestamptz", "Obligatorio, Default now()"),
        ],
    ),
    (
        79,
        "Evidencia y disputas escalables",
        "alertas_evidencia",
        "Alerta por posible evidencia duplicada o anómala. Migración 20261124140000.",
        [
            ("id", "uuid", "PK, Obligatorio, Default gen_random_uuid()"),
            ("tipo", "text", "Obligatorio"),
            ("id_foto", "text", "Opcional"),
            ("id_trabajo", "text", "Opcional"),
            ("id_foto_previa", "text", "Opcional"),
            ("id_trabajo_previo", "text", "Opcional"),
            ("hash_perceptual", "text", "Opcional"),
            ("detalle", "text", "Opcional"),
            ("creado_en", "timestamptz", "Obligatorio, Default now()"),
        ],
    ),
    (
        80,
        "Evidencia y disputas escalables",
        "reembolsos_automaticos",
        "Cola de reembolso automático ligado a una disputa. Migración 20261124140000.",
        [
            ("id_disputa", "text", "PK, Obligatorio"),
            ("id_pago", "text", "Obligatorio"),
            ("estado", "text", "Obligatorio. pendiente | en_curso | ejecutado | fallido"),
            ("intentos", "integer", "Obligatorio, Default 0"),
            ("ultimo_error", "text", "Opcional"),
            ("solicitud_id", "bigint", "Opcional"),
            ("creado_en", "timestamptz", "Obligatorio, Default now()"),
            ("actualizado_en", "timestamptz", "Obligatorio, Default now()"),
            ("ejecutado_en", "timestamptz", "Opcional"),
        ],
    ),
]


INTRO_NUEVO = (
    "A continuación se describen 80 tablas del esquema public. "
    "Las tablas A-1 a A-57 salen de la base en uso al 17 de noviembre de 2026 "
    "(migración 20261117223850); las tablas A-58 a A-60 salen de las migraciones "
    "del 20 de noviembre leídas del repositorio; las tablas A-61 a A-76 son las 16 "
    "que el catálogo contó el 24 de noviembre de 2026 además del corte de 60 "
    "(Tabla 18 del informe): siete de consola con DDL en el repositorio y nueve de "
    "inteligencia artificial cuyos tipos se confirmaron por sondeo de solo lectura "
    "el 26 de noviembre de 2026; las tablas A-77 a A-80 salen de la migración "
    "20261124140000 (disputas escalables), presente en la base viva. "
    "Los atributos se listan con su tipo de dato y su restricción. "
    "PK indica la clave primaria y FK la clave foránea."
)

FUENTE_NUEVA = (
    "Fuente: elaboración propia a partir del esquema de la base en uso "
    "(migraciones del repositorio hasta 20261124140000 y sondeo PostgREST "
    "de solo lectura el 26-nov-2026 para las tablas de IA sin archivo de migración)."
)


def bloques_nuevos():
    nodos = []
    grupo_actual = None
    for n, grupo, nombre, nota, columnas in TABLAS:
        if grupo != grupo_actual:
            grupo_actual = grupo
            nodos.append(
                paragraph(grupo, size="22", bold=True, before="280", after="80", keep_next=True)
            )
        nodos.append(
            paragraph(
                f"Tabla A-{n}. {nombre}",
                size="20",
                bold=True,
                before="160",
                after="20",
                keep_next=True,
            )
        )
        nodos.append(
            paragraph(nota, size="18", before="0", after="60", keep_next=True, color="595959")
        )
        nodos.append(tabla_atributos(columnas))
        nodos.append(paragraph("", size="18", before="0", after="40"))
    return nodos


def texto_parrafo(node):
    return "".join(node.itertext())


def patch_informe():
    respaldo = Path("/tmp/informe-apt-antes-anexo-a61.docx")
    shutil.copy2(INFORME, respaldo)
    with zipfile.ZipFile(INFORME) as z:
        infos = z.infolist()
        archivos = {info.filename: z.read(info.filename) for info in infos}
    root = etree.fromstring(archivos["word/document.xml"])
    for prefijo, uri in root.nsmap.items():
        if prefijo:
            etree.register_namespace(prefijo, uri)
    body = root.find(q("body"))

    # Actualizar intro del anexo
    for child in list(body):
        if child.tag != q("p"):
            continue
        txt = texto_parrafo(child)
        if txt.startswith("A continuación se describen 60 tablas"):
            # reemplazar runs
            for r in child.findall(q("r")):
                child.remove(r)
            run = E("r")
            run.append(rpr("20"))
            t = E("t")
            t.text = INTRO_NUEVO
            run.append(t)
            child.append(run)
        elif txt.startswith("Fuente: elaboración propia a partir del esquema de la base en uso (migración 20261117223850)"):
            for r in child.findall(q("r")):
                child.remove(r)
            run = E("r")
            run.append(rpr("18", color="595959"))
            t = E("t")
            t.text = FUENTE_NUEVA
            run.append(t)
            child.append(run)
        elif "Figuras A-1 a A-11" in txt or "figuras A-1 a A-11" in txt:
            nuevo = txt.replace(
                "figuras A-1 a A-11",
                "figuras A-1 a A-14",
            ).replace(
                "Figuras A-1 a A-11",
                "Figuras A-1 a A-14",
            )
            if nuevo != txt:
                for r in child.findall(q("r")):
                    child.remove(r)
                run = E("r")
                run.append(rpr("18", color="595959"))
                t = E("t")
                t.text = nuevo
                run.append(t)
                child.append(run)

    # Insertar tablas nuevas después de la tabla A-60 y antes de "Columnas agregadas..."
    ancla = None
    for child in body:
        if child.tag == q("p") and texto_parrafo(child).startswith(
            "Columnas agregadas el 20-nov-2026"
        ):
            ancla = child
            break
    if ancla is None:
        raise SystemExit("No se encontró el ancla 'Columnas agregadas'")

    # Evitar duplicar si ya se insertó
    for child in body:
        if child.tag == q("p") and texto_parrafo(child).startswith("Tabla A-61."):
            print("A-61 ya presente; no se reinserta el bloque")
            break
    else:
        for nodo in bloques_nuevos():
            ancla.addprevious(nodo)

    # Nota post-columnas: mencionar evidencia 24-11
    nota_extra = (
        "Tablas A-77 a A-80 (evidencia_nonces, evidencia_procedencia, alertas_evidencia, "
        "reembolsos_automaticos): migración 20261124140000, confirmadas en la base viva "
        "el 26-nov-2026. El corte del Anexo F (24-nov) contó 76 tablas; con estas cuatro "
        "el diccionario del anexo llega a 80."
    )
    # Insertar después del párrafo de columnas agregadas si no está
    ya = False
    for child in body:
        if child.tag == q("p") and "Tablas A-77 a A-80" in texto_parrafo(child):
            ya = True
            break
    if not ya:
        ancla.addnext(paragraph(nota_extra, size="18", before="80", after="80", color="595959"))

    nuevo = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
    etree.fromstring(nuevo)
    tmp = INFORME.with_suffix(".tmp.docx")
    with zipfile.ZipFile(tmp, "w") as z:
        for info in infos:
            data = nuevo if info.filename == "word/document.xml" else archivos[info.filename]
            copia = zipfile.ZipInfo(filename=info.filename, date_time=info.date_time)
            copia.compress_type = info.compress_type
            copia.external_attr = info.external_attr
            z.writestr(copia, data)
    tmp.replace(INFORME)
    return respaldo


def patch_md():
    text = ANEXO_MD.read_text(encoding="utf-8")
    # Reemplazar aviso inicial
    aviso = (
        "> **26-11-2026.** Este anexo describe **80 tablas** del esquema `public`: "
        "las 60 del corte del 17–20 de noviembre de 2026 (A-1 a A-60), las 16 del "
        "catálogo del 24 de noviembre (A-61 a A-76; Tabla 18 del informe) y las 4 de "
        "evidencia/disputas escalables de la migración `20261124140000` (A-77 a A-80). "
        "Las tablas de IA no tienen archivo de migración en este árbol; sus tipos se "
        "confirmaron por sondeo PostgREST de solo lectura el 26-nov-2026.\n"
    )
    text = re.sub(r"^> \*\*22-11-2026\.\*\*.*\n", aviso, text, count=1, flags=re.M)

    # Actualizar párrafo de conteo
    text = re.sub(
        r"A continuación se describe cada una de las 60 tablas del esquema public documentadas hasta el 20-11-2026\.[^\n]*\n",
        INTRO_NUEVO + "\n",
        text,
        count=1,
    )

    # Quitar o actualizar la frase de figuras 60
    text = text.replace(
        "Las figuras con las 60 tablas que usa el informe final están en `MyWorksAppProyect/docs/modelo_er60/`.",
        "Las figuras del corte de 60 tablas están en `MyWorksAppProyect/docs/modelo_er60/`; "
        "las figuras A-12 a A-14 (consola de seguridad, IA y evidencia) se generaron con el corte de 80.",
    )

    block = ["\n"]
    grupo_actual = None
    for n, grupo, nombre, nota, columnas in TABLAS:
        if grupo != grupo_actual:
            grupo_actual = grupo
            block.append(f"## {grupo}\n")
        block.append(f"### Tabla A-{n}. {nombre}\n")
        block.append(f"{nota}\n")
        block.append("| Atributo | Tipo de dato | Restricción |")
        block.append("|----------|--------------|-------------|")
        for attr, tipo, restr in columnas:
            block.append(f"| `{attr}` | {tipo} | {restr} |")
        block.append("")

    # Insertar antes de "### Columnas agregadas" o "## Funciones" o al final de A-60 section
    marker = "### Columnas agregadas el 20-11-2026 a tablas ya descritas"
    if marker in text:
        text = text.replace(marker, "\n".join(block) + "\n" + marker)
    else:
        marker2 = "## Funciones relevantes"
        if marker2 in text:
            text = text.replace(marker2, "\n".join(block) + "\n" + marker2)
        else:
            text = text.rstrip() + "\n" + "\n".join(block) + "\n"

    # Nota al final del bloque de columnas
    extra = (
        "\n- Tablas A-77 a A-80 (evidencia): migración `20261124140000`, "
        "confirmadas en la base viva el 26-nov-2026. Con ellas el anexo llega a 80 tablas.\n"
    )
    if "Tablas A-77 a A-80" not in text:
        text = text.replace(
            "- perfiles.telefono (text, Opcional; migración `20261120170000`).\n",
            "- perfiles.telefono (text, Opcional; migración `20261120170000`).\n" + extra,
        )

    ANEXO_MD.write_text(text, encoding="utf-8")


def main():
    patch_md()
    print(f"MD actualizado: {ANEXO_MD}")
    respaldo = patch_informe()
    print(f"Informe actualizado: {INFORME}")
    print(f"Respaldo: {respaldo}")
    # verificación
    from docx import Document

    doc = Document(str(INFORME))
    found = [p.text for p in doc.paragraphs if p.text.startswith("Tabla A-")]
    print("tablas en informe:", len(found), "última:", found[-1] if found else None)
    assert any(t.startswith("Tabla A-80.") for t in found), found[-5:]


if __name__ == "__main__":
    main()
