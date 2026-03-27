from __future__ import annotations

from pathlib import Path
import textwrap


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "website-guide-for-non-coders.md"
OUTPUT = ROOT / "docs" / "website-guide-for-non-coders.pdf"

PAGE_WIDTH = 595
PAGE_HEIGHT = 842
LEFT = 54
TOP = 786
BOTTOM = 56
LINE_HEIGHT = 16
BODY_FONT_SIZE = 12
H1_FONT_SIZE = 24
H2_FONT_SIZE = 18
H3_FONT_SIZE = 14
MAX_CHARS = 76


def escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def normalize_text(value: str) -> str:
    replacements = {
        "\u2022": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
    }

    normalized = value
    for old, new in replacements.items():
        normalized = normalized.replace(old, new)

    return normalized


def body_lines(markdown: str) -> list[tuple[str, str]]:
    lines: list[tuple[str, str]] = []

    for raw in markdown.splitlines():
        line = raw.rstrip()

        if not line:
            lines.append(("blank", ""))
            continue

        if line.startswith("# "):
            lines.append(("h1", line[2:].strip()))
            lines.append(("blank", ""))
            continue

        if line.startswith("## "):
            lines.append(("h2", line[3:].strip()))
            continue

        if line.startswith("### "):
            lines.append(("h3", line[4:].strip()))
            continue

        if line.startswith("- "):
            wrapped = textwrap.wrap(line[2:].strip(), width=MAX_CHARS - 4) or [""]
            for idx, part in enumerate(wrapped):
                prefix = "- " if idx == 0 else "  "
                lines.append(("body", f"{prefix}{part}"))
            continue

        wrapped = textwrap.wrap(line, width=MAX_CHARS) or [""]
        for part in wrapped:
            lines.append(("body", part))

    return lines


def add_text_ops(ops: list[str], x: int, y: int, text: str, font: str, size: int) -> None:
    safe_text = normalize_text(text)
    ops.append(f"BT /{font} {size} Tf 1 0 0 1 {x} {y} Tm ({escape_pdf_text(safe_text)}) Tj ET")


def paginate(lines: list[tuple[str, str]]) -> list[str]:
    pages: list[str] = []
    ops: list[str] = []
    y = TOP

    def new_page() -> None:
        nonlocal ops, y
        if ops:
            pages.append("\n".join(ops))
        ops = []
        y = TOP

    for kind, text in lines:
        if kind == "blank":
            y -= LINE_HEIGHT // 2
        elif kind == "h1":
            if y < BOTTOM + 40:
                new_page()
            add_text_ops(ops, LEFT, y, text, "F2", H1_FONT_SIZE)
            y -= 30
        elif kind == "h2":
            if y < BOTTOM + 30:
                new_page()
            add_text_ops(ops, LEFT, y, text, "F2", H2_FONT_SIZE)
            y -= 24
        elif kind == "h3":
            if y < BOTTOM + 24:
                new_page()
            add_text_ops(ops, LEFT, y, text, "F2", H3_FONT_SIZE)
            y -= 20
        else:
            if y < BOTTOM + 18:
                new_page()
            add_text_ops(ops, LEFT, y, text, "F1", BODY_FONT_SIZE)
            y -= LINE_HEIGHT

    if ops:
        pages.append("\n".join(ops))

    return pages


def build_pdf(page_contents: list[str]) -> bytes:
    objects: list[bytes] = []

    def add_object(data: str | bytes) -> int:
        payload = data.encode("latin-1") if isinstance(data, str) else data
        objects.append(payload)
        return len(objects)

    font1 = add_object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    font2 = add_object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    content_ids: list[int] = []
    page_ids: list[int] = []

    pages_placeholder = add_object("<<>>")

    for content in page_contents:
        stream = content.encode("latin-1")
        content_id = add_object(
            b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream"
        )
        content_ids.append(content_id)

        page_id = add_object(
            f"<< /Type /Page /Parent {pages_placeholder} 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
            f"/Resources << /Font << /F1 {font1} 0 R /F2 {font2} 0 R >> >> /Contents {content_id} 0 R >>"
        )
        page_ids.append(page_id)

    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    objects[pages_placeholder - 1] = (
        f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("latin-1")
    )

    catalog = add_object(f"<< /Type /Catalog /Pages {pages_placeholder} 0 R >>")

    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]

    for index, obj in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode("latin-1"))
        output.extend(obj)
        output.extend(b"\nendobj\n")

    xref_start = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    output.extend(b"0000000000 65535 f \n")

    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))

    output.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root {catalog} 0 R >>\n"
            f"startxref\n{xref_start}\n%%EOF\n"
        ).encode("latin-1")
    )

    return bytes(output)


def main() -> None:
    markdown = SOURCE.read_text(encoding="utf-8")
    pages = paginate(body_lines(markdown))
    OUTPUT.write_bytes(build_pdf(pages))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
