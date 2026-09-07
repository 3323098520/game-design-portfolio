"""Check content parity, PDF extraction, diagram nodes and local reading links."""
import re
from pathlib import Path
from urllib.parse import urlsplit, unquote
from html.parser import HTMLParser
from xml.etree import ElementTree
from docx import Document
from pypdf import PdfReader
import pdfplumber
from build_gameplay_analyses import ROOT, SPECS

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]
    def handle_starttag(self, tag, attrs):
        if tag in ('a','img'):
            self.links.extend(v for k,v in attrs if k in ('href','src'))

def norm(s):
    return re.sub(r'\s+', '', s)

for dirname,oldstem,title,name,groups in SPECS:
    folder=ROOT/dirname
    md=(folder/'正文.md').read_text(encoding='utf-8')
    paragraphs=[x.strip() for x in md.split('\n\n') if x.strip()]
    expected=[re.sub(r'^#{1,3} ', '', x) for x in paragraphs if not x.startswith('![')]
    doc=Document(folder/(title+'.docx'))
    actual=[p.text for p in doc.paragraphs if p.text]
    assert expected==actual, title+' DOCX differs from source'
    assert [p.text for p in doc.paragraphs if p.style.name=='Heading 1']==['一 系统和功能','二 接触系统的顺序','三 核心玩法']
    assert not doc.styles.element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pBdr')
    pdf=PdfReader(folder/(oldstem+'.pdf'))
    # Sort positioned glyphs; some embedded CJK fallback runs are stored later
    # in the PDF stream even though their visible position is correct.
    with pdfplumber.open(folder/(oldstem+'.pdf')) as positioned:
        extracted=norm(''.join(re.sub(r'\n\d+\s*$', '', p.extract_text() or '') for p in positioned.pages))
    missing=[p[:25] for p in expected if norm(p) not in extracted]
    assert not missing, (title, 'PDF text missing', missing)
    parser=Links(); parser.feed((folder/(oldstem+'.html')).read_text(encoding='utf-8'))
    for link in parser.links:
        parts=urlsplit(link)
        if not parts.scheme:
            assert (folder/unquote(parts.path)).exists(), link
    svg=ElementTree.parse(folder/'系统关系图.svg')
    labels=[e.text for e in svg.iter() if e.tag.endswith('}text')]
    for label,leaves in groups:
        assert label in labels
        assert all(leaf in labels for leaf in leaves)
    print(title, 'PASS', len(pdf.pages), 'pages;',len(actual),'text blocks;',len(labels),'diagram nodes')

print('Both analyses passed; visual page review is a separate required check.')
