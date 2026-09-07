"""Build plain reading editions and functional maps from the two Markdown sources.

DOCX PDFs are produced with the documents skill renderer after this command.
"""
from pathlib import Path
import html
import re
import json
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Mm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
SPECS = [
    ('02 delta-operator-research', '三角洲行动烽火地带干员系统研究', '三角洲行动玩法分析', '烽火地带', [
        ('配装', ['选择枪械与配件 调整操控', '选择弹药 应对防护差异', '准备护甲与医疗 维持交战状态', '配置背包 决定可携带空间']),
        ('搜集', ['搜索容器 拾取地图物资', '查看战利品 比较物品用途', '整理背包 替换已有物品', '保留任务和制造需要的材料']),
        ('战斗与干员', ['枪械交战 消耗弹药和防护', '侦察与标记 补充小队信息', '烟幕和机动 辅助接近或脱离', '治疗与救援 恢复小队行动能力']),
        ('地图与撤离', ['查看资源区域 安排搜索路线', '辨认枪声与位置 调整接战方向', '查看撤离点 核对可用条件', '到达并撤离 带出可结算物资']),
        ('仓库与交易', ['保存带出物资 留作后续使用', '出售物品 获得购置资金', '购买或兑换 补充下一局装备', '整理仓库 为后续收获留空间']),
        ('任务', ['查看要求 确定本局目标', '完成目标 获取奖励与进度', '部门成长 关联后续解锁', '材料需求 影响搜集优先级']),
        ('特勤处', ['查看设施和升级要求', '投入材料 推进设施升级', '制造物品 补充装备与物资', '长期需求 引导再次进入地图']),
    ]),
    ('03 valorant-agent-research', 'VALORANT英雄技能系统研究', 'VALORANT玩法分析', '无畏契约', [
        ('回合目标', ['购买准备 决定本回合投入', '进攻安装 争取爆能器引爆', '防守阻止安装 或完成拆除', '半场交换阵营 重新处理攻守']),
        ('地图', ['辨认入口与通路 选择推进方向', '观察掩体和高低差 预判枪线', '争夺区域 为安装或回防让路', '调整位置 应对目标与时间变化']),
        ('武器与经济', ['购买枪械护甲 适应当前预算', '购买所需技能 支持本回合安排', '比较武器特点 选择交战距离', '沟通购买意图 协调队伍投入']),
        ('英雄技能', ['选定英雄 确定个人技能组合', '侦察与陷阱 获取有限范围信息', '烟幕遮挡 影响双方视线', '位移与干扰 配合队员行动']),
        ('信息沟通', ['语音报点 传递位置与动向', '地图标记 指示目标和危险', '报告技能准备 协调出手时机', '区分观察与推测 更新旧信息']),
        ('练习与对战', ['练习基础操作 理解射击状态', '熟悉单个英雄 练习技能使用', '不同对战模式 提供体验入口', '回看失误 分清操作和决策问题']),
        ('局外内容', ['解锁英雄 扩大角色选择范围', '选择武器外观 进行个性展示', '组队 与其他玩家共同对战', '查看对局记录 了解比赛结果']),
    ]),
]

def system_map(folder, root_name, groups):
    width, height = 1500, 1560
    im = Image.new('RGB', (width * 2, height * 2), 'white')
    draw = ImageDraw.Draw(im)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="{root_name}系统功能关系图">',
           '<rect width="100%" height="100%" fill="white"/>', '<g font-family="Microsoft YaHei,PingFang SC,sans-serif" fill="#222">']
    def line(points, color='#92adcc', stroke=2):
        draw.line([(int(x*2),int(y*2)) for x,y in points], fill=color, width=stroke*2)
        svg.append(f'<polyline points="'+ ' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="{stroke}"/>')
    def text(x,y,s,size=27,bold=False):
        font = ImageFont.truetype('C:/Windows/Fonts/'+('msyhbd.ttc' if bold else 'msyh.ttc'), size*2)
        draw.text((x*2,y*2),s,font=font,fill='#222',anchor='lt')
        svg.append(f'<text x="{x}" y="{y+size}" font-size="{size}" font-weight="{700 if bold else 400}">{html.escape(s)}</text>')
    def box(x,y,w,h):
        draw.rounded_rectangle((x*2,y*2,(x+w)*2,(y+h)*2),radius=10,fill='#edf2f7',outline='#92adcc',width=3)
        svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="#edf2f7" stroke="#92adcc"/>')
    box(15,708,210,74); text(33,727,root_name,32,True)
    for index,(name,leaves) in enumerate(groups):
        y = 40 + index*211
        center = y+75
        line([(225,745),(253,745),(253,center),(285,center)])
        box(285,center-30,240,60); text(304,center-18,name,29,True)
        for k,leaf in enumerate(leaves):
            ly=y+k*49
            line([(525,center),(563,center),(563,ly+19),(590,ly+19)])
            text(603,ly,leaf)
            line([(600,ly+39),(1450,ly+39)],'#b8c9dc',1)
    svg += ['</g></svg>']
    (folder/'系统关系图.svg').write_text('\n'.join(svg),encoding='utf-8')
    im.save(folder/'系统关系图.png',optimize=True)
    (folder/'系统关系图.md').write_text('# '+root_name+'\n\n'+'\n'.join('## '+name+'\n\n'+'\n'.join('- '+leaf for leaf in leaves)+'\n' for name,leaves in groups),encoding='utf-8')

def inline(s):
    return re.sub(r'(https?://[^\s]+)',lambda m:'<a href="'+html.escape(m[0],quote=True)+'">'+html.escape(m[0])+'</a>',html.escape(s))

def build(spec):
    dirname, oldstem, title, name, groups = spec
    folder=ROOT/dirname
    system_map(folder,name,groups)
    source=(folder/'正文.md').read_text(encoding='utf-8')
    assert source.count('\n## ')==3
    assert not any(c in source for c in ['—','–','\ufffd'])
    blocks=[b.strip() for b in source.split('\n\n') if b.strip()]
    doc=Document()
    sec=doc.sections[0]
    sec.page_width=Mm(210); sec.page_height=Mm(297)
    sec.top_margin=sec.bottom_margin=Mm(22)
    sec.left_margin=sec.right_margin=Mm(24)
    for sty in ['Normal','Title','Heading 1','Heading 2','Caption']:
        style=doc.styles[sty]
        style.font.name='Times New Roman'
        style.font.color.rgb=RGBColor(0,0,0)
        style.element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'),'宋体' if sty=='Normal' else '黑体')
    # The runtime's default Word template contains a blue Title border.
    for border in doc.styles.element.findall('.//'+qn('w:pBdr')):
        border.getparent().remove(border)
    normal=doc.styles['Normal']; normal.font.size=Pt(11)
    normal.paragraph_format.line_spacing=1.5
    normal.paragraph_format.space_after=Pt(7)
    normal.paragraph_format.first_line_indent=Pt(22)
    normal.paragraph_format.widow_control=True
    for sty,size in [('Title',20),('Heading 1',15),('Heading 2',12)]:
        pf=doc.styles[sty].paragraph_format
        doc.styles[sty].font.size=Pt(size)
        pf.space_before=Pt(14 if sty!='Title' else 0); pf.space_after=Pt(8)
        pf.first_line_indent=Pt(0); pf.keep_with_next=True
    foot=sec.footer.paragraphs[0]; foot.alignment=1
    field=OxmlElement('w:fldSimple'); field.set(qn('w:instr'),'PAGE'); foot._p.append(field)
    foot.paragraph_format.first_line_indent=Pt(0)
    core=doc.core_properties; core.title=title; core.subject='系统和功能 接触系统的顺序 核心玩法'; core.author=''; core.last_modified_by=''
    body=[]; is_ref=False
    for block in blocks:
        if block.startswith('### '):
            label=block[4:]; is_ref=label=='参考资料'
            doc.add_heading(label,2); body.append('<h3>'+html.escape(label)+'</h3>')
        elif block.startswith('## '):
            label=block[3:]; doc.add_heading(label,1); body.append('<h2>'+html.escape(label)+'</h2>')
        elif block.startswith('# '):
            doc.add_paragraph(block[2:],'Title'); body.append('<h1>'+html.escape(block[2:])+'</h1>')
        elif block.startswith('!['):
            p=doc.add_paragraph(); p.paragraph_format.first_line_indent=Pt(0)
            shape=p.add_run().add_picture(str(folder/'系统关系图.png'),width=Mm(162))
            shape._inline.docPr.set('descr',name+'主要系统与功能，另附可放大矢量图及文字版')
            body.append('<figure><a href="系统关系图.svg" target="_blank"><img src="系统关系图.svg" alt="'+name+'系统和功能关系图"></a><figcaption><a href="系统关系图.svg" target="_blank">放大系统图</a> · <a href="系统关系图.md">图中文字</a></figcaption></figure>')
        else:
            p=doc.add_paragraph(block)
            if is_ref:
                p.paragraph_format.first_line_indent=Pt(0)
                p.paragraph_format.line_spacing=1.15
                for run in p.runs: run.font.size=Pt(9)
            body.append('<p'+(' class="reference"' if is_ref else '')+'>'+inline(block)+'</p>')
    doc.save(folder/(title+'.docx'))
    css='''body{margin:0;background:#fff;color:#202020;font:17px/1.95 "Songti SC","SimSun",serif}main{max-width:820px;margin:48px auto 80px;padding:0 28px}nav{font:14px/1.8 "Microsoft YaHei",sans-serif;margin-bottom:32px}nav a{margin-right:18px}a{color:#365c83;text-underline-offset:3px;overflow-wrap:anywhere}h1,h2,h3{font-family:"Microsoft YaHei",sans-serif;color:#111;font-weight:600;line-height:1.5}h1{font-size:29px;margin:0 0 26px}h2{font-size:23px;margin:38px 0 20px}h3{font-size:19px;margin:28px 0 12px}p{margin:0 0 16px;text-indent:2em}figure{margin:20px 0 24px}img{width:100%;height:auto}figcaption{font-size:13px;text-align:center}.reference{font-size:13px;text-indent:0;line-height:1.75}@media(max-width:600px){main{margin-top:24px;padding:0 20px}h1{font-size:25px}body{font-size:16px}}@media print{nav,figcaption{display:none}main{max-width:none;margin:0}h2,h3{break-after:avoid}p{orphans:2;widows:2}figure{break-inside:avoid}}'''
    nav=f'<nav><a href="../">作品集首页</a><a href="{oldstem}.pdf">PDF</a><a href="{title}.docx">Word 文档</a><a href="正文.md">正文源文件</a></nav>'
    output='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>'+css+'</style></head><body><main>'+nav+'\n'.join(body)+'</main></body></html>'
    (folder/(oldstem+'.html')).write_text(output,encoding='utf-8')
    refs=source.split('### 参考资料\n\n')[1]
    (folder/'信息来源汇总.md').write_text('# '+title+' 信息来源\n\n核对日期：2026-09-07。正文中的行为解释为设计分析，假设局面不作为实测记录。\n\n'+refs,encoding='utf-8')
    print(json.dumps({'document':title,'characters':len(source),'paragraphs':len(doc.paragraphs)},ensure_ascii=False))

if __name__=='__main__':
    for spec in SPECS: build(spec)
