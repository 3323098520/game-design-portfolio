"""Validate both rebuilt analyses across Markdown, HTML, DOCX, PDF and figures."""
import re
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

import pdfplumber
from docx import Document

from build_gameplay_analyses import ROOT, SPECS, parse


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag in ("a", "img"):
            self.links.extend(value for key, value in attrs if key in ("href", "src"))


def compact(text):
    return re.sub(r"\s+", "", text)


for key, spec in SPECS.items():
    folder = ROOT / spec["folder"]
    source = folder / "正文.md"
    markdown = source.read_text(encoding="utf-8")
    blocks = parse(source)
    sections = [data[1] for kind, data in blocks if kind == "heading" and data[0] == 2]
    images = [data[1] for kind, data in blocks if kind == "image"]

    assert len(sections) == 16, (key, "section count", len(sections))
    assert len(markdown) >= 8000, (key, "source too short", len(markdown))
    assert len(images) == 4, (key, "figure count", len(images))
    assert "第 8 页" not in markdown
    assert "\ufffd" not in markdown

    doc = Document(folder / spec["docx"])
    doc_text = compact("\n".join(p.text for p in doc.paragraphs))
    assert len(doc.inline_shapes) == 4, (key, "DOCX figure count", len(doc.inline_shapes))
    for heading in sections:
        assert compact(heading) in doc_text, (key, "DOCX missing heading", heading)

    pdf_path = folder / spec["pdf"]
    with pdfplumber.open(pdf_path) as pdf:
        assert len(pdf.pages) >= 10, (key, "PDF too short", len(pdf.pages))
        pdf_text = compact("".join(page.extract_text() or "" for page in pdf.pages))
        page_count = len(pdf.pages)
    for heading in sections:
        assert compact(heading) in pdf_text, (key, "PDF missing heading", heading)

    html_path = folder / spec["html"]
    html = html_path.read_text(encoding="utf-8")
    assert len(re.findall(r'<h2 id="sec-\d+">', html)) == 16
    parser = Links()
    parser.feed(html)
    for link in parser.links:
        parts = urlsplit(link)
        if not parts.scheme and parts.path:
            assert (folder / unquote(parts.path)).exists(), (key, "broken local link", link)

    for rel in images:
        png = folder / rel
        svg = png.with_suffix(".svg")
        assert png.exists() and svg.exists(), (key, "missing figure", rel)
        ElementTree.parse(svg)

    print(f"{key}: PASS | {len(sections)} sections | {page_count} PDF pages | 4 figures")

print("Both analyses passed structural, text, link and artifact checks.")
