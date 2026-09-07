"""Build matching, selectable-text HTML and PDF studies from bounded content files."""
from pathlib import Path
import json, html, math
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[1]
FONT = 'C:/Windows/Fonts/'
pdfmetrics.registerFont(TTFont('CN', FONT + 'msyh.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('CNB', FONT + 'msyhbd.ttc', subfontIndex=0))
W, H = 1120, 792
INK, MUTED, PAPER, LINE = '#1e2c33', '#586770', '#faf9f5', '#d6dfdf'

def wrap(s, width, size, bold=False):
    lines, buf = [], ''
    for char in s:
        if char == '\n':
            lines.append(buf); buf = ''; continue
        if buf and pdfmetrics.stringWidth(buf + char, 'CNB' if bold else 'CN', size) > width:
            if char in '，。；：？！、）】》%”’':
                # Keep closing punctuation off the start of a line.
                lines.append(buf[:-1]); buf = buf[-1] + char
            else:
                lines.append(buf); buf = char
        else:
            buf += char
    if buf: lines.append(buf)
    return lines

class Page:
    def __init__(self, c, color):
        self.c, self.color, self.svg = c, color, []
    def rect(self, x, y, w, h, fill, stroke=None, r=0):
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke or "none"}"/>')
        self.c.setFillColor(HexColor(fill)); self.c.setStrokeColor(HexColor(stroke or fill))
        self.c.roundRect(x,H-y-h,w,h,r,stroke=bool(stroke),fill=1)
    def line(self,x1,y1,x2,y2,color=LINE,width=1,dash=False):
        self.svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}"'+(' stroke-dasharray="6 5"' if dash else '')+'/>')
        self.c.setStrokeColor(HexColor(color)); self.c.setLineWidth(width); self.c.setDash([6,5] if dash else [])
        self.c.line(x1,H-y1,x2,H-y2); self.c.setDash([])
    def text(self,x,y,s,size=16,color=INK,bold=False,link=None):
        # y is baseline in both renderers.
        node=f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{700 if bold else 400}">{html.escape(s)}</text>'
        self.svg.append(f'<a href="{html.escape(link,quote=True)}" target="_blank">{node}</a>' if link else node)
        self.c.setFont('CNB' if bold else 'CN',size); self.c.setFillColor(HexColor(color)); self.c.drawString(x,H-y,s)
        if link: self.c.linkURL(link,(x,H-y-3,x+pdfmetrics.stringWidth(s,'CNB' if bold else 'CN',size),H-y+size),relative=1)
    def para(self,x,y,s,width,size=16,leading=25,color=INK,bold=False,link=None):
        for ln in wrap(s,width,size,bold):
            self.text(x,y,ln,size,color,bold,link); y+=leading
        return y
    def arrow(self,x1,y1,x2,y2,color=None,dash=False):
        color=color or self.color; self.line(x1,y1,x2,y2,color,2,dash)
        a=math.atan2(y2-y1,x2-x1)
        for t in [-.5,.5]: self.line(x2,y2,x2-10*math.cos(a+t),y2-10*math.sin(a+t),color,2)
    def circle(self,x,y,r,fill,stroke=None):
        self.svg.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke or fill}"/>')
        self.c.setFillColor(HexColor(fill)); self.c.setStrokeColor(HexColor(stroke or fill)); self.c.circle(x,H-y,r,stroke=1,fill=1)

def table(p,v,x,y,width):
    heads, rows = v['headers'],v['rows']; n=len(heads)
    fractions=v.get('widths',{3:[.24,.36,.40],4:[.20,.25,.25,.30]}.get(n,[1/n]*n))
    widths=[width*f for f in fractions]
    p.rect(x,y,width,38,p.color)
    xx=x
    for h,w in zip(heads,widths): p.text(xx+12,y+25,h,14,'#ffffff',True); xx+=w
    y+=38
    for k,row in enumerate(rows):
        wrapped=[wrap(s,w-24,14.5) for s,w in zip(row,widths)]
        height=max(len(z) for z in wrapped)*23+24
        p.rect(x,y,width,height,'#ffffff' if k%2==0 else '#eef2f0')
        xx=x
        for cell,w in zip(wrapped,widths):
            for i,t in enumerate(cell): p.text(xx+12,y+24+i*23,t,14.5)
            xx+=w
        y+=height; p.line(x,y,x+width,y)
    if y>680: raise ValueError(f'Table overflow {v["title"]}: {y}')

def flow(p,v,x,y,width):
    for i,(title,desc) in enumerate(v['nodes']):
        yy=y+i*102
        p.rect(x,yy,width,80,'#ffffff',LINE,4)
        p.rect(x,yy,5,80,p.color)
        p.text(x+21,yy+29,f'{i+1:02d}',15,p.color,True)
        p.text(x+61,yy+29,title,18,INK,True)
        p.para(x+61,yy+55,desc,width-83,14.5,20,MUTED)
        if i<3:p.arrow(x+width/2,yy+84,x+width/2,yy+97)

def branches(p,v,x,y,width):
    title,desc=v['nodes'][0]
    p.rect(x,y,width,78,'#ffffff',LINE,4)
    p.text(x+18,y+29,title,18,p.color,True)
    p.para(x+18,y+55,desc,width-36,14.5,20,MUTED)
    p.line(x+22,y+78,x+22,y+360,p.color,2)
    for i,(title,desc) in enumerate(v['nodes'][1:]):
        yy=y+103+i*106
        p.arrow(x+22,yy+35,x+56,yy+35)
        p.rect(x+61,yy,width-61,82,'#ffffff',LINE,4)
        p.text(x+79,yy+29,title,17,p.color,True)
        p.para(x+79,yy+56,desc,width-103,14.5,20)
    p.text(x,y+443,'分支按条件选择，不表示依次执行。',13,MUTED)

def recon(p,x,y,w):
    p.rect(x,y,w,62,'#ffffff',LINE,4);p.text(x+18,y+28,'选择角度、蓄力、反弹后发射',17,p.color,True)
    p.text(x+18,y+50,'落点决定后续可用的观察条件',14,MUTED)
    p.arrow(x+w/2,y+64,x+w/2,y+91)
    p.rect(x,y+94,w,61,'#ffffff',LINE,4);p.text(x+18,y+120,'碰撞后激活：检查目标视线与存续',17,p.color,True)
    p.text(x+18,y+143,'敌人是否处于可判定位置？箭是否被处理？',14,MUTED)
    cw=(w-20)/3
    for i,(h,b) in enumerate([('出现目标反馈','调整预瞄；仍需清未知角'),('箭被摧毁','原信息工具失效，重新判断'),('没有目标反馈','不证明全区域安全')]):
        xx=x+i*(cw+10);p.arrow(x+w/2,y+157,xx+cw/2,y+196)
        p.rect(xx,y+201,cw,124,'#eef2f0',LINE,4);p.text(xx+12,y+230,h,15,p.color,True)
        p.para(xx+12,y+260,b,cw-24,14.5,22)
    p.rect(x,y+354,w,73,'#ffffff',LINE,4);p.text(x+18,y+381,'下一步：已知目标与未知角落分开处理',16,INK,True)
    p.text(x+18,y+407,'由队伍更新计划，不自动触发“安全进点”。',14,MUTED)

def jett(p,x,y,w):
    for i,(h,b) in enumerate([('可用：玩家消耗一次机会','做出预激活决定'),('启动 1 秒','历史 7.04：不能立即执行位移'),('窗口 7.5 秒','历史 7.04：等待第二次输入')]):
        yy=y+i*96;p.rect(x,yy,w,72,'#ffffff',LINE,4);p.text(x+18,yy+28,h,17,p.color,True);p.text(x+18,yy+53,b,14,MUTED)
        if i<2:p.arrow(x+w/2,yy+75,x+w/2,yy+92)
    for i,(h,b) in enumerate([('窗口内再次输入','执行位移，检查落点与跟进'),('等到窗口结束','失去本次机会，重新计划')]):
        xx=x+i*(w/2+8);ww=w/2-8;p.arrow(x+w/2,y+265,xx+ww/2,y+301)
        p.rect(xx,y+306,ww,99,'#eef2f0',LINE,4);p.text(xx+12,y+335,h,16,p.color,True);p.para(xx+12,y+363,b,ww-24,14.5,22)
    p.text(x,y+438,'这张图不描述当前版本的具体参数。',13,MUTED)

def map_delta(p,x,y,w):
    p.rect(x,y,w,356,'#edf0e9',LINE,5)
    p.rect(x+175,y+93,150,165,'#b8c2b5'); p.text(x+200,y+175,'建筑遮挡',16)
    p.rect(x+345,y+40,120,46,'#dcc9c7'); p.text(x+357,y+68,'疑似敌方高点',13)
    p.rect(x+330,y+277,135,48,'#d7e7de');p.text(x+352,y+306,'撤离方向',16,p.color,True)
    p.circle(x+65,y+48,17,p.color);p.text(x+55,y+54,'队',16,'#ffffff',True)
    p.text(x+18,y+91,'三人 / 一人受伤',13)
    p.arrow(x+89,y+49,x+286,y+49);p.arrow(x+298,y+60,x+350,y+264)
    p.text(x+143,y+30,'A：短线，暴露路段',13,p.color)
    p.arrow(x+65,y+108,x+65,y+298,dash=True);p.arrow(x+80,y+303,x+313,y+303,dash=True)
    p.text(x+90,y+339,'B：侧路，出口未确认',13,p.color)
    p.line(x+405,y+88,x+330,y+179,'#af5250',2,True);p.text(x+363,y+173,'可能枪线',12,'#af5250')
    p.rect(x+43,y+165,78,37,'#cbd9d2');p.text(x+49,y+189,'恢复候选点',12)
    p.circle(x+260,y+304,15,'#fff4dc','#b98834');p.text(x+255,y+310,'?',18,'#8a6420',True)
    p.para(x,y+387,'实线：直达路线　虚线：侧路　红线：疑似枪线\n图中没有技能范围、地图比例或必胜路线含义。',w,14,23,MUTED)

def map_valorant(p,x,y,w):
    p.rect(x,y,w,356,'#edf0f1',LINE,5)
    p.rect(x+190,y+50,110,55,'#ccd5d8');p.text(x+213,y+83,'近点箱体',14)
    p.rect(x+335,y+115,154,45,'#ccd5d8');p.text(x+354,y+143,'后方架枪区',14)
    p.rect(x+115,y+214,65,104,'#c5ced2');p.rect(x+249,y+214,65,104,'#c5ced2')
    p.circle(x+214,y+327,14,p.color);p.text(x+191,y+355,'进攻方',13,p.color)
    p.circle(x+402,y+205,42,'#dccddc','#aa8fa9');p.text(x+376,y+211,'远线烟',14)
    p.arrow(x+214,y+307,x+214,y+170)
    p.circle(x+132,y+141,11,'#586e89');p.text(x+43,y+142,'未知近点',13)
    p.line(x+143,y+147,x+214,y+267,'#9e3e4c',2,True)
    p.line(x+425,y+165,x+222,y+272,'#586e89',2,True)
    p.text(x+314,y+303,'烟处理远线',14,p.color,True);p.text(x+314,y+326,'近点仍需有人清',13,MUTED)
    p.para(x,y+386,'箭头：推进方向　圆形：烟雾示意　虚线：枪线\n烟雾仅改变视野，不代表近点与烟后安全。',w,14,23,MUTED)

def timeline(p,x,y,w):
    left=x+140; unit=(w-155)/10
    for t in range(11):
        xx=left+t*unit;p.line(xx,y+28,xx,y+289,LINE);p.text(xx-4,y+15,str(t),12,MUTED)
    for i,(label,a,b,col) in enumerate([('信息可用',2,8,'#507d8a'),('远线遮挡',3,7,'#8b719e'),('队友跟进',4,6,p.color),('重叠窗口',4,6,'#b78637')]):
        yy=y+45+i*61;p.text(x,yy+21,label,15,INK,True);p.rect(left+a*unit,yy,(b-a)*unit,32,col,r=3)
        p.text(left+a*unit+6,yy+22,f'{a} 至 {b}',12,'#ffffff')
    p.rect(x,y+325,w,77,'#fff1de',r=4)
    p.para(x+16,y+351,'队友延迟到第 7 秒：三段条件没有共同区间。\nW = max(0, 7 - 7) = 0 秒。',w-32,15,25)
    p.text(x,y+431,'图内全部秒数为假设值，不是现行技能参数。',13,MUTED)

def source_panel(p,doc,x,y,w):
    count=len(doc['sources']); step=46 if count>6 else 91
    for i,(sid,title,date,url,use) in enumerate(doc['sources']):
        yy=y+i*step
        p.text(x,yy+17,sid,13,p.color,True)
        p.text(x+36,yy+17,title,13 if count>6 else 16,INK,True,url)
        p.text(x+36,yy+36,date,11.5,MUTED)
        if count<=6:p.para(x+36,yy+58,use,w-44,13.5,20,MUTED)
        p.line(x,yy+step-5,x+w,yy+step-5)

def build(path):
    # The Chinese font does not contain subscript digits; use accessible ASCII names.
    doc=json.loads(path.read_text(encoding='utf-8').replace('p₀','p0').replace('p₁','p1')); folder=path.parent
    out=folder/(doc['filename']+'.pdf')
    c=canvas.Canvas(str(out),pagesize=(841.8898,595.2756),pageCompression=1)
    c.setTitle(doc['title']);c.setAuthor('游戏策划作品集');c.setSubject(doc['subtitle'])
    svgs=[]; qa=[]
    for i,pg in enumerate(doc['pages'],1):
        c.saveState();c.scale(841.8898/W,595.2756/H);p=Page(c,doc['color'])
        p.rect(0,0,W,H,PAPER);p.rect(0,0,8,H,p.color)
        p.text(42,37,doc['short'],12,p.color,True);p.text(850,37,f'{doc["kind"]} / {doc["date"]} / {i:02d}',12,MUTED)
        p.line(42,52,1078,52)
        p.text(42,100,pg['title'],29,INK,True)
        y=p.para(42,137,pg['lead'],1025,18,28,MUTED)
        if y>199:raise ValueError('Lead overflow')
        yy=212
        for heading,body in pg['blocks']:
            p.text(42,yy,heading,17,p.color,True);yy+=29
            yy=p.para(42,yy,body,454,15.5,24);yy+=18
        if yy>691:raise ValueError(f'Body overflow {i}: {yy}')
        p.line(521,193,521,666)
        v=pg['visual'];p.text(548,211,v['title'],15,p.color,True)
        if v['type']=='table':table(p,v,548,230,530)
        elif v['type']=='flow':flow(p,v,548,231,530)
        elif v['type']=='branches':branches(p,v,548,231,530)
        elif v['type']=='recon':recon(p,548,231,530)
        elif v['type']=='jett':jett(p,548,231,530)
        elif v['type']=='map_delta':map_delta(p,548,230,530)
        elif v['type']=='map_valorant':map_valorant(p,548,230,530)
        elif v['type']=='timeline':timeline(p,548,234,530)
        elif v['type']=='sources':source_panel(p,doc,548,231,530)
        p.rect(42,695,1036,49,'#e9eeeb',r=3)
        lines=wrap(pg['take'],994,15)
        if len(lines)>2:raise ValueError('Take overflow')
        p.para(62,716,pg['take'],994,15,20,INK,True)
        p.text(42,772,f'游戏策划作品集 / {doc["kind"]} · {i:02d} / 12',11,MUTED)
        xx=620
        for sid in pg['refs']:
            source=next(s for s in doc['sources'] if s[0]==sid)
            p.text(xx,772,sid,11,p.color,False,source[3]);xx+=42
        if not pg['refs']:p.text(840,772,'本文模型 / 假设推演',11,MUTED)
        c.restoreState();c.showPage()
        title=html.escape(pg['title']); svgs.append(f'<article id="p{i}" aria-label="第 {i} 页：{title}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t{i}"><title id="t{i}">{title}</title>'+''.join(p.svg)+'</svg></article>')
        qa.append({'page':i,'body_bottom':yy,'title':pg['title'],'characters':sum(len(b) for _,b in pg['blocks'])+len(pg['lead'])+len(pg['take'])})
    c.save()
    toc=''.join(f'<a href="#p{i}">{i:02d} {html.escape(pg["title"])}</a>' for i,pg in enumerate(doc['pages'],1))
    title=html.escape(doc['title']); subtitle=html.escape(doc['subtitle'])
    header=f'<header><span>{doc["kind"]} / 12 页 / {doc["date"]}</span><h1>{title}</h1><p>{subtitle}</p><a href="{html.escape(doc["filename"])}.pdf">下载 PDF</a><details><summary>页内目录</summary><nav>{toc}</nav></details></header>'
    css='*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#dfe5e2;color:#1e2c33;font-family:"Microsoft YaHei",sans-serif}header{max-width:1120px;margin:36px auto 20px;padding:28px 34px;background:#faf9f5}header span{font-size:13px;color:#586770}h1{font-size:27px;margin:10px 0}header p{color:#586770}a{color:'+doc['color']+'}details{margin-top:16px}nav{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:15px;font-size:14px}article{max-width:1120px;margin:0 auto 28px;box-shadow:0 9px 35px #23372b20;scroll-margin-top:16px}svg{display:block;width:100%;height:auto;font-family:"Microsoft YaHei",sans-serif}footer{max-width:1120px;margin:32px auto;padding:24px;background:#faf9f5;font-size:14px;line-height:1.8}@media(max-width:700px){article{min-width:850px}header,footer{margin:16px}nav{grid-template-columns:1fr}body{overflow-x:auto}}@media print{@page{size:A4 landscape;margin:0}header,footer{display:none}body{background:white}article{width:297mm;max-width:none;height:210mm;margin:0;box-shadow:none;break-after:page}article:last-of-type{break-after:auto}svg{width:297mm;height:210mm}}'
    source_links=''.join(f'<li><a href="{s[3]}">{s[0]} · {html.escape(s[1])}</a> · {html.escape(s[2])}<br>{html.escape(s[4])}</li>' for s in doc['sources'])
    result=f'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><style>{css}</style><body>{header}'+''.join(svgs)+f'<footer><h2>资料索引</h2><ul>{source_links}</ul><p>规则事实、历史改动与假设推演分开标注。文中没有声称完成真实对局采样或玩家测试。</p></footer></body></html>'
    (folder/(doc['filename']+'.html')).write_text(result,encoding='utf-8')
    source_md=f'# {doc["title"]}：信息来源\n\n资料核对：{doc["date"]}。正文为 12 页，历史参数不作当前版本攻略。\n\n| 编号 | 来源 | 日期与用途 |\n|---|---|---|\n'+''.join(f'| {s[0]} | [{s[1]}]({s[3]}) | {s[2]}；{s[4]} |\n' for s in doc['sources'])
    source_md+='\n## 证据边界\n\n- 官方规则只支撑相应机制事实；推演、评价与建议是本文判断。\n- 自绘图不是实机截图；假设秒数、概率与价值单位不是实测。\n- 未采集用户实战、访谈、胜率或后台日志；测试方案没有伪写成测试结果。\n- 历史地区公告只证明对应地区与日期，不自动证明国服同步。\n\n## 知识库按需使用\n\n参考本地 game-system-design-kb 的 00-方法论/README.md、01-战斗系统/README.md。三角洲另参考 03-经济系统/README.md 的资源与消耗概念。不采用无游戏依据的通用数值比例。知识库未修改。\n'
    (folder/'信息来源汇总.md').write_text(source_md,encoding='utf-8')
    md=[f'# {doc["title"]}\n\n{doc["subtitle"]}\n']
    for i,pg in enumerate(doc['pages'],1):
        md.append(f'\n## {i:02d} {pg["title"]}\n\n{pg["lead"]}\n')
        for h,b in pg['blocks']:md.append(f'\n### {h}\n\n{b}\n')
        v=pg['visual'];md.append('\n图表：'+v['title']+'\n')
        if v['type']=='table':
            md.extend(['\n|'+'|'.join(v['headers'])+'|\n','|'+'|'.join(['---']*len(v['headers']))+'|\n'])
            md.extend('|'+'|'.join(r)+'|\n' for r in v['rows'])
        elif 'nodes' in v:md.extend(f'\n{n+1}. {h}：{b}\n' for n,(h,b) in enumerate(v['nodes']))
        md.append('\n'+pg['take']+'\n\n来源：'+('、'.join(pg['refs']) or '本文模型 / 假设推演')+'\n')
    (folder/'正文.md').write_text(''.join(md),encoding='utf-8')
    qa_dir=ROOT/'tmp-qa'/'studies-20260907';qa_dir.mkdir(parents=True,exist_ok=True)
    (qa_dir/(doc['kind']+'-layout.json')).write_text(json.dumps(qa,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'{doc["kind"]}: {len(qa)} pages, {sum(x["characters"] for x in qa)} prose chars, max body {max(x["body_bottom"] for x in qa)}')

if __name__=='__main__':
    for rel in ['02 delta-operator-research/分析内容.json','03 valorant-agent-research/拆解内容.json']:build(ROOT/rel)
