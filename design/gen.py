# -*- coding: utf-8 -*-
"""สร้าง .dc.html artboards จาก design-system.md — โทนครีม/น้ำตาล mobile-first"""
import os, json
OUT = os.path.dirname(os.path.abspath(__file__))

# ===== tokens (design-system.md) =====
BR9,BR7,BR5,BR3,BR1 = '#3E2C23','#6B4F3F','#9C7A5B','#C9AD8F','#EDE0D1'
CR50,CR100,CR200,WHITE = '#FDFBF7','#F7F1E8','#EFE6D8','#FFFFFF'
IN9,IN6,IN4 = '#2B2420','#6B6259','#A8A099'
OK,WARN,BAD,INFO = '#7A9B76','#D4A24C','#B85C4F','#7B93A8'
# feature accents — muted, ไล่ระดับเดียวกับ brown-500 (ใช้แยกฟีเจอร์ใน Health Care)
CR300 = '#E5D9C6'
CLAY5,CLAY1 = '#B98A72','#F3E4DA'   # (สำรอง)
# ส้มพาสเทล — สีประจำ Pre Care + สีโลโก้
PE7,PE5,PE3,PE1 = '#D97A4E','#E89A6C','#F5BE9B','#FDEADF'
SAGE5,SAGE1 = '#8AA383','#E5EBE2'   # โภชนาการ / สุขภาพทั่วไป
SKY5,SKY1   = '#8AA3B8','#E3EAF0'   # นัดหมาย / เอกสาร
PLUM5,PLUM1 = '#A38C9C','#EEE6EC'   # อัลบั้ม / ความทรงจำ
SHADOW = '0 1px 3px rgba(43,36,32,0.06), 0 1px 2px rgba(43,36,32,0.04)'
FONT = "'Noto Sans Thai', ui-sans-serif, system-ui, sans-serif"

HEAD = '''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap">
  <style>
    body { margin: 0; font-family: 'Noto Sans Thai', ui-sans-serif, system-ui, sans-serif; }
    a { color: #6B4F3F; text-decoration: none; } a:hover { color: #3E2C23; }
  </style>
</helmet>
__BODY__
</x-dc>
<script data-dc-script data-props='__PROPS__'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
'''

ICONS = {
 'home':'<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.8 9.4V20h12.4V9.4"/><path d="M10 20v-5h4v5"/>',
 'pulse':'<path d="M3 12h3.5L9 5.5l4 13 2.5-6.5H21"/>',
 'calendar':'<rect x="3.2" y="5" width="17.6" height="15.8" rx="2.6"/><path d="M8 3.2v3.6M16 3.2v3.6M3.2 10h17.6"/>',
 'users':'<circle cx="9.2" cy="8.2" r="3.3"/><path d="M2.8 20.2c0-3.4 2.9-5.6 6.4-5.6s6.4 2.2 6.4 5.6"/><path d="M16.4 5.3a3.3 3.3 0 0 1 0 5.9"/><path d="M17.9 14.9c2.1.6 3.3 2.3 3.3 4.4"/>',
 'user':'<circle cx="12" cy="8" r="3.7"/><path d="M4.6 20.4c0-3.7 3.3-6.1 7.4-6.1s7.4 2.4 7.4 6.1"/>',
 'plus':'<path d="M12 5.2v13.6M5.2 12h13.6"/>',
 'bell':'<path d="M6.2 9.4a5.8 5.8 0 0 1 11.6 0c0 3.9 1.5 5.4 1.5 5.4H4.7s1.5-1.5 1.5-5.4Z"/><path d="M10.1 18.4a2 2 0 0 0 3.8 0"/>',
 'chev':'<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
 'chevL':'<path d="M14.5 5.5 8 12l6.5 6.5"/>',
 'x':'<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8"/>',
 'check':'<path d="m5 12.5 4.5 4.5L19 7"/>',
 'copy':'<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.2"/><path d="M15.5 5.5h-9a2.5 2.5 0 0 0-2.5 2.5v9"/>',
 'dots':'<circle cx="12" cy="5.2" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.8" r="1.3"/>',
 'eye':'<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
 'alert':'<circle cx="12" cy="12" r="8.8"/><path d="M12 7.8v4.8M12 16.1v.1"/>',
 'scale':'<path d="M12 4.2v3M6.5 7.2h11l2.8 9.4a4 4 0 0 1-3.8 5.1H7.5a4 4 0 0 1-3.8-5.1Z"/>',
 'heart':'<path d="M12 19.6S4.2 15 4.2 9.7A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7.8 2.1c0 5.3-7.8 9.9-7.8 9.9Z"/>',
 'clock':'<circle cx="12" cy="12" r="8.8"/><path d="M12 7.2V12l3.2 2"/>',
 'pin':'<path d="M19 10.4c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10.2" r="2.6"/>',
 'edit':'<path d="M16.5 4.4a2.3 2.3 0 0 1 3.3 3.3L8.4 19.1l-4.3 1 1-4.3Z"/>',
 'trash':'<path d="M4.5 7h15M9.5 7V4.8h5V7M6.6 7l.9 12.4h9l.9-12.4"/>',
 'mail':'<rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2.4"/><path d="m3.5 7 8.5 6 8.5-6"/>',
 'lock':'<rect x="4.8" y="10.4" width="14.4" height="9.8" rx="2.4"/><path d="M8.3 10.4V7.9a3.7 3.7 0 0 1 7.4 0v2.5"/>',
 'sliders':'<path d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="1.9"/><circle cx="15" cy="12" r="1.9"/><circle cx="8" cy="17" r="1.9"/>',
 'logout':'<path d="M9.5 20.2H6a2.4 2.4 0 0 1-2.4-2.4V6.2A2.4 2.4 0 0 1 6 3.8h3.5"/><path d="m15 8.2 3.8 3.8-3.8 3.8M18.8 12H9.2"/>',
 'baby':'<circle cx="12" cy="12" r="8.8"/><path d="M9 10.4v.1M15 10.4v.1M9.4 14.6a3.6 3.6 0 0 0 5.2 0"/>',
 'globe':'<circle cx="12" cy="12" r="8.8"/><path d="M3.4 12h17.2M12 3.2a13 13 0 0 1 0 17.6 13 13 0 0 1 0-17.6"/>',
 'shield':'<path d="M12 3.4 5 6v5.4c0 4.3 3 7.5 7 9.2 4-1.7 7-4.9 7-9.2V6Z"/>',
 'album':'<rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.6"/><circle cx="8.6" cy="9.6" r="1.7"/><path d="m3.8 17.2 4.6-4.3 3.4 3 3.2-2.6 5.2 4.5"/>',
 'image':'<rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.6"/><circle cx="8.6" cy="9.6" r="1.7"/><path d="m4 17.4 4.4-4.1 3.4 3 3.2-2.6 5 4.3"/>',
 'camera':'<path d="M3.2 8.6a2 2 0 0 1 2-2h1.9l1.3-2h7.2l1.3 2h1.9a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H5.2a2 2 0 0 1-2-2Z"/><circle cx="12" cy="12.8" r="3.4"/>',
 'share':'<circle cx="17.5" cy="5.8" r="2.6"/><circle cx="6.5" cy="12" r="2.6"/><circle cx="17.5" cy="18.2" r="2.6"/><path d="m8.9 10.7 6.2-3.5M8.9 13.3l6.2 3.5"/>',
 'download':'<path d="M12 4v11M7.6 11.2 12 15.6l4.4-4.4"/><path d="M4.5 19.4h15"/>',
 'sparkle':'<path d="M12 3.6 13.7 9l5.4 1.7-5.4 1.7L12 17.8l-1.7-5.4L4.9 10.7 10.3 9Z"/>',
 'google':'GOOGLE',
  'wallet':'<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a2 2 0 0 1 2 2v1"/><path d="M3 8.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 10v5h-4a2.5 2.5 0 0 1 0-5h4"/>',
  'receipt':'<path d="M5 3v18l2.5-1.6L10 21l2-1.6L14 21l2.5-1.6L19 21V3H5Z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  'trend':'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'
}

def ic(name, size=20, color=IN6, sw=1.75):
    if name=='google':
        return ('<svg width="%d" height="%d" viewBox="0 0 24 24">'
          '<path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.35Z"/>'
          '<path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/>'
          '<path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.83V7.5H3.07a10 10 0 0 0 0 9l3.34-2.58Z"/>'
          '<path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.86-2.86C16.95 2.98 14.7 2 12 2a10 10 0 0 0-8.93 5.5l3.34 2.59C7.2 7.72 9.4 5.95 12 5.95Z"/>'
          '</svg>') % (size,size)
    return ('<svg width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="%s" '
            'stroke-width="%s" stroke-linecap="round" stroke-linejoin="round">%s</svg>'
            ) % (size, size, color, sw, ICONS[name])

def face(kind, size=26, color=IN6, sw=1.6):
    m = {'great':'<path d="M8.4 14a4.4 4.4 0 0 0 7.2 0"/><path d="M8.6 9.6v.1M15.4 9.6v.1"/>',
         'good':'<path d="M8.8 13.8a4 4 0 0 0 6.4 0"/><path d="M8.8 9.6v.1M15.2 9.6v.1"/>',
         'okay':'<path d="M9 14.2h6"/><path d="M8.8 9.6v.1M15.2 9.6v.1"/>',
         'tired':'<path d="M9 14.6c1-.7 2-.7 3 0s2 .7 3 0"/><path d="M7.8 9.6h2.2M14 9.6h2.2"/>',
         'bad':'<path d="M8.8 15a4 4 0 0 1 6.4 0"/><path d="M8.8 9.6v.1M15.2 9.6v.1"/>'}[kind]
    return ('<svg width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="%s" '
            'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/>%s</svg>'
            ) % (size,size,color,sw,m)

def _svg(inner, size=96, vb=96):
    return ('<svg width="%d" height="%d" viewBox="0 0 %d %d" fill="none" '
            'xmlns="http://www.w3.org/2000/svg">%s</svg>') % (size, size, vb, vb, inner)

def mark_c(size=96, c1=None, c2=None, c3=None):
    """โลโก้ Pre Care — หัวใจกลมมนมีใบหน่ออ่อนงอกด้านบน (ตัวเลือก C ที่เลือกใช้)"""
    c1 = c1 or '#E89A6C'; c2 = c2 or '#F5BE9B'; c3 = c3 or '#8AA383'
    return _svg(
      '<path d="M48 82C48 82 17 63 17 42.5A16.5 16.5 0 0 1 48 34a16.5 16.5 0 0 1 31 8.5C79 63 48 82 48 82Z" fill="%s"/>' % c1
      + '<path d="M48 36c0-2 .3-4 .9-5.8" stroke="%s" stroke-width="4" stroke-linecap="round"/>' % c3
      + '<path d="M50 28c1.5-6 7-10 13-10 0 6.5-5 12-11.5 12.5-.6 0-1.1-1-1.5-2.5Z" fill="%s"/>' % c3
      + '<circle cx="38" cy="50" r="4.5" fill="%s"/>' % c2
      + '<circle cx="58" cy="50" r="4.5" fill="%s"/>' % c2, size)

_mark_c_inline = mark_c

# ===== building blocks =====
def screen(*parts, bg=CR50, h=844):
    return ('<div style="width: 390px; min-height: %dpx; background: %s; display: flex; '
            'flex-direction: column; color: %s;">%s</div>') % (h, bg, IN9, ''.join(parts))

def topbar(title, left=None, right=None, bg=WHITE):
    l = left or '<div style="width: 24px;"></div>'
    r = right or '<div style="width: 24px;"></div>'
    return ('<div style="height: 56px; flex: none; padding: 0 16px; background: %s; '
            'border-bottom: 1px solid %s; display: flex; align-items: center; justify-content: space-between; gap: 12px;">'
            '%s<div style="font-size: 16px; font-weight: 600; color: %s;">%s</div>%s</div>'
            ) % (bg, CR200, l, IN9, title, r)

def body(*parts, pad=16, gap=16, grow=True):
    return ('<div style="%spadding: %dpx; display: flex; flex-direction: column; gap: %dpx;">%s</div>'
            ) % ('flex: 1; ' if grow else '', pad, gap, ''.join(parts))

NAV = [('home','หน้าแรก'),('pulse','สุขภาพ'),('calendar','นัดหมาย'),('album','อัลบั้ม'),('user','โปรไฟล์')]
def bottomnav(active=0):
    items = []
    for i,(k,label) in enumerate(NAV):
        on = i == active
        col = BR7 if on else IN4
        pill = ('padding: 4px 14px; border-radius: 9999px; background: %s;' % BR1) if on else 'padding: 4px 14px;'
        items.append('<div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">'
                     '<div style="%s display: flex; align-items: center; justify-content: center;">%s</div>'
                     '<div style="font-size: 11px; color: %s; font-weight: %s;">%s</div></div>'
                     % (pill, ic(k, 21, col, 1.8), col, '500' if on else '400', label))
    return ('<div style="margin-top: auto; flex: none; height: 64px; background: %s; border-top: 1px solid %s; '
            'display: flex; align-items: center; justify-content: space-around; padding: 0 6px;">%s</div>'
            ) % (WHITE, CR200, ''.join(items))

def card(*parts, pad=16, bg=WHITE, border=CR200, radius=12, gap=12, extra=''):
    return ('<div style="background: %s; border: 1px solid %s; border-radius: %dpx; padding: %dpx; '
            'box-shadow: %s; display: flex; flex-direction: column; gap: %dpx; %s">%s</div>'
            ) % (bg, border, radius, pad, SHADOW, gap, extra, ''.join(parts))

def btn(label, kind='primary', icon_left=None, full=True, h=44):
    st = {'primary': ('background: %s; color: %s; border: none;' % (BR7, WHITE)),
          'secondary': ('background: %s; color: %s; border: 1px solid %s;' % (WHITE, BR7, BR3)),
          'ghost': ('background: transparent; color: %s; border: none;' % BR7),
          'danger': ('background: %s; color: %s; border: none;' % (BAD, WHITE)),
          'disabled': ('background: %s; color: %s; border: none;' % (CR200, IN4))}[kind]
    ico = ('%s' % icon_left) if icon_left else ''
    return ('<div style="height: %dpx; %s border-radius: 12px; padding: 0 20px; display: flex; '
            'align-items: center; justify-content: center; gap: 8px; font-size: 16px; font-weight: 500; '
            '%s">%s<span>%s</span></div>'
            ) % (h, st, 'width: 100%; box-sizing: border-box;' if full else '', ico, label)

def label(t):
    return '<div style="font-size: 14px; color: %s;">%s</div>' % (IN6, t)

def field(lbl, value='', placeholder='', state='default', hint=None, suffix=None, icon_right=None):
    border, bw = CR200, '1px'
    if state == 'focus': border, bw = BR5, '1.5px'
    if state == 'error': border, bw = BAD, '1.5px'
    txt = value if value else placeholder
    col = IN9 if value else IN4
    sfx = ('<span style="font-size: 14px; color: %s; flex: none;">%s</span>' % (IN6, suffix)) if suffix else ''
    ir = ('<span style="flex: none; display: flex;">%s</span>' % icon_right) if icon_right else ''
    inner = ('<div style="height: 44px; background: %s; border: %s solid %s; border-radius: 8px; '
             'padding: 0 12px; display: flex; align-items: center; gap: 8px; box-sizing: border-box;">'
             '<span style="flex: 1; font-size: 16px; color: %s; min-width: 0; overflow: hidden; '
             'text-overflow: ellipsis; white-space: nowrap;">%s</span>%s%s</div>'
             ) % (CR50, bw, border, col, txt, sfx, ir)
    h = ''
    if hint:
        hc = BAD if state == 'error' else IN4
        h = '<div style="font-size: 12px; color: %s;">%s</div>' % (hc, hint)
    return ('<div style="display: flex; flex-direction: column; gap: 6px;">%s%s%s</div>'
            ) % (label(lbl), inner, h)

def textarea(lbl, placeholder, rows=4):
    return ('<div style="display: flex; flex-direction: column; gap: 6px;">%s'
            '<div style="min-height: %dpx; background: %s; border: 1px solid %s; border-radius: 8px; '
            'padding: 12px; font-size: 16px; color: %s; box-sizing: border-box;">%s</div></div>'
            ) % (label(lbl), rows*22+24, CR50, CR200, IN4, placeholder)

def badge(text, kind='owner'):
    m = {'owner': (BR1, BR9), 'editor': (CR200, IN9), 'viewer': (CR100, IN6),
         'warn': (WARN, '#2B2420'), 'now': (BR7, WHITE), 'soft': (CR200, IN6), 'past': (CR100, IN4)}
    bg, fg = m[kind]
    return ('<span style="background: %s; color: %s; border-radius: 9999px; padding: 4px 12px; '
            'font-size: 12px; font-weight: 500; white-space: nowrap;">%s</span>') % (bg, fg, text)

def chip(text, on=False):
    bg, fg, bd = (BR1, BR9, BR1) if on else (WHITE, IN6, CR200)
    return ('<span style="background: %s; color: %s; border: 1px solid %s; border-radius: 9999px; '
            'padding: 7px 14px; font-size: 14px; white-space: nowrap;">%s</span>') % (bg, fg, bd, text)

def row(*parts, gap=8, align='center', justify='flex-start', wrap=False, extra=''):
    return ('<div style="display: flex; align-items: %s; justify-content: %s; gap: %dpx; %s%s">%s</div>'
            ) % (align, justify, gap, 'flex-wrap: wrap; ' if wrap else '', extra, ''.join(parts))

def col(*parts, gap=8, extra=''):
    return '<div style="display: flex; flex-direction: column; gap: %dpx; %s">%s</div>' % (gap, extra, ''.join(parts))

def txt(t, size=16, color=None, weight=400, extra=''):
    return '<span style="font-size: %dpx; color: %s; font-weight: %d; %s">%s</span>' % (size, color or IN9, weight, extra, t)

def avatar(initial, size=36, bg=BR3, fg=WHITE, fs=15):
    return ('<div style="width: %dpx; height: %dpx; border-radius: 9999px; background: %s; color: %s; '
            'display: flex; align-items: center; justify-content: center; font-size: %dpx; font-weight: 600; flex: none;">%s</div>'
            ) % (size, size, bg, fg, fs, initial)

def progress(pct, h=8):
    return ('<div style="height: %dpx; width: 100%%; background: %s; border-radius: 9999px; overflow: hidden;">'
            '<div style="height: 100%%; width: %d%%; background: %s; border-radius: 9999px;"></div></div>'
            ) % (h, CR200, pct, BR5)

def section_head(t):
    return '<div style="font-size: 14px; color: %s; padding: 4px 0 0;">%s</div>' % (IN6, t)

def fab():
    return ('<div style="position: absolute; right: 16px; bottom: 80px; width: 56px; height: 56px; '
            'border-radius: 9999px; background: %s; box-shadow: 0 4px 12px rgba(43,36,32,0.18); '
            'display: flex; align-items: center; justify-content: center;">%s</div>'
            ) % (BR7, ic('plus', 26, WHITE, 2))

def write(name, bodyhtml, w=390, h=844):
    props = json.dumps({"$preview": {"width": w, "height": h}}, ensure_ascii=False)
    out = HEAD.replace('__BODY__', bodyhtml).replace('__PROPS__', props)
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(out)

def screen(*parts, bg=CR50, h=844):
    return ('<div style="width: 390px; min-height: %dpx; background: %s; display: flex; '
            'flex-direction: column; position: relative; color: %s;">%s</div>') % (h, bg, IN9, ''.join(parts))

def logo(size=52):
    return _mark_c_inline(size)

def money(n, size=16, color=None, weight=400):
    """แสดงเงินแบบไทย — ไม่โชว์ทศนิยมถ้าเป็นจำนวนเต็ม"""
    txt_ = '฿' + format(n, ',')
    return txt(txt_, size, color or IN9, weight, 'font-variant-numeric: tabular-nums;')

def money_input(value=None, w=110, state='default'):
    """ช่องกรอกเงินในแถว — ว่างไว้ = ยังไม่ได้ระบุ ไม่ใช่ศูนย์"""
    border = CR200 if state == 'default' else (BR5 if state == 'focus' else CR200)
    bw = '1.5px' if state == 'focus' else '1px'
    shown = ('฿' + format(value, ',')) if value is not None else 'ยังไม่ระบุ'
    col_ = IN9 if value is not None else IN4
    return ('<div style="width: %dpx; height: 40px; background: %s; border: %s solid %s; border-radius: 8px; '
            'padding: 0 10px; display: flex; align-items: center; justify-content: flex-end; box-sizing: border-box;">'
            '<span style="font-size: 15px; color: %s; font-variant-numeric: tabular-nums;">%s</span></div>'
            ) % (w, CR50, bw, border, col_, shown)

# ---- กลุ่มการรักษา ----
# นัดหมายแยกเรื่องกันได้ (ฝากครรภ์ / ทันตกรรม / โรคประจำตัว) ยอดรวมจึงต้อง
# แยกดูรายกลุ่มได้ ไม่งั้นค่าทำฟันจะไปปนกับค่าฝากครรภ์แล้วตัวเลขไม่มีความหมาย
GROUP_COLORS = {'preg': (PE1, PE7), 'dent': (SKY1, '#5E7B94'), 'gen': (SAGE1, '#5F7358'),
                'other': (CR200, IN6)}

def group_tag(name, kind='preg', size=11):
    bg, fg = GROUP_COLORS[kind]
    return ('<span style="background: %s; color: %s; border-radius: 6px; padding: 2px 7px; '
            'font-size: %dpx; white-space: nowrap;">%s</span>') % (bg, fg, size, name)

def group_dot(kind='preg', size=9):
    _, fg = GROUP_COLORS[kind]
    return ('<span style="width: %dpx; height: %dpx; border-radius: 9999px; background: %s; '
            'flex: none;"></span>') % (size, size, fg)

def segmented(items, sel=0):
    """ต้องรับได้เกิน 2 ตัวเลือกแล้ว — toggle2 เดิมทำได้แค่สอง"""
    out = []
    for i, t in enumerate(items):
        on = i == sel
        out.append('<div style="flex: 1; height: 38px; border-radius: 8px; background: %s; color: %s; '
                   'display: flex; align-items: center; justify-content: center; font-size: 13px; '
                   'font-weight: %s; box-shadow: %s; white-space: nowrap;">%s</div>'
                   % (WHITE if on else 'transparent', BR9 if on else IN6, '500' if on else '400',
                      SHADOW if on else 'none', t))
    return ('<div style="background: %s; border-radius: 10px; padding: 4px; display: flex; gap: 4px;">%s</div>'
            ) % (CR100, ''.join(out))

def group_filter(active=0):
    names = [('ทั้งหมด', None), ('ฝากครรภ์', 'preg'), ('ทันตกรรม', 'dent'), ('โรคประจำตัว', 'gen')]
    out = []
    for i, (n, k) in enumerate(names):
        on = i == active
        bg, fg, bd = (BR1, BR9, BR1) if on else (WHITE, IN6, CR200)
        dot = (group_dot(k, 8) + ' ') if k else ''
        out.append('<span style="background: %s; color: %s; border: 1px solid %s; border-radius: 9999px; '
                   'padding: 6px 12px; font-size: 13px; white-space: nowrap; display: inline-flex; '
                   'align-items: center; gap: 6px;">%s%s</span>' % (bg, fg, bd, dot, n))
    return ('<div style="display: flex; gap: 6px; flex-wrap: wrap;">%s</div>') % ''.join(out)

def group_summary_card(name, kind, total, count, missing=0, pct=100):
    _, fg = GROUP_COLORS[kind]
    right = col(money(total, 19, IN9, 600),
                (txt('%d นัดยังไม่ระบุ' % missing, 11, WARN) if missing else txt('%d นัด' % count, 11, IN4)),
                gap=2, extra='align-items: flex-end;')
    bar = ('<div style="height: 6px; background: %s; border-radius: 9999px; overflow: hidden;">'
           '<div style="height: 100%%; width: %d%%; background: %s; border-radius: 9999px;"></div></div>'
           ) % (CR200, pct, fg)
    return card(row(row(group_dot(kind, 10), txt(name, 15, IN9, 500), gap=8), right,
                    justify='space-between', align='flex-start'),
                bar, pad=14, gap=10)


def month_nav(name, total, delta=None, groups=None, empty=False):
    """หัวเดือน — ดูทีละเดือน ไม่ใช่ไล่ยาวทั้งปี

    ลูกศรซ้ายขวาเปลี่ยนเดือน ตัวเลขใหญ่คือของเดือนที่เลือกอยู่เท่านั้น
    """
    arrow = lambda d: ('<div style="width: 36px; height: 36px; border-radius: 9999px; background: %s; '
                       'display: flex; align-items: center; justify-content: center; flex: none;">%s</div>'
                       ) % (CR100, ('<div style="transform: rotate(180deg); display: flex;">%s</div>' % ic('chev', 17, IN6, 2))
                            if d == 'l' else ic('chev', 17, IN6, 2))
    if empty:
        big = txt('ยังไม่ได้ระบุ', 20, WARN, 600)
        sub = txt('เดือนนี้มี 3 นัด ยังไม่ได้กรอกค่าใช้จ่ายสักนัด', 12, IN6)
    else:
        big = money(total, 32, IN9, 600)
        if delta is None:
            sub = txt('เดือนแรกที่มีข้อมูล', 12, IN4)
        else:
            up = delta > 0
            sub = row(('<span style="display: inline-flex; transform: rotate(%ddeg);">%s</span>'
                       ) % (0 if up else 180, ic('trend', 13, WARN if up else OK, 2)),
                      txt('%s%s จากเดือนก่อน' % ('+' if up else '−', '฿' + format(abs(delta), ',')),
                          12, IN6), gap=5)
    gr = ''
    if groups:
        gr = row(*[row(group_dot(k, 8), txt('%s %s' % (n, '฿' + format(v, ',')), 11, IN6), gap=5)
                   for n, k, v in groups], gap=12, wrap=True)
    return card(
        row(arrow('l'), txt(name, 16, IN9, 600), arrow('r'), justify='space-between'),
        col(big, sub, gap=4, extra='align-items: center; text-align: center;'),
        gr, pad=14, gap=12)

def month_strip(items, sel=2):
    """แถบเลือกเดือน — กดข้ามไปเดือนไหนก็ได้ ไม่ต้องกดลูกศรทีละที
    แท่งเล็กใต้ชื่อเดือนทำให้เทียบได้ในตาเดียวว่าเดือนไหนจ่ายเยอะ
    """
    mx = max((v or 0) for _, v in items) or 1
    out = []
    for i, (n, v) in enumerate(items):
        on = i == sel
        h = max(3, int(round((v or 0) / mx * 26)))
        bar_col = BR7 if on else BR3
        out.append(
            '<div style="flex: none; width: 58px; display: flex; flex-direction: column; align-items: center; '
            'gap: 5px; padding: 8px 0; border-radius: 10px; background: %s;">'
            '<div style="height: 28px; display: flex; align-items: flex-end;">'
            '<div style="width: 16px; height: %dpx; border-radius: 4px; background: %s;"></div></div>'
            '<span style="font-size: 11px; color: %s; font-weight: %s;">%s</span></div>'
            % (BR1 if on else 'transparent', h, bar_col, BR9 if on else IN4, '600' if on else '400', n))
    return ('<div style="display: flex; gap: 2px; overflow-x: auto; background: %s; border: 1px solid %s; '
            'border-radius: 12px; padding: 4px;">%s</div>') % (WHITE, CR200, ''.join(out))

# ---------- 1. Login ----------
write('Login.dc.html', screen(
  '<div style="flex: 1; padding: 56px 24px 24px; display: flex; flex-direction: column; gap: 28px;">',
  col(logo(), txt('Health Care', 28, IN9, 600),
      txt('ดูแลสุขภาพของทั้งครอบครัว ไว้ในที่เดียว', 14, IN6),
      gap=10, extra='align-items: center; text-align: center;'),
  btn('เข้าสู่ระบบด้วย Google', 'secondary', ic('google', 20)),
  row('<div style="flex: 1; height: 1px; background: %s;"></div>' % CR200,
      txt('หรือ', 12, IN4),
      '<div style="flex: 1; height: 1px; background: %s;"></div>' % CR200, gap=12),
  col(field('อีเมล', value='yaya@example.com', icon_right=ic('mail', 18, IN4)),
      field('รหัสผ่าน', value='••••••••••', icon_right=ic('eye', 18, IN4)),
      gap=16),
  btn('เข้าสู่ระบบ', 'primary'),
  ('<div style="background: %s; border-radius: 8px; padding: 12px 14px; font-size: 12px; '
   'line-height: 1.6; color: %s;">ลืมรหัสผ่าน? ตอนนี้ยังรีเซ็ตเองไม่ได้ — ถ้าอีเมลของคุณเป็น Gmail '
   'ให้กด<span style="color: %s; font-weight: 500;">เข้าสู่ระบบด้วย Google</span> ด้านบนได้เลย '
   'ระบบจะพาเข้าบัญชีเดิมให้อัตโนมัติ</div>') % (CR100, IN6, BR7),
  '</div>',
  ('<div style="flex: none; padding: 20px 24px 32px; text-align: center; font-size: 14px; color: %s;">'
   'ยังไม่มีบัญชี? <span style="color: %s; font-weight: 500;">สมัครสมาชิก</span></div>') % (IN6, BR7),
))

# ---------- 2. Signup ----------
write('Signup.dc.html', screen(
  '<div style="flex: 1; padding: 48px 24px 24px; display: flex; flex-direction: column; gap: 24px;">',
  col(logo(44), txt('สมัครสมาชิก', 24, IN9, 600), txt('Health Care', 13, IN4), gap=8, extra='align-items: center;'),
  btn('สมัครด้วย Google', 'secondary', ic('google', 20)),
  row('<div style="flex: 1; height: 1px; background: %s;"></div>' % CR200, txt('หรือ', 12, IN4),
      '<div style="flex: 1; height: 1px; background: %s;"></div>' % CR200, gap=12),
  col(field('ชื่อ-นามสกุล', value='ญาญ่า ใจดี'),
      field('อีเมล', value='yaya@example', state='error', hint='รูปแบบอีเมลไม่ถูกต้อง'),
      col(field('รหัสผ่าน', value='••••••••', icon_right=ic('eye', 18, IN4)),
          row('<div style="flex: 1; height: 4px; border-radius: 9999px; background: %s;"></div>' % OK,
              '<div style="flex: 1; height: 4px; border-radius: 9999px; background: %s;"></div>' % OK,
              '<div style="flex: 1; height: 4px; border-radius: 9999px; background: %s;"></div>' % CR200,
              gap=5),
          txt('ความปลอดภัยระดับกลาง — เพิ่มตัวเลขหรืออักขระพิเศษ', 12, IN4), gap=7),
      gap=16),
  row(('<div style="width: 20px; height: 20px; border-radius: 5px; background: %s; display: flex; '
       'align-items: center; justify-content: center; flex: none;">%s</div>') % (BR7, ic('check', 13, WHITE, 2.6)),
      ('<span style="font-size: 14px; color: %s; line-height: 1.5;">ยอมรับ'
       '<span style="color: %s;">เงื่อนไขการใช้งาน</span> และ'
       '<span style="color: %s;">นโยบายความเป็นส่วนตัว</span></span>') % (IN6, BR7, BR7),
      gap=10, align='flex-start'),
  btn('สมัครสมาชิก', 'primary'),
  '</div>',
  ('<div style="flex: none; padding: 20px 24px 32px; text-align: center; font-size: 14px; color: %s;">'
   'มีบัญชีอยู่แล้ว? <span style="color: %s; font-weight: 500;">เข้าสู่ระบบ</span></div>') % (IN6, BR7),
))

# ---------- 3. Invite accept ----------
write('Invite.dc.html', screen(
  '<div style="flex: 1; padding: 24px; display: flex; flex-direction: column; justify-content: center; gap: 24px;">',
  card(
    col(avatar('ญ', 60, BR3, WHITE, 24),
        col(('<div style="font-size: 20px; font-weight: 600; color: %s; line-height: 1.5;">'
             'ญาญ่า ใจดี<br><span style="font-size: 16px; font-weight: 400; color: %s;">เชิญคุณเข้าร่วมครอบครัว</span></div>') % (IN9, IN6),
            txt('ครอบครัวใจดี', 20, BR7, 600), gap=6, extra='text-align: center;'),
        gap=16, extra='align-items: center;'),
    '<div style="height: 1px; background: %s; margin: 4px 0;"></div>' % CR200,
    row(txt('สิทธิ์ที่จะได้รับ', 14, IN6), badge('แก้ไขได้ · editor', 'editor'), justify='space-between'),
    ('<div style="font-size: 13px; color: %s; line-height: 1.6;">เพิ่มและแก้ไขบันทึกสุขภาพ นัดหมายได้ '
     'แต่แก้วันตั้งครรภ์และเชิญสมาชิกไม่ได้</div>') % IN6,
    pad=24, radius=16, gap=16),
  col(btn('เข้าร่วมครอบครัว', 'primary'), btn('ปฏิเสธคำเชิญ', 'ghost'), gap=8),
  txt('ลิงก์นี้ใช้ได้ถึง 1 ก.ย. 2569', 12, IN4, extra='text-align: center;'),
  '</div>',
))

# ---------- 4. Onboarding step 3 ----------
def dots(active, total=4):
    d = []
    for i in range(total):
        c = BR7 if i == active else (BR3 if i < active else CR200)
        w = 24 if i == active else 8
        d.append('<div style="width: %dpx; height: 8px; border-radius: 9999px; background: %s;"></div>' % (w, c))
    return row(*d, gap=6, justify='center')

def toggle2(a, b, sel=0):
    out = []
    for i, t in enumerate((a, b)):
        on = i == sel
        out.append('<div style="flex: 1; height: 40px; border-radius: 8px; background: %s; color: %s; '
                   'display: flex; align-items: center; justify-content: center; font-size: 14px; '
                   'font-weight: %s; box-shadow: %s;">%s</div>'
                   % (WHITE if on else 'transparent', BR9 if on else IN6, '500' if on else '400',
                      SHADOW if on else 'none', t))
    return ('<div style="background: %s; border-radius: 10px; padding: 4px; display: flex; gap: 4px;">%s</div>'
            ) % (CR100, ''.join(out))

write('Onboarding.dc.html', screen(
  topbar('', left=ic('chevL', 22, IN6), bg=CR50),
  '<div style="flex: 1; padding: 8px 24px 24px; display: flex; flex-direction: column; gap: 28px;">',
  dots(2),
  col(txt('วันที่ตั้งครรภ์', 24, IN9, 600),
      txt('ใช้คำนวณอายุครรภ์และวันคาดคลอด แก้ไขภายหลังได้', 14, IN6, extra='line-height: 1.6;'), gap=8),
  col(label('คุณทราบข้อมูลไหน'), toggle2('วันประจำเดือนครั้งสุดท้าย', 'วันคาดคลอด', 0), gap=8),
  field('วันประจำเดือนครั้งสุดท้าย (LMP)', value='10 มีนาคม 2569', state='focus',
        icon_right=ic('calendar', 18, BR5), hint='นับจากวันแรกของประจำเดือนครั้งล่าสุด'),
  card(row(ic('baby', 22, BR7), txt('จากวันที่นี้ ระบบคำนวณได้', 14, IN6), gap=10),
       '<div style="height: 1px; background: %s;"></div>' % CR200,
       row(col(txt('อายุครรภ์', 12, IN4), txt('24 สัปดาห์ 3 วัน', 16, IN9, 600), gap=3),
           col(txt('วันคาดคลอด', 12, IN4), txt('15 ธ.ค. 2569', 16, IN9, 600), gap=3),
           justify='space-between'),
       bg=BR1, border=BR1, gap=12),
  '</div>',
  '<div style="flex: none; padding: 16px 24px 28px; display: flex; flex-direction: column; gap: 12px;">',
  btn('ถัดไป', 'primary'),
  txt('ยังไม่ทราบ ข้ามไปก่อน', 12, IN4, extra='text-align: center;'),
  '</div>',
))

# ---------- 5. Onboarding step 4 ----------
write('OnboardingDone.dc.html', screen(
  topbar('', left=ic('chevL', 22, IN6), bg=CR50),
  '<div style="flex: 1; padding: 8px 24px 24px; display: flex; flex-direction: column; gap: 28px;">',
  dots(3),
  col(txt('เรียบร้อย', 24, IN9, 600), txt('ตรวจสอบข้อมูลอีกครั้งก่อนเริ่มใช้งาน', 14, IN6), gap=8),
  card(
    col(txt('อายุครรภ์ปัจจุบัน', 14, IN6),
        row('<span style="font-size: 44px; font-weight: 600; color: %s; line-height: 1;">24</span>' % BR7,
            col(txt('สัปดาห์', 16, IN9, 500), txt('3 วัน', 14, IN6), gap=2),
            gap=10, align='baseline'),
        gap=6, extra='align-items: center;'),
    progress(60),
    row(txt('สัปดาห์ 1', 12, IN4), txt('40 สัปดาห์', 12, IN4), justify='space-between'),
    pad=24, radius=16, gap=16, bg=BR1, border=BR1),
  card(
    row(txt('วันประจำเดือนครั้งสุดท้าย', 14, IN6), txt('10 มี.ค. 2569', 14, IN9, 500), justify='space-between'),
    '<div style="height: 1px; background: %s;"></div>' % CR200,
    row(txt('วันคาดคลอด', 14, IN6), txt('15 ธ.ค. 2569', 14, IN9, 500), justify='space-between'),
    '<div style="height: 1px; background: %s;"></div>' % CR200,
    row(txt('ไตรมาส', 14, IN6), badge('ไตรมาส 2', 'editor'), justify='space-between'),
    gap=12),
  txt('แก้ไขภายหลังได้ที่หน้าโปรไฟล์', 12, IN4, extra='text-align: center;'),
  '</div>',
  '<div style="flex: none; padding: 16px 24px 28px;">' + btn('เริ่มใช้ Pre Care', 'primary') + '</div>',
))

# ---------- Dashboard pieces ----------
def dash_topbar():
    bell = ('<div style="position: relative; display: flex;">%s'
            '<div style="position: absolute; top: -1px; right: -1px; width: 8px; height: 8px; '
            'border-radius: 9999px; background: %s; border: 1.5px solid %s;"></div></div>'
            ) % (ic('bell', 22, IN6), WARN, WHITE)
    return ('<div style="height: 56px; flex: none; padding: 0 16px; background: %s; border-bottom: 1px solid %s; '
            'display: flex; align-items: center; justify-content: space-between;">%s%s%s</div>'
            ) % (WHITE, CR200, avatar('ญ', 32, BR3, WHITE, 14),
                 col(row(('<span style="width: 7px; height: 7px; border-radius: 9999px; background: %s; '
                          'display: inline-block;"></span>') % CLAY5,
                         txt('Pre Care', 15, BR9, 600), gap=6),
                     txt('ครอบครัวใจดี', 12, IN4), gap=1, extra='align-items: center;'), bell)

def hero():
    return card(
      txt('อายุครรภ์', 14, IN6, extra='text-align: center;'),
      row('<span style="font-size: 52px; font-weight: 600; color: %s; line-height: 1;">24</span>' % BR7,
          col(txt('สัปดาห์', 16, BR9, 500), txt('3 วัน', 14, IN6), gap=2),
          gap=10, align='baseline', justify='center'),
      progress(60),
      row(col(txt('ไตรมาส', 12, IN4), txt('ที่ 2', 15, IN9, 500), gap=2),
          '<div style="width: 1px; height: 30px; background: %s;"></div>' % BR3,
          col(txt('เหลืออีก', 12, IN4),
              row('<span style="font-size: 20px; font-weight: 700; color: %s; line-height: 1;">112</span>' % BR9,
                  txt('วัน', 13, IN6), gap=4, align='baseline'),
              gap=2, extra='align-items: flex-end;'),
          justify='space-between', extra='padding-top: 4px;'),
      bg=BR1, border=BR1, radius=16, pad=20, gap=14)

def next_appt():
    return card(
      row(txt('นัดหมายถัดไป', 14, IN6), badge('อีก 3 วัน', 'warn'), justify='space-between'),
      row(('<div style="width: 46px; height: 52px; border-radius: 8px; background: %s; display: flex; '
           'flex-direction: column; align-items: center; justify-content: center; gap: 1px; flex: none;">'
           '<span style="font-size: 11px; color: %s;">ส.ค.</span>'
           '<span style="font-size: 20px; font-weight: 600; color: %s; line-height: 1;">28</span></div>'
           ) % (BR1, BR7, BR9),
          col(txt('14:30 · ตรวจครรภ์ตามนัด', 16, IN9, 500),
              row(ic('user', 14, IN4, 1.9), txt('นพ.สมชาย', 13, IN6),
                  ic('pin', 14, IN4, 1.9), txt('รพ.รามาธิบดี', 13, IN6), gap=5, wrap=True),
              gap=5, extra='flex: 1; min-width: 0;'),
          gap=12))

def recent_logs():
    def r(week, w, bp, mood, date, warn=False):
        return row(
          col(txt('สัปดาห์ที่ %s' % week, 15, IN9, 500),
              row(ic('scale', 14, IN4, 1.9), txt('%s กก.' % w, 13, IN6),
                  ic('pulse', 14, BAD if warn else IN4, 1.9),
                  txt(bp, 13, BAD if warn else IN6, 500 if warn else 400), gap=5),
              gap=5, extra='flex: 1; min-width: 0;'),
          col(face(mood, 24, IN4), txt(date, 11, IN4), gap=4, extra='align-items: center;'),
          justify='space-between', gap=12)
    return card(
      row(txt('บันทึกล่าสุด', 14, IN6), row(txt('ดูทั้งหมด', 13, BR7, 500), ic('chev', 14, BR7, 2), gap=2),
          justify='space-between'),
      r('24', '62.5', '118/76', 'good', '12 ส.ค.'),
      '<div style="height: 1px; background: %s;"></div>' % CR200,
      r('23', '62.1', '142/91', 'tired', '5 ส.ค.', warn=True))

write('Main.dc.html', screen(
  dash_topbar(),
  body(hero(), next_appt(), recent_logs(),
       row(btn('บันทึกสุขภาพ', 'secondary', ic('plus', 18, BR7, 2)),
           btn('เพิ่มนัดหมาย', 'secondary', ic('plus', 18, BR7, 2)), gap=10)),
  bottomnav(0),
))

# ---------- Dashboard: ยังไม่ตั้ง LMP ----------
write('DashboardSetup.dc.html', screen(
  dash_topbar(),
  body(
    card(
      row(('<div style="width: 44px; height: 44px; border-radius: 9999px; background: %s; display: flex; '
           'align-items: center; justify-content: center; flex: none;">%s</div>') % (WHITE, ic('calendar', 22, BR7)),
          col(txt('ตั้งค่าวันตั้งครรภ์', 16, IN9, 600),
              txt('เพื่อดูอายุครรภ์และวันคาดคลอด', 13, IN6), gap=3, extra='flex: 1;'),
          gap=12),
      btn('ตั้งค่าตอนนี้', 'primary'),
      bg=CR100, border=CR200, radius=16, pad=20, gap=16),
    next_appt(),
    card(row(txt('บันทึกล่าสุด', 14, IN6), justify='space-between'),
         col(ic('pulse', 28, IN4, 1.6), txt('ยังไม่มีบันทึกสุขภาพ', 14, IN6),
             txt('บันทึกน้ำหนัก ความดัน และอาการในแต่ละสัปดาห์', 12, IN4, extra='text-align: center; line-height: 1.6;'),
             gap=8, extra='align-items: center; padding: 20px 8px;')),
    row(btn('บันทึกสุขภาพ', 'secondary', ic('plus', 18, BR7, 2)),
        btn('เพิ่มนัดหมาย', 'secondary', ic('plus', 18, BR7, 2)), gap=10)),
  bottomnav(0),
))

# ---------- Dashboard: viewer ----------
write('DashboardViewer.dc.html', screen(
  dash_topbar(),
  ('<div style="flex: none; background: %s; border-bottom: 1px solid %s; padding: 10px 16px; '
   'display: flex; align-items: center; gap: 8px;">%s'
   '<span style="font-size: 13px; color: %s;">คุณมีสิทธิ์<span style="font-weight: 500; color: %s;">ดูอย่างเดียว</span> '
   'ในครอบครัวนี้</span></div>') % (CR100, CR200, ic('eye', 16, IN6, 1.9), IN6, IN9),
  body(hero(), next_appt(), recent_logs()),
  bottomnav(0),
))

# ---------- photo helpers ----------
def phototile(kind='scan', w='100%', h=96, radius=10, badge_txt=None, extra=''):
    """placeholder รูป — ยังไม่มีภาพจริง วาดเป็น placeholder ตามหลัก hi-fi"""
    bg, icol = ('#41372F', '#8A7663') if kind == 'scan' else (CR100, BR3)
    wcss = w if isinstance(w, str) else ('%dpx' % w)
    bdg = ''
    if badge_txt:
        bdg = ('<div style="position: absolute; left: 6px; bottom: 6px; background: rgba(43,36,32,0.62); '
               'color: #FFFFFF; font-size: 10px; padding: 2px 7px; border-radius: 9999px;">%s</div>') % badge_txt
    return ('<div style="position: relative; width: %s; height: %dpx; border-radius: %dpx; background: %s; '
            'border: 1px solid %s; display: flex; align-items: center; justify-content: center; '
            'overflow: hidden; flex: none; box-sizing: border-box; %s">%s%s</div>'
            ) % (wcss, h, radius, bg, CR200 if kind != 'scan' else '#41372F', extra,
                 ic('image', 26, icol, 1.6), bdg)

def addphoto(h=96, w='100%', text='เพิ่มรูป'):
    wcss = w if isinstance(w, str) else ('%dpx' % w)
    return ('<div style="width: %s; height: %dpx; border-radius: 10px; border: 1.5px dashed %s; '
            'background: %s; display: flex; flex-direction: column; align-items: center; '
            'justify-content: center; gap: 5px; flex: none; box-sizing: border-box;">%s'
            '<span style="font-size: 12px; color: %s;">%s</span></div>'
            ) % (wcss, h, BR3, CR50, ic('camera', 22, BR5, 1.7), IN6, text)

# ---------- Health list ----------
def log_card(week, date, w, delta, bp, mood, tags, note, by, warn=False, photos=0):
    bpc = BAD if warn else IN9
    return card(
      row(txt('สัปดาห์ที่ %s' % week, 20, IN9, 600),
          row(face(mood, 26, IN4), txt(date, 12, IN4), gap=8),
          justify='space-between'),
      '<div style="height: 1px; background: %s;"></div>' % CR200,
      row(row(ic('scale', 18, IN4, 1.8),
              col(txt('%s กก.' % w, 16, IN9, 500), txt(delta, 11, IN4), gap=1), gap=8),
          row(ic('pulse', 18, BAD if warn else IN4, 1.8),
              col(row(txt(bp, 16, bpc, 500), ic('alert', 15, BAD, 1.9) if warn else '', gap=4),
                  txt('ค่าสูงกว่าเกณฑ์' if warn else 'ปกติ', 11, BAD if warn else IN4), gap=1), gap=8),
          justify='space-between', extra='flex: 1;'),
      row(*[chip(t, True) for t in tags], gap=6, wrap=True) if tags else '',
      ('<div style="font-size: 14px; color: %s; line-height: 1.55;">%s</div>' % (IN6, note)) if note else '',
      (row(phototile('scan', 92, 72, 8, 'อัลตราซาวด์'),
           phototile('photo', 92, 72, 8),
           ('<div style="width: 44px; height: 72px; border-radius: 8px; background: %s; display: flex; '
            'align-items: center; justify-content: center; font-size: 13px; color: %s; flex: none;">+2</div>'
            ) % (CR100, IN6), gap=6) if photos else ''),
      row(txt('บันทึกโดย %s' % by, 12, IN4), justify='flex-end'),
      gap=12)

write('Health.dc.html', screen(
  topbar('บันทึกสุขภาพ', right=ic('sliders', 22, IN6)),
  ('<div style="flex: none; padding: 12px 16px; display: flex; gap: 8px; background: %s; '
   'border-bottom: 1px solid %s;">%s</div>') % (CR50, CR200,
   chip('ทั้งหมด', True) + chip('เดือนนี้') + chip('ไตรมาสนี้')),
  body(
    section_head('สิงหาคม 2569'),
    log_card('24', '12 ส.ค.', '62.5', '+0.4 จากครั้งที่แล้ว', '118/76', 'good',
             ['คลื่นไส้', 'ปวดหลัง'], 'วันนี้รู้สึกดีขึ้นมาก กินข้าวได้เยอะขึ้น ลูกดิ้นบ่อยตอนกลางคืน', 'ญาญ่า', photos=4),
    log_card('23', '5 ส.ค.', '62.1', '+0.6 จากครั้งที่แล้ว', '142/91', 'tired',
             ['บวม', 'เหนื่อยง่าย'], 'ขาบวมมากขึ้นตอนเย็น จะถามคุณหมอในนัดหน้า', 'พี่นก', warn=True),
    pad=16, gap=12),
  fab(),
  bottomnav(1),
), h=980)

# ---------- Health empty ----------
write('HealthEmpty.dc.html', screen(
  topbar('บันทึกสุขภาพ', right=ic('sliders', 22, IN6)),
  '<div style="flex: 1; padding: 32px 32px 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;">',
  ('<div style="width: 96px; height: 96px; border-radius: 9999px; background: %s; display: flex; '
   'align-items: center; justify-content: center;">%s</div>') % (CR100, ic('pulse', 44, BR3, 1.6)),
  col(txt('ยังไม่มีบันทึกสุขภาพ', 20, IN9, 600),
      ('<div style="font-size: 14px; color: %s; line-height: 1.65; text-align: center;">'
       'บันทึกน้ำหนัก ความดัน และอาการในแต่ละสัปดาห์<br>เพื่อดูแนวโน้มและแชร์กับคุณหมอ</div>') % IN6,
      gap=8, extra='align-items: center;'),
  '<div style="width: 100%; max-width: 260px;">' + btn('บันทึกครั้งแรก', 'primary', ic('plus', 18, WHITE, 2)) + '</div>',
  '</div>',
  bottomnav(1),
))

# ---------- Health form ----------
def moodpick(sel='good'):
    out = []
    for k, lb in (('great','ดีมาก'),('good','ดี'),('okay','เฉยๆ'),('tired','เหนื่อย'),('bad','แย่')):
        on = k == sel
        out.append('<div style="flex: 1; height: 72px; border-radius: 8px; border: %s solid %s; '
                   'background: %s; display: flex; flex-direction: column; align-items: center; '
                   'justify-content: center; gap: 5px; box-sizing: border-box;">%s'
                   '<span style="font-size: 11px; color: %s; font-weight: %s;">%s</span></div>'
                   % ('1.5px' if on else '1px', BR5 if on else CR200, BR1 if on else CR50,
                      face(k, 26, BR7 if on else IN6), BR9 if on else IN6, '500' if on else '400', lb))
    return row(*out, gap=6)

def bpfield():
    def box(v):
        return ('<div style="flex: 1; height: 44px; background: %s; border: 1px solid %s; border-radius: 8px; '
                'display: flex; align-items: center; justify-content: center; font-size: 16px; color: %s;">%s</div>'
                ) % (CR50, CR200, IN9, v)
    return col(label('ความดันโลหิต'),
               row(box('118'), txt('/', 20, IN4), box('76'),
                   txt('mmHg', 14, IN6), gap=10),
               row(txt('ตัวบน', 12, IN4, extra='flex: 1; text-align: center;'),
                   '<span style="width: 10px;"></span>',
                   txt('ตัวล่าง', 12, IN4, extra='flex: 1; text-align: center;'),
                   '<span style="width: 46px;"></span>', gap=10),
               gap=6)

write('HealthForm.dc.html', screen(
  topbar('บันทึกสุขภาพ', left=ic('x', 22, IN6)),
  body(
    field('วันที่บันทึก', value='12 สิงหาคม 2569', icon_right=ic('calendar', 18, IN4)),
    field('สัปดาห์ที่', value='24', hint='คำนวณจากวันที่ตั้งครรภ์ แก้ไขได้'),
    field('น้ำหนัก', value='62.5', suffix='กก.', hint='+0.4 จากครั้งที่แล้ว'),
    bpfield(),
    col(label('อาการ'),
        row(chip('คลื่นไส้', True), chip('อาเจียน'), chip('ปวดหลัง', True), chip('บวม'),
            chip('เหนื่อยง่าย'), chip('นอนไม่หลับ'), chip('ท้องผูก'), chip('เวียนหัว'),
            chip('+ เพิ่มเอง'), gap=6, wrap=True), gap=8),
    col(label('อารมณ์วันนี้'), moodpick('good'), gap=8),
    col(row(label('รูปภาพ'), txt('2/10', 12, IN4), justify='space-between'),
        row(phototile('scan', 104, 104, 10, 'อัลตราซาวด์'),
            phototile('photo', 104, 104, 10, 'ครอบครัว'),
            addphoto(104, 104), gap=8),
        txt('ภาพอัลตราซาวด์ หรือความทรงจำของสัปดาห์นี้ — จะไปรวมอยู่ในอัลบั้มให้อัตโนมัติ', 12, IN4,
            extra='line-height: 1.55;'),
        gap=8),
    textarea('บันทึกเพิ่มเติม', 'อาการ ความรู้สึก หรือสิ่งที่อยากบอกคุณหมอ', 3),
    pad=16, gap=20),
  ('<div style="flex: none; padding: 12px 16px 20px; background: %s; border-top: 1px solid %s;">%s</div>'
   ) % (WHITE, CR200, btn('บันทึก', 'primary')),
), h=1300)

# ---------- Appointments ----------
def datebox(mon, day, past=False):
    bg = CR200 if past else BR1
    mc = IN4 if past else BR7
    dc = IN4 if past else BR9
    return ('<div style="width: 52px; height: 58px; border-radius: 8px; background: %s; display: flex; '
            'flex-direction: column; align-items: center; justify-content: center; gap: 1px; flex: none;">'
            '<span style="font-size: 11px; color: %s;">%s</span>'
            '<span style="font-size: 22px; font-weight: 600; color: %s; line-height: 1;">%s</span></div>'
            ) % (bg, mc, mon, dc, day)

def appt_card(mon, day, time, title, doctor, place, remind, bdg, bkind, past=False):
    op = 'opacity: 0.6;' if past else ''
    return card(
      row(datebox(mon, day, past),
          col(row(txt(time, 16, IN9, 600), txt('·', 14, IN4), txt(title, 16, IN9, 500), gap=6, wrap=True),
              row(ic('user', 14, IN4, 1.9), txt(doctor, 13, IN6),
                  ic('pin', 14, IN4, 1.9), txt(place, 13, IN6), gap=5, wrap=True),
              row(ic('bell', 13, IN4, 1.9), txt(remind, 12, IN4), gap=5),
              gap=6, extra='flex: 1; min-width: 0;'),
          badge(bdg, bkind),
          gap=12, align='flex-start'),
      extra=op)

write('Appointments.dc.html', screen(
  topbar('นัดหมายแพทย์'),
  ('<div style="flex: none; padding: 12px 16px; background: %s; border-bottom: 1px solid %s;">%s</div>'
   ) % (CR50, CR200, toggle2('กำลังจะถึง', 'ผ่านมาแล้ว', 0)),
  ('<div style="flex: none; margin: 12px 16px 0; background: %s; border: 1px solid %s; border-radius: 12px; '
   'padding: 12px 14px; display: flex; align-items: center; gap: 10px;">%s'
   '<span style="flex: 1; font-size: 13px; color: %s; line-height: 1.5;">เปิดการแจ้งเตือนเพื่อไม่พลาดนัดหมาย</span>'
   '<span style="font-size: 13px; font-weight: 500; color: %s;">เปิด</span>%s</div>'
   ) % (CR100, CR200, ic('bell', 20, WARN, 1.9), IN6, BR7, ic('x', 16, IN4, 2)),
  body(
    section_head('สัปดาห์นี้'),
    appt_card('ส.ค.', '28', '14:30', 'ตรวจครรภ์ตามนัด', 'นพ.สมชาย', 'รพ.รามาธิบดี',
              'เตือนก่อน 1 ชั่วโมง', 'อีก 3 วัน', 'warn'),
    section_head('เดือนหน้า'),
    appt_card('ก.ย.', '11', '09:00', 'อัลตราซาวด์', 'พญ.มาลี', 'รพ.รามาธิบดี',
              'เตือนก่อน 1 วัน', '2 สัปดาห์', 'soft'),
    appt_card('ก.ย.', '25', '10:30', 'ตรวจเลือด', 'นพ.สมชาย', 'รพ.รามาธิบดี',
              'เตือนก่อน 1 ชั่วโมง', '1 เดือน', 'soft'),
    pad=16, gap=12),
  fab(),
  bottomnav(2),
), h=940)

write('AppointmentForm.dc.html', screen(
  topbar('เพิ่มนัดหมาย', left=ic('x', 22, IN6)),
  body(
    row(('<div style="flex: 1;">%s</div>' % field('วันที่', value='28 ส.ค. 2569', icon_right=ic('calendar', 18, IN4))),
        ('<div style="flex: 1;">%s</div>' % field('เวลา', value='14:30', icon_right=ic('clock', 18, IN4))),
        gap=12, align='flex-start'),
    col(field('หัวข้อนัด', value='ตรวจครรภ์ตามนัด'),
        row(chip('ตรวจครรภ์ตามนัด', True), chip('อัลตราซาวด์'), chip('ตรวจเลือด'), chip('ฉีดวัคซีน'),
            gap=6, wrap=True), gap=8),
    # เลือกกลุ่มตั้งแต่ตอนสร้างนัด ยอดค่าใช้จ่ายจึงแยกเรื่องได้โดยไม่ต้องมากรอกซ้ำทีหลัง
    col(label('กลุ่มการรักษา'),
        row(('<span style="background: %s; color: %s; border: 1px solid %s; border-radius: 9999px; '
             'padding: 7px 14px; font-size: 14px; display: inline-flex; align-items: center; gap: 6px;">%s%s</span>'
             ) % (BR1, BR9, BR1, group_dot('preg', 8), 'ฝากครรภ์'),
            ('<span style="background: %s; color: %s; border: 1px solid %s; border-radius: 9999px; '
             'padding: 7px 14px; font-size: 14px; display: inline-flex; align-items: center; gap: 6px;">%s%s</span>'
             ) % (WHITE, IN6, CR200, group_dot('dent', 8), 'ทันตกรรม'),
            ('<span style="background: %s; color: %s; border: 1px dashed %s; border-radius: 9999px; '
             'padding: 7px 14px; font-size: 14px; display: inline-flex; align-items: center; gap: 6px;">%s%s</span>'
             ) % (WHITE, BR7, BR3, ic('plus', 14, BR7, 2), 'กลุ่มใหม่'),
            gap=6, wrap=True),
        txt('ใช้แยกยอดค่าใช้จ่ายตามเรื่องที่รักษา ไม่เลือกก็ได้ จะไปอยู่กลุ่ม ทั่วไป', 12, IN4),
        gap=8),
    field('แพทย์', placeholder='นพ./พญ. ...'),
    field('สถานที่', value='รพ.รามาธิบดี', icon_right=ic('pin', 18, IN4)),
    card(
      row(col(txt('การแจ้งเตือน', 16, IN9, 500), txt('เตือนก่อนถึงเวลานัด', 13, IN6), gap=3, extra='flex: 1;'),
          ('<div style="width: 48px; height: 28px; border-radius: 9999px; background: %s; padding: 3px; '
           'display: flex; justify-content: flex-end; align-items: center; flex: none;">'
           '<div style="width: 22px; height: 22px; border-radius: 9999px; background: %s;"></div></div>'
           ) % (BR7, WHITE),
          justify='space-between', gap=12),
      '<div style="height: 1px; background: %s;"></div>' % CR200,
      col(label('เตือนล่วงหน้า'),
          row(chip('30 นาที'), chip('1 ชม.', True), chip('3 ชม.'), chip('1 วัน'), chip('2 วัน'),
              gap=6, wrap=True), gap=8),
      gap=14),
    textarea('บันทึก', 'สิ่งที่ต้องเตรียม หรือคำถามที่อยากถามคุณหมอ', 3),
    pad=16, gap=20),
  ('<div style="flex: none; padding: 12px 16px 20px; background: %s; border-top: 1px solid %s;">%s</div>'
   ) % (WHITE, CR200, btn('บันทึกนัดหมาย', 'primary')),
), h=1020)

# ---------- Family ----------
def member(initial, name, email, role, rkind, me=False, menu=True):
    return row(
      avatar(initial, 40, BR3 if rkind=='owner' else CR200, WHITE if rkind=='owner' else IN6, 16),
      col(row(txt(name, 16, IN9, 500), txt('(คุณ)', 13, IN4) if me else '', gap=5),
          txt(email, 12, IN4), gap=3, extra='flex: 1; min-width: 0;'),
      badge(role, rkind),
      (ic('dots', 20, IN4, 1.9) if menu else '<div style="width: 20px;"></div>'),
      gap=10)

write('Family.dc.html', screen(
  topbar('ครอบครัว', left=ic('chevL', 22, IN6)),
  body(
    card(row(col(txt('ครอบครัวใจดี', 24, IN9, 600), txt('สมาชิก 3 คน', 14, IN6), gap=4, extra='flex: 1;'),
             ic('edit', 20, IN6, 1.9), justify='space-between'),
         radius=16, pad=20),
    section_head('สมาชิก'),
    card(member('ญ', 'ญาญ่า ใจดี', 'yaya@example.com', 'เจ้าของ', 'owner', me=True, menu=False),
         '<div style="height: 1px; background: %s;"></div>' % CR200,
         member('น', 'พี่นก ใจดี', 'nok@example.com', 'แก้ไขได้', 'editor'),
         '<div style="height: 1px; background: %s;"></div>' % CR200,
         member('ม', 'คุณแม่มาลี', 'malee@example.com', 'ดูอย่างเดียว', 'viewer'),
         gap=14),
    section_head('คำเชิญที่รอตอบรับ'),
    card(row(col(txt('somchai@example.com', 15, IN9, 500),
                 row(badge('แก้ไขได้', 'editor'), txt('หมดอายุใน 5 วัน', 12, IN4), gap=8),
                 gap=5, extra='flex: 1; min-width: 0;'),
             col(row(ic('copy', 16, BR7, 1.9), txt('คัดลอก', 13, BR7, 500), gap=5),
                 txt('ยกเลิก', 13, IN4), gap=8, extra='align-items: flex-end;'),
             justify='space-between', gap=12, align='flex-start')),
    btn('เชิญสมาชิก', 'primary', ic('plus', 18, WHITE, 2)),
    '<div style="height: 1px; background: %s; margin: 4px 0;"></div>' % CR200,
    row(ic('trash', 18, BAD, 1.9), txt('ลบครอบครัวนี้', 15, BAD, 500), gap=8, justify='center'),
    pad=16, gap=12),
  bottomnav(4),
), h=940)

# ---------- Family invite sheet ----------
write('FamilyInvite.dc.html', screen(
  '<div style="flex: 1; background: rgba(43,36,32,0.32);"></div>',
  ('<div style="flex: none; background: %s; border-radius: 16px 16px 0 0; padding: 8px 20px 28px; '
   'display: flex; flex-direction: column; gap: 20px; box-shadow: 0 -8px 24px rgba(43,36,32,0.12);">'
   '<div style="width: 40px; height: 4px; border-radius: 9999px; background: %s; align-self: center; '
   'margin-bottom: 6px;"></div>') % (WHITE, CR200),
  col(txt('ส่งคำเชิญแล้ว', 20, IN9, 600),
      txt('คัดลอกลิงก์แล้วส่งให้สมาชิกทาง LINE หรือแชทได้เลย', 14, IN6, extra='line-height: 1.6;'), gap=6),
  card(row(avatar('s', 36, CR200, IN6, 15),
           col(txt('somchai@example.com', 15, IN9, 500), badge('แก้ไขได้ · editor', 'editor'),
               gap=6, extra='flex: 1; min-width: 0; align-items: flex-start;'),
           gap=10), bg=CR100, border=CR200),
  col(label('ลิงก์คำเชิญ'),
      row(('<div style="flex: 1; min-width: 0; height: 44px; background: %s; border: 1px solid %s; '
           'border-radius: 8px; padding: 0 12px; display: flex; align-items: center; font-size: 14px; '
           'color: %s; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; box-sizing: border-box;">'
           'https://baanteung.app/invite/a7f3c9…</div>') % (CR100, CR200, IN6),
          ('<div style="height: 44px; padding: 0 16px; border-radius: 8px; background: %s; display: flex; '
           'align-items: center; gap: 6px; flex: none;">%s'
           '<span style="font-size: 14px; font-weight: 500; color: %s;">คัดลอก</span></div>'
           ) % (BR7, ic('copy', 16, WHITE, 1.9), WHITE),
          gap=8),
      txt('ลิงก์นี้ใช้ได้ 7 วัน และใช้ได้ครั้งเดียว', 12, IN4), gap=8),
  btn('เชิญคนอื่นอีก', 'ghost'),
  '</div>',
), h=700)

# ---------- Profile ----------
def listrow(icon_name, title, value=None, chevron=True, danger=False):
    c = BAD if danger else IN6
    return row(ic(icon_name, 20, c, 1.9),
               txt(title, 16, BAD if danger else IN9, 500 if danger else 400, extra='flex: 1;'),
               txt(value, 14, IN4) if value else '',
               ic('chev', 16, IN4, 2) if chevron else '',
               gap=12)

def avatar_photo(size=72, cam=True):
    """avatar + ปุ่มกล้อง — placeholder รูปโปรไฟล์"""
    camb = ''
    if cam:
        camb = ('<div style="position: absolute; right: -2px; bottom: -2px; width: 28px; height: 28px; '
                'border-radius: 9999px; background: %s; border: 2px solid %s; display: flex; '
                'align-items: center; justify-content: center;">%s</div>'
                ) % (BR7, WHITE, ic('camera', 14, WHITE, 1.9))
    return ('<div style="position: relative; width: %dpx; height: %dpx; flex: none;">'
            '<div style="width: %dpx; height: %dpx; border-radius: 9999px; background: %s; '
            'border: 1px solid %s; display: flex; align-items: center; justify-content: center;">%s</div>%s</div>'
            ) % (size, size, size, size, CR100, CR200, ic('user', int(size*0.5), BR3, 1.6), camb)

write('Profile.dc.html', screen(
  topbar('โปรไฟล์'),
  body(
    card(row(avatar_photo(64),
             col(txt('ญาญ่า ใจดี', 18, IN9, 600), txt('yaya@example.com', 13, IN6),
                 badge('เจ้าของ', 'owner'), gap=6, extra='flex: 1; min-width: 0; align-items: flex-start;'),
             gap=14),
         btn('แก้ไขโปรไฟล์', 'secondary'), radius=16, pad=20, gap=16),
    section_head('ครอบครัว'),
    card(row(('<div style="width: 40px; height: 40px; border-radius: 10px; background: %s; display: flex; '
              'align-items: center; justify-content: center; flex: none;">%s</div>') % (BR1, ic('users', 21, BR7, 1.8)),
             col(txt('ครอบครัวใจดี', 16, IN9, 500), txt('สมาชิก 3 คน · คุณเป็นเจ้าของ', 13, IN6),
                 gap=3, extra='flex: 1; min-width: 0;'),
             ic('chev', 16, IN4, 2), gap=12)),
    section_head('Pre Care · การตั้งครรภ์'),
    card(listrow('baby', 'วันตั้งครรภ์และวันคาดคลอด', '24 สัปดาห์'),
         '<div style="height: 1px; background: %s;"></div>' % CR200,
         row(txt('วันประจำเดือนครั้งสุดท้าย', 14, IN6), txt('10 มี.ค. 2569', 14, IN9, 500), justify='space-between'),
         row(txt('วันคาดคลอด', 14, IN6), txt('15 ธ.ค. 2569', 14, IN9, 500), justify='space-between'),
         gap=14),
    section_head('การแจ้งเตือน'),
    card(row(col(txt('แจ้งเตือนนัดหมาย', 16, IN9), txt('เตือนผ่านเบราว์เซอร์', 13, IN6), gap=3, extra='flex: 1;'),
             ('<div style="width: 48px; height: 28px; border-radius: 9999px; background: %s; padding: 3px; '
              'display: flex; justify-content: flex-end; align-items: center; flex: none;">'
              '<div style="width: 22px; height: 22px; border-radius: 9999px; background: %s;"></div></div>'
              ) % (BR7, WHITE), justify='space-between', gap=12),
         ('<div style="background: %s; border-radius: 8px; padding: 10px 12px; font-size: 12px; '
          'color: %s; line-height: 1.55;">แจ้งเตือนทำงานเฉพาะตอนเปิดแอปค้างไว้ ถ้าปิดแท็บจะไม่เตือน</div>'
          ) % (CR100, IN6)),
    section_head('บัญชีและอื่นๆ'),
    card(listrow('lock', 'เปลี่ยนรหัสผ่าน'),
         '<div style="height: 1px; background: %s;"></div>' % CR200,
         listrow('mail', 'บัญชีที่เชื่อมต่อ', 'Google'),
         '<div style="height: 1px; background: %s;"></div>' % CR200,
         listrow('globe', 'ภาษา', 'ไทย'),
         '<div style="height: 1px; background: %s;"></div>' % CR200,
         listrow('shield', 'นโยบายความเป็นส่วนตัว'),
         gap=14),
    card(listrow('logout', 'ออกจากระบบ', chevron=False, danger=True)),
    pad=16, gap=12),
  bottomnav(4),
), h=1320)

# ---------- Profile edit (อัปโหลดรูป) ----------
write('ProfileEdit.dc.html', screen(
  topbar('แก้ไขโปรไฟล์', left=ic('x', 22, IN6)),
  body(
    col(avatar_photo(104),
        txt('แตะเพื่อเปลี่ยนรูปโปรไฟล์', 13, IN6),
        row(txt('เลือกรูป', 14, BR7, 500), txt('·', 14, IN4), txt('ถ่ายรูป', 14, BR7, 500),
            txt('·', 14, IN4), txt('ลบรูป', 14, IN4), gap=8),
        gap=12, extra='align-items: center; padding: 12px 0 4px;'),
    field('ชื่อ-นามสกุล', value='ญาญ่า ใจดี', state='focus'),
    col(field('อีเมล', value='yaya@example.com'),
        row(ic('lock', 13, IN4, 1.9), txt('อีเมลคือชื่อผู้ใช้ เปลี่ยนไม่ได้', 12, IN4), gap=5), gap=6),
    pad=16, gap=20),
  ('<div style="flex: none; padding: 12px 16px 20px; background: %s; border-top: 1px solid %s;">%s</div>'
   ) % (WHITE, CR200, btn('บันทึก', 'primary')),
), h=680)

# ---------- Album (Phase 2) ----------
def album_row(*tiles):
    return row(*tiles, gap=8)

def quota_bar(pct=62, used='3.1 GB', limit='5 GB', warn=False):
    fill = WARN if warn else BR5
    return col(
      row(txt('พื้นที่เก็บรูป', 12, IN6),
          txt('%s / %s' % (used, limit), 12, IN9 if not warn else WARN, 500), justify='space-between'),
      ('<div style="height: 6px; width: 100%%; background: %s; border-radius: 9999px; overflow: hidden;">'
       '<div style="height: 100%%; width: %d%%; background: %s; border-radius: 9999px;"></div></div>'
       ) % (CR200, pct, fill),
      gap=5)

def sort_pill(text):
    return ('<span style="display: inline-flex; align-items: center; gap: 4px; background: %s; '
            'border: 1px solid %s; border-radius: 9999px; padding: 5px 10px; font-size: 12px; color: %s;">'
            '%s%s</span>') % (WHITE, CR200, IN6, ic('clock', 13, IN4, 1.9), text)

# ---------- Album: กริดรูป ----------
write('Album.dc.html', screen(
  topbar('อัลบั้ม', right=ic('camera', 22, IN6)),
  ('<div style="flex: none; padding: 12px 16px; display: flex; gap: 8px; background: %s; '
   'border-bottom: 1px solid %s; overflow: hidden;">%s</div>') % (CR50, CR200,
   chip('ทั้งหมด', True) + chip('อัลตราซาวด์') + chip('ครอบครัว') + chip('อื่นๆ')),
  body(
    card(quota_bar(62, '3.1 GB', '5 GB'), pad=14),
    row(sort_pill('เรียงจากใหม่ไปเก่า'),
        txt('28 รูป', 12, IN4), justify='space-between'),

    section_head('สัปดาห์ที่ 24 · 12 ส.ค. 2569'),
    album_row(phototile('scan', '100%', 108, 10, 'อัลตราซาวด์'),
              phototile('photo', '100%', 108, 10, 'ครอบครัว'),
              phototile('photo', '100%', 108, 10)),

    section_head('สัปดาห์ที่ 23 · 5 ส.ค. 2569'),
    album_row(phototile('scan', '100%', 108, 10, 'อัลตราซาวด์'),
              phototile('photo', '100%', 108, 10),
              phototile('photo', '100%', 108, 10)),

    section_head('สัปดาห์ที่ 20 · 15 ก.ค. 2569'),
    album_row(phototile('scan', '100%', 108, 10, 'อัลตราซาวด์'),
              phototile('scan', '100%', 108, 10),
              phototile('photo', '100%', 108, 10)),
    pad=16, gap=12),
  fab(),
  bottomnav(3),
), h=1020)

# ---------- Album: เพิ่มรูป (bottom sheet) ----------
def thumb_pick(kind, badge=None, removable=True):
    x = ('<div style="position: absolute; right: 4px; top: 4px; width: 20px; height: 20px; '
         'border-radius: 9999px; background: rgba(43,36,32,0.7); display: flex; align-items: center; '
         'justify-content: center;">%s</div>') % ic('x', 12, '#FFFFFF', 2.4) if removable else ''
    return ('<div style="position: relative; width: 96px; flex: none;">%s%s</div>'
            ) % (phototile(kind, 96, 96, 10, badge), x)

write('AlbumUpload.dc.html', screen(
  '<div style="flex: 1; background: rgba(43,36,32,0.32);"></div>',
  ('<div style="flex: none; background: %s; border-radius: 16px 16px 0 0; padding: 8px 20px 24px; '
   'display: flex; flex-direction: column; gap: 18px; box-shadow: 0 -8px 24px rgba(43,36,32,0.12); '
   'max-height: 88%%; overflow: hidden;">'
   '<div style="width: 40px; height: 4px; border-radius: 9999px; background: %s; align-self: center;"></div>'
   ) % (WHITE, CR200),

  row(txt('เพิ่มรูปเข้าอัลบั้ม', 20, IN9, 600), txt('เลือกได้หลายรูป', 12, IN4), justify='space-between'),

  col(row(label('รูปที่เลือก'), txt('3 รูป · รวม 180 KB', 12, IN4), justify='space-between'),
      row(thumb_pick('scan', 'อัลตราซาวด์'), thumb_pick('photo'), thumb_pick('photo'),
          addphoto(96, 96, 'เพิ่ม'), gap=8),
      txt('ระบบย่อรูปให้อัตโนมัติก่อนอัปโหลด เพื่อประหยัดพื้นที่', 11, IN4),
      gap=8),

  col(label('ประเภท'),
      row(chip('อัลตราซาวด์', True), chip('ครอบครัว'), chip('อื่นๆ'), gap=6),
      gap=8),

  row(('<div style="flex: 1;">%s</div>' % field('วันที่ถ่าย', value='12 ส.ค. 2569',
        icon_right=ic('calendar', 18, IN4), hint='ไม่ใช่วันที่อัปโหลด')),
      ('<div style="width: 118px;">%s</div>' % field('สัปดาห์ที่', value='24', hint='คำนวณให้')),
      gap=12, align='flex-start'),

  textarea('คำบรรยาย', 'เช่น คุณหมอบอกว่าลูกโตตามเกณฑ์ หนัก 700 กรัมแล้ว', 2),

  row(('<div style="width: 44px; height: 26px; border-radius: 9999px; background: %s; padding: 3px; '
       'display: flex; justify-content: flex-start; align-items: center; flex: none;">'
       '<div style="width: 20px; height: 20px; border-radius: 9999px; background: %s;"></div></div>'
       ) % (CR200, WHITE),
      col(txt('ปักหมุดเป็นรูปเด่นของสัปดาห์', 15, IN9),
          txt('ใช้เป็นรูปหน้าปกของสัปดาห์นี้ในอัลบั้ม', 12, IN6), gap=2, extra='flex: 1;'),
      gap=12),

  row(ic('user', 14, IN4, 1.9), txt('เพิ่มโดย ญาญ่า ใจดี · บันทึกอัตโนมัติ', 12, IN4), gap=6),

  btn('เพิ่ม 3 รูปเข้าอัลบั้ม', 'primary'),
  '</div>',
), h=940)

# ---------- Photo detail ----------
def share_btn(icon_html, label_txt):
    return ('<div style="flex: 1; height: 64px; border-radius: 10px; background: %s; border: 1px solid %s; '
            'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; '
            'opacity: 0.55;">%s<span style="font-size: 11px; color: %s;">%s</span></div>'
            ) % (WHITE, CR200, icon_html, IN6, label_txt)

write('PhotoDetail.dc.html', ('<div style="width: 390px; min-height: 844px; background: #2B2420; '
  'display: flex; flex-direction: column; position: relative; color: #FFFFFF;">'
  + ('<div style="height: 56px; flex: none; padding: 0 16px; display: flex; align-items: center; '
     'justify-content: space-between;">%s<span style="font-size: 13px; opacity: .7;">3 จาก 28</span>%s</div>'
     ) % (ic('x', 22, '#FFFFFF', 2), ic('dots', 22, '#FFFFFF', 2))
  + ('<div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 8px 16px;">'
     '<div style="width: 100%; aspect-ratio: 3 / 4; border-radius: 12px; background: #41372F; '
     'display: flex; align-items: center; justify-content: center;">' + ic('image', 56, '#8A7663', 1.4) + '</div></div>')
  + ('<div style="flex: none; background: %s; border-radius: 16px 16px 0 0; padding: 20px; color: %s; '
     'display: flex; flex-direction: column; gap: 14px;">' % (CR50, IN9))
  + row(col(row(txt('สัปดาห์ที่ 24', 18, IN9, 600), badge('อัลตราซาวด์', 'owner'), gap=8),
            row(ic('calendar', 13, IN4, 1.9), txt('ถ่ายเมื่อ 12 สิงหาคม 2569', 12, IN4), gap=5),
            gap=6, extra='flex: 1; min-width: 0;'),
        justify='space-between')
  + ('<div style="font-size: 14px; color: %s; line-height: 1.6;">คุณหมอบอกว่าลูกโตตามเกณฑ์ '
     'หนักประมาณ 700 กรัมแล้ว เห็นหน้าชัดมาก</div>') % IN6
  + '<div style="height: 1px; background: %s;"></div>' % CR200
  + col(row(ic('user', 14, IN4, 1.9), txt('เพิ่มโดย ญาญ่า ใจดี', 12, IN6), gap=6),
        row(ic('image', 14, IN4, 1.9), txt('เพิ่มเมื่อ 12 ส.ค. 2569 · 84 KB', 12, IN6), gap=6),
        gap=6)
  + '<div style="height: 1px; background: %s;"></div>' % CR200
  + col(row(txt('แชร์', 15, IN9, 500), badge('เร็วๆ นี้ · Phase 3', 'viewer'), gap=8),
        row(share_btn(ic('share', 20, IN6, 1.8), 'แชร์ลิงก์'),
            share_btn(ic('users', 20, IN6, 1.8), 'ส่งให้ครอบครัว'),
            share_btn(ic('download', 20, IN6, 1.8), 'บันทึกรูป'), gap=8),
        gap=10)
  + row(ic('trash', 18, BAD, 1.9), txt('ลบรูปนี้', 15, BAD, 500), gap=8, justify='center',
        extra='padding-top: 4px;')
  + '</div></div>'), h=980)

# ---------- Logo: spec sheet ของตัวเลือก C ----------
def wordmark(m, size=15, sub=True, color=None, subcolor=None):
    return row(m, col(txt('Pre Care', size + 3, color or IN9, 600, extra='letter-spacing: -0.01em;'),
                      (txt('บันทึกการตั้งครรภ์', size - 4, subcolor or IN6) if sub else ''),
                      gap=1, extra='align-items: flex-start;'), gap=10)

def _box(title, inner, note=None, flex=True):
    return col(txt(title, 12, IN4),
               card('<div style="display: flex; align-items: center; justify-content: center; gap: 22px; '
                    'flex-wrap: wrap; padding: 6px 0;">' + inner + '</div>', pad=16),
               (txt(note, 11, IN4, extra='line-height: 1.5;') if note else ''),
               gap=7, extra='flex: 1; min-width: 0;' if flex else '')

logo_sheet = ('<div style="width: 900px; background: %s; padding: 40px; box-sizing: border-box; '
  'display: flex; flex-direction: column; gap: 32px; color: %s;">' % (CR50, IN9)
  + row(mark_c(64), col(txt('Pre Care — Logo', 28, IN9, 600),
        txt('ตัวเลือก C · หน่ออ่อน — หัวใจกลมมนมีใบงอกด้านบน สื่อการเติบโตและการดูแล', 14, IN6), gap=4), gap=16)
  + '<div style="height: 1px; background: %s;"></div>' % CR200
  + row(_box('มาร์กหลัก', mark_c(140)),
        _box('Clear space',
             ('<div style="position: relative; padding: 30px; border: 1.5px dashed %s; border-radius: 12px;">%s'
              '<div style="position: absolute; inset: 30px; border: 1px solid %s;"></div></div>'
              ) % (BR3, mark_c(96), PE3),
             'เว้นระยะรอบมาร์กอย่างน้อย ⅓ ของความสูงมาร์ก'),
        gap=20, align='stretch')
  + col(txt('ขนาด — 96 / 48 / 32 / 24 / 20 px', 12, IN4),
        card(row(*[col(mark_c(n), txt(str(n), 10, IN4), gap=6, extra='align-items: center;')
                   for n in (96, 48, 32, 24, 20)], gap=30, justify='center', align='flex-end',
                 extra='padding: 6px 0;'), pad=16),
        txt('ที่ 20px ใบยังอ่านออก จุดสองจุดเริ่มกลืน — ถ้าต้องใช้เล็กกว่านี้ให้ตัดจุดออก เหลือหัวใจ+ใบ', 11, IN4),
        gap=7)
  + row(_box('Lockup แนวนอน', wordmark(mark_c(46))),
        _box('Lockup แนวตั้ง',
             col(mark_c(56), col(txt('Pre Care', 18, IN9, 600), txt('บันทึกการตั้งครรภ์', 12, IN6),
                                 gap=1, extra='align-items: center;'), gap=10, extra='align-items: center;')),
        gap=20, align='stretch')
  + col(txt('พื้นหลัง', 12, IN4),
        row(('<div style="flex: 1; background: %s; border: 1px solid %s; border-radius: 12px; padding: 22px; '
             'display: flex; justify-content: center;">%s</div>') % (WHITE, CR200, wordmark(mark_c(40))),
            ('<div style="flex: 1; background: %s; border-radius: 12px; padding: 22px; '
             'display: flex; justify-content: center;">%s</div>') % (BR7, wordmark(mark_c(40, '#F5BE9B', '#FDEADF', '#B9C9B3'), color='#FFFFFF', subcolor='#E6D8C9')),
            ('<div style="flex: 1; background: %s; border-radius: 12px; padding: 22px; '
             'display: flex; justify-content: center;">%s</div>') % (PE1, wordmark(mark_c(40, PE7, '#FFFFFF', '#7B9475'))),
            gap=14),
        gap=7)
  + row(_box('ขาวดำ / สีเดียว',
             mark_c(72, IN9, '#FFFFFF', IN9) + mark_c(72, '#FFFFFF', BR7, '#FFFFFF'),
             'ใช้ตอนพิมพ์ขาวดำ หรือ watermark — จุดสองจุดกลับสีเพื่อไม่ให้ตัน'),
        _box('Favicon / App icon',
             ''.join([('<div style="width: %dpx; height: %dpx; border-radius: %dpx; background: %s; display: flex; '
                       'align-items: center; justify-content: center;">%s</div>') % (n, n, int(n*0.24), PE1, mark_c(int(n*0.62)))
                      for n in (72, 48, 32)]),
             'พื้น peach-100 มุมมน 24% ของด้าน — ไม่ใช้พื้นโปร่งใสเพราะจะจมกับพื้นหลังเข้ม'),
        gap=20, align='stretch')
  + col(txt('สีใบ — ตัดสินใจแล้ว', 12, IN4),
        row(('<div style="flex: 1; background: %s; border: 1.5px solid %s; border-radius: 12px; padding: 18px; '
             'display: flex; flex-direction: column; align-items: center; gap: 10px;">%s'
             '<div style="text-align: center;"><div style="font-size: 13px; font-weight: 600; color: %s;">'
             '&#10003; ใบเขียว sage — ที่ใช้จริง</div>'
             '<div style="font-size: 11px; color: %s; line-height: 1.5;">ใบเด่นขึ้น สื่อ “การเติบโต” ชัดกว่า<br>'
             'sage #8AA383 อยู่ในพาเลตต์ feature accent อยู่แล้ว</div></div></div>'
             ) % (WHITE, PE5, mark_c(76), OK, IN6),
            ('<div style="flex: 1; background: %s; border: 1px solid %s; border-radius: 12px; padding: 18px; '
             'display: flex; flex-direction: column; align-items: center; gap: 10px;">%s'
             '<div style="text-align: center;"><div style="font-size: 13px; font-weight: 600; color: %s;">ใบส้มเข้ม — ไม่ได้ใช้</div>'
             '<div style="font-size: 11px; color: %s; line-height: 1.5;">เก็บเป็นทางเลือกสำรอง เผื่อต้องวางบนพื้น<br>'
             'ที่สีเขียวตีกัน เช่น งานพิมพ์บางแบบ</div></div></div>'
             ) % (WHITE, CR200, mark_c(76, PE5, PE3, PE7), IN4, IN4),
            gap=14),
        txt('ใบเขียว sage #8AA383 คือค่าที่ใช้จริงในทุกหน้าจอและทุก export — ปิดประเด็นแล้ว', 11, IN4),
        gap=7)
  + col(txt('ข้อห้าม', 12, IN4),
        card(row(*[('<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">'
                    '<div style="opacity: 0.55;">%s</div>'
                    '<span style="font-size: 11px; color: %s; text-align: center; line-height: 1.5;">%s</span></div>'
                    ) % (m, BAD, t)
                   for m, t in ((mark_c(56, '#C94F3D', '#F5BE9B', '#8AA383'), 'อย่าเปลี่ยนสีหัวใจ<br>ออกนอกโทน peach'),
                                ('<div style="transform: rotate(-14deg);">%s</div>' % mark_c(56), 'อย่าเอียง<br>หรือหมุนมาร์ก'),
                                ('<div style="transform: scaleX(1.35);">%s</div>' % mark_c(56), 'อย่ายืด<br>ผิดสัดส่วน'),
                                (mark_c(56, PE5, PE5, PE5), 'อย่าให้จุดกับหัวใจ<br>สีเดียวกันจนตัน'))],
                 gap=16, align='flex-start'), pad=18),
        gap=7)
  + '</div>')
write('Logo.dc.html', logo_sheet, w=900, h=1680)

# ---------- Dashboard v2: การ์ดขนาดลูก + พัฒนาการ (Phase 2) ----------
def size_slot(size=84, filled=True):
    """ช่องรูปเทียบขนาด — ดึงจาก R2 ตาม path คงที่ · ไม่มีไฟล์ = ตกไป fallback"""
    if filled:
        inner = ('<div style="width: %dpx; height: %dpx; border-radius: 8px; border: 1.5px dashed %s; '
                 'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;">%s'
                 '<span style="font-family: ui-monospace, monospace; font-size: 8px; color: %s;">w24.webp</span></div>'
                 ) % (int(size * 0.66), int(size * 0.66), PE5, ic('image', 20, PE7, 1.7), PE7)
    else:
        inner = '<span style="font-size: 26px; font-weight: 600; color: %s; line-height: 1;">24</span>' % PE7
    return ('<div style="width: %dpx; height: %dpx; border-radius: 9999px; background: %s; display: flex; '
            'align-items: center; justify-content: center; flex: none;">%s</div>') % (size, size, PE1, inner)

def size_card():
    return card(
      row(txt('ขนาดของลูกน้อย', 14, IN6), badge('สัปดาห์ที่ 24', 'owner'), justify='space-between'),
      row(size_slot(84, True),
          col(txt('ตัวเท่ากับ', 13, IN6),
              txt('ข้าวโพด 1 ฝัก', 22, IN9, 600),
              row(row(ic('scale', 15, IN4, 1.9), txt('600 กรัม', 14, IN6), gap=5),
                  txt('30.0 ซม.', 14, IN6), gap=14),
              gap=4, extra='flex: 1; min-width: 0;'),
          gap=14),
      ('<div style="font-size: 11px; color: %s; line-height: 1.5;">เป็นค่าเฉลี่ยเพื่ออ้างอิงเท่านั้น '
       'ขนาดของลูกน้อยแต่ละคนต่างกันได้</div>') % IN4,
      gap=12)

def dev_card():
    return card(
      row(row(ic('sparkle', 18, PE7, 1.8), txt('พัฒนาการของหนูน้อย', 15, IN9, 600), gap=7),
          ic('chev', 16, IN4, 2), justify='space-between'),
      ('<div style="font-size: 15px; color: %s; line-height: 1.7;">'
       '<b style="color: %s;">ปอดพัฒนาครบโครงสร้างแล้ว</b> แต่ยังทำงานเองนอกครรภ์ไม่ได้ '
       'สัปดาห์นี้ลูกน้อยเริ่มสะสมไขมันมากขึ้น ผิวจะเรียบขึ้นเรื่อยๆ</div>') % (IN6, IN9),
      row(chip('ปอด'), chip('ไขมันใต้ผิว'), gap=6),
      gap=12)

write('DashboardV2.dc.html', screen(
  dash_topbar(),
  body(hero(), size_card(), dev_card(), next_appt(),
       row(btn('บันทึกสุขภาพ', 'secondary', ic('plus', 18, BR7, 2)),
           btn('เพิ่มนัดหมาย', 'secondary', ic('plus', 18, BR7, 2)), gap=10)),
  bottomnav(0),
), h=1080)

# ---------- Components sheet ----------
def sec(title, note, *parts):
    return col(col(txt(title, 20, IN9, 600), txt(note, 13, IN6), gap=3),
               col(*parts, gap=16), gap=14)

def swatch(name, hexv, dark=False):
    return col(('<div style="width: 100%%; height: 56px; border-radius: 8px; background: %s; '
                'border: 1px solid %s;"></div>') % (hexv, CR200),
               col(txt(name, 12, IN9, 500), txt(hexv, 11, IN4), gap=1), gap=6, extra='flex: 1;')

comp = ('<div style="width: 900px; background: %s; padding: 40px; box-sizing: border-box; '
        'display: flex; flex-direction: column; gap: 40px; color: %s;">' % (CR50, IN9)
  + col(txt('Health Care — Component Library', 28, IN9, 600),
        txt('อ้างอิง design-system.md — โทนครีม/น้ำตาล · touch target 44px · radius มาตรฐาน 12px', 14, IN6),
        gap=6)
  + '<div style="height: 1px; background: %s;"></div>' % CR200
  + sec('Color', 'พื้นหลัง 90% ใช้ cream/white · brown เฉพาะจุดที่ต้องการดึงสายตา',
        row(swatch('brown-900', BR9), swatch('brown-700', BR7), swatch('brown-500', BR5),
            swatch('brown-300', BR3), swatch('brown-100', BR1), gap=12),
        row(swatch('cream-50', CR50), swatch('cream-100', CR100), swatch('cream-200', CR200),
            swatch('cream-300', CR300), swatch('ink-900', IN9), gap=12),
        row(swatch('success', OK), swatch('warning', WARN), swatch('danger', BAD),
            swatch('info', INFO), swatch('ink-600', IN6), gap=12))
  + sec('Peach — สีประจำ Pre Care (ส้มพาสเทล)', 'สีของโลโก้และของฟีเจอร์ตั้งครรภ์ · อยู่ตระกูลอุ่นเดียวกับ brown จึงวางบนพื้นครีมแล้วกลมกลืน',
        row(swatch('peach-700', PE7), swatch('peach-500', PE5), swatch('peach-300', PE3),
            swatch('peach-100', PE1), '<div style="flex: 1;"></div>', gap=12))
  + sec('Feature accent — ฟีเจอร์อื่นในอนาคต', 'ความสว่าง/ความอิ่มสีอยู่ระดับเดียวกับ brown-500 ทั้งหมด จึงอยู่ร่วมกันได้',
        row(swatch('sage-500 · โภชนาการ', SAGE5), swatch('sky-500 · เอกสาร', SKY5),
            swatch('plum-500 · อัลบั้ม', PLUM5), swatch('clay-500 · สำรอง', CLAY5),
            '<div style="flex: 1;"></div>', gap=12),
        row(swatch('sage-100', SAGE1), swatch('sky-100', SKY1),
            swatch('plum-100', PLUM1), swatch('clay-100', CLAY1),
            '<div style="flex: 1;"></div>', gap=12),
        ('<div style="background: %s; border: 1px solid %s; border-radius: 12px; padding: 14px 16px; '
         'font-size: 13px; color: %s; line-height: 1.7;">brown ยังเป็นสีหลักของทั้งแอป — accent ชุดนี้ใช้'
         '<b>ระบุฟีเจอร์</b>เท่านั้น (จุดสีข้างชื่อโมดูล, ไอคอนหมวด, ตัวเลขสรุป) ห้ามใช้เป็นสีปุ่มหลัก '
         'ไม่งั้นจะเสียหลักการ “พื้นหลัง 90%% เป็น cream/white”</div>') % (WHITE, CR200, IN6))
  + sec('Typography', 'Noto Sans Thai · น้ำหนัก 400 / 500 / 600 เท่านั้น (700 เฉพาะตัวเลข countdown)',
        col('<div style="font-size: 32px; line-height: 40px; font-weight: 600;">Display 32 — สัปดาห์ที่ 24</div>',
            '<div style="font-size: 24px; line-height: 32px; font-weight: 600;">H1 24 — บันทึกสุขภาพ</div>',
            '<div style="font-size: 20px; line-height: 28px; font-weight: 600;">H2 20 — นัดหมายถัดไป</div>',
            '<div style="font-size: 16px; line-height: 24px;">Body 16 — วันนี้รู้สึกดีขึ้นมาก กินข้าวได้เยอะขึ้น</div>',
            '<div style="font-size: 14px; line-height: 20px; color: %s;">Body Small 14 — คำอธิบายรอง label ฟอร์ม</div>' % IN6,
            '<div style="font-size: 12px; line-height: 16px; color: %s;">Caption 12 — timestamp, hint text</div>' % IN4,
            gap=10))
  + sec('Button', 'สูง 44px · padding แนวนอน 20px · radius 12px',
        row(('<div style="width: 170px;">%s</div>' % btn('ปุ่มหลัก', 'primary')),
            ('<div style="width: 170px;">%s</div>' % btn('ปุ่มรอง', 'secondary')),
            ('<div style="width: 170px;">%s</div>' % btn('Ghost', 'ghost')),
            ('<div style="width: 170px;">%s</div>' % btn('ลบ', 'danger')),
            ('<div style="width: 170px;">%s</div>' % btn('ปิดใช้งาน', 'disabled')),
            gap=12, wrap=True))
  + sec('Form field', 'สูง 44px · bg cream-50 · focus เปลี่ยนเป็นเส้น 1.5px brown-500',
        row(('<div style="flex: 1;">%s</div>' % field('ปกติ', placeholder='กรอกข้อมูล')),
            ('<div style="flex: 1;">%s</div>' % field('มีข้อมูล', value='62.5', suffix='กก.')),
            ('<div style="flex: 1;">%s</div>' % field('โฟกัส', value='118', state='focus')),
            ('<div style="flex: 1;">%s</div>' % field('ผิดพลาด', value='yaya@', state='error', hint='รูปแบบอีเมลไม่ถูกต้อง')),
            gap=12, align='flex-start'))
  + sec('Badge & Chip', 'Role badge 3 ระดับ · Status badge บอกเวลาที่เหลือ 4 ระดับ',
        row(badge('เจ้าของ · owner', 'owner'), badge('แก้ไขได้ · editor', 'editor'),
            badge('ดูอย่างเดียว · viewer', 'viewer'), gap=10, wrap=True),
        row(badge('วันนี้', 'now'), badge('อีก 3 วัน', 'warn'), badge('2 สัปดาห์', 'soft'),
            badge('ผ่านมาแล้ว', 'past'), gap=10, wrap=True),
        row(chip('คลื่นไส้', True), chip('ปวดหลัง', True), chip('บวม'), chip('เหนื่อยง่าย'),
            chip('+ เพิ่มเอง'), gap=8, wrap=True))
  + sec('Mood picker', 'เลือกได้ 1 · ไอคอนเส้น ไม่ใช้ emoji', '<div style="max-width: 420px;">%s</div>' % moodpick('good'))
  + sec('Progress — อายุครรภ์ 1–40 สัปดาห์', 'track cream-200 · fill brown-500 · radius-full',
        col(row('<span style="font-size: 32px; font-weight: 600; color: %s; line-height: 1;">24</span>' % BR7,
                txt('สัปดาห์ 3 วัน', 14, IN6), gap=10, align='baseline'),
            '<div style="max-width: 420px;">%s</div>' % progress(60), gap=10))
  + sec('Bottom Navigation', 'active = pill brown-100 + icon/label brown-700',
        '<div style="max-width: 390px; border: 1px solid %s; border-radius: 12px; overflow: hidden;">%s</div>'
        % (CR200, bottomnav(0).replace('margin-top: auto; ', '')))
  + sec('Logo', 'Pre Care — ตัวเลือก C ที่เลือกใช้ · สเปกเต็มอยู่หน้า “โลโก้ Pre Care”',
        row(('<div style="flex: 1; background: %s; border: 1px solid %s; border-radius: 12px; padding: 20px; '
             'display: flex; justify-content: center;">%s</div>') % (WHITE, CR200, wordmark(mark_c(46))),
            ('<div style="flex: 1; background: %s; border-radius: 12px; padding: 20px; '
             'display: flex; justify-content: center;">%s</div>') % (BR7, wordmark(mark_c(46, PE3, PE1, '#B9C9B3'), color='#FFFFFF', subcolor='#E6D8C9')),
            gap=14))
  + sec('ช่องรูปเทียบขนาดรายสัปดาห์', 'ดึงจาก R2 ด้วย path คงที่ — ไม่มีไฟล์ = ตกไป fallback อัตโนมัติ แอปจึงทำงานได้ตั้งแต่วันแรกที่ยังไม่มีรูปสักใบ',
        row(('<div style="flex: 1; background: %s; border: 1px solid %s; border-radius: 12px; padding: 18px; '
             'display: flex; flex-direction: column; align-items: center; gap: 10px;">%s'
             '<div style="text-align: center;"><div style="font-size: 13px; font-weight: 600;">มีรูปใน R2</div>'
             '<div style="font-family: ui-monospace, monospace; font-size: 10px; color: %s; margin-top: 3px;">'
             'weekly/size/w24.webp</div></div></div>') % (WHITE, CR200, size_slot(88, True), IN4),
            ('<div style="flex: 1; background: %s; border: 1px solid %s; border-radius: 12px; padding: 18px; '
             'display: flex; flex-direction: column; align-items: center; gap: 10px;">%s'
             '<div style="text-align: center;"><div style="font-size: 13px; font-weight: 600;">ยังไม่มีรูป — fallback</div>'
             '<div style="font-size: 11px; color: %s; margin-top: 3px; line-height: 1.5;">แสดงเลขสัปดาห์บนพื้น peach-100<br>ชื่อผลไม้ยังอยู่ครบ ไม่มีอะไรพัง</div></div></div>'
             ) % (WHITE, CR200, size_slot(88, False), IN6),
            gap=14))
  + sec('Photo', 'รูปยังเป็น placeholder — ระบบยังไม่มีภาพจริง',
        row(('<div style="width: 150px;">%s</div>' % phototile('scan', '100%', 112, 10, 'อัลตราซาวด์')),
            ('<div style="width: 150px;">%s</div>' % phototile('photo', '100%', 112, 10, 'ครอบครัว')),
            ('<div style="width: 150px;">%s</div>' % addphoto(112)),
            ('<div style="width: 112px;">%s</div>' % avatar_photo(96)),
            gap=14, align='flex-start'))
  + sec('Feedback', 'Toast · Error card · Empty state',
        row(('<div style="flex: 1; background: %s; border: 1px solid %s; border-left: 3px solid %s; '
             'border-radius: 12px; padding: 14px 16px; box-shadow: %s; display: flex; align-items: center; gap: 10px;">'
             '%s<span style="font-size: 14px; color: %s;">บันทึกสุขภาพเรียบร้อย</span></div>'
             ) % (WHITE, CR200, OK, SHADOW, ic('check', 18, OK, 2.2), IN9),
            ('<div style="flex: 1; background: %s; border: 1px solid %s; border-radius: 12px; padding: 14px 16px; '
             'display: flex; align-items: center; gap: 10px;">%s'
             '<span style="flex: 1; font-size: 14px; color: %s;">โหลดข้อมูลไม่สำเร็จ</span>'
             '<span style="font-size: 14px; font-weight: 500; color: %s;">ลองใหม่</span></div>'
             ) % (CR100, BAD, ic('alert', 18, BAD, 1.9), IN9, BR7),
            gap=12, align='stretch'))
  + '</div>')
write('Components.dc.html', comp, w=900, h=1720)

# ---------- Family: non-owner ----------
write('FamilyViewer.dc.html', screen(
  topbar('ครอบครัว', left=ic('chevL', 22, IN6)),
  ('<div style="flex: none; background: %s; border-bottom: 1px solid %s; padding: 10px 16px; '
   'display: flex; align-items: center; gap: 8px;">%s'
   '<span style="font-size: 13px; color: %s;">คุณมีสิทธิ์<span style="font-weight: 500; color: %s;">ดูอย่างเดียว</span> '
   'ในครอบครัวนี้</span></div>') % (CR100, CR200, ic('eye', 16, IN6, 1.9), IN6, IN9),
  body(
    card(col(txt('ครอบครัวใจดี', 24, IN9, 600), txt('สมาชิก 3 คน', 14, IN6), gap=4),
         radius=16, pad=20),
    section_head('สมาชิก'),
    card(member('ญ', 'ญาญ่า ใจดี', 'yaya@example.com', 'เจ้าของ', 'owner', menu=False),
         '<div style="height: 1px; background: %s;"></div>' % CR200,
         member('น', 'พี่นก ใจดี', 'nok@example.com', 'แก้ไขได้', 'editor', menu=False),
         '<div style="height: 1px; background: %s;"></div>' % CR200,
         member('ม', 'คุณแม่มาลี', 'malee@example.com', 'ดูอย่างเดียว', 'viewer', me=True, menu=False),
         gap=14),
    '<div style="flex: 1;"></div>',
    row(ic('logout', 18, IN6, 1.9), txt('ออกจากครอบครัวนี้', 15, IN6), gap=8, justify='center'),
    pad=16, gap=12),
  bottomnav(4),
), h=844)


# ============================================================
#  ค่าใช้จ่ายนัดหมาย — ออกแบบใหม่ (รอ approve ก่อนลงมือ)
# ============================================================

CLAIM = {'none': ('ยังไม่เบิก', CR200, IN6), 'done': ('เบิกแล้ว', '#E5EBE2', '#5F7358'),
         'no': ('เบิกไม่ได้', CR100, IN4)}

def claim_pill(kind='none'):
    t, bg, fg = CLAIM[kind]
    return ('<span style="background: %s; color: %s; border-radius: 9999px; padding: 5px 10px; '
            'font-size: 12px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">%s %s</span>'
            ) % (bg, fg, t, ic('chev', 12, fg, 2))

def cost_entry_strip(total=15900, missing=3):
    """ทางเข้าฟีเจอร์บนหน้านัดหมาย — ตัวเลขเป็นทั้งข้อมูลและปุ่มในตัวเดียว"""
    right = col(
        row(money(total, 22, IN9, 600), ic('chev', 18, IN4), gap=6),
        (txt('%d นัดยังไม่ได้ระบุ' % missing, 12, WARN) if missing else txt('ระบุครบแล้ว', 12, OK)),
        gap=2, extra='align-items: flex-end;')
    # บอกตั้งแต่ตรงนี้ว่ายอดรวมมาจากหลายเรื่อง กดเข้าไปแยกดูได้
    breakdown = row(
        row(group_dot('preg', 8), txt('ฝากครรภ์ ฿12,400', 11, IN6), gap=5),
        row(group_dot('dent', 8), txt('ทันตกรรม ฿3,500', 11, IN6), gap=5),
        gap=12, wrap=True)
    return card(
        row(row(ic('wallet', 20, PE7), txt('ค่าใช้จ่ายทั้งหมด', 14, IN6), gap=8),
            right, justify='space-between'),
        '<div style="height: 1px; background: %s;"></div>' % PE3,
        breakdown,
        pad=14, gap=10, bg=PE1, border=PE3)

def summary_stat(label_, value_html, sub=None, flex=True):
    return col(txt(label_, 12, IN6), value_html,
               (txt(sub, 11, IN4) if sub else ''),
               gap=3, extra=('flex: 1;' if flex else ''))

def cost_summary_card(total=12400, avg=1550, counted=8, missing=3):
    warn_row = ''
    if missing:
        # ยอดรวมที่เงียบๆ ไม่นับนัดที่ยังไม่กรอก = ตัวเลขหลอก ต้องบอกให้เห็นชัด
        warn_row = ('<div style="background: %s; border-radius: 8px; padding: 10px 12px; display: flex; '
                    'align-items: center; gap: 8px;">%s<span style="font-size: 13px; color: %s;">'
                    'ยังไม่ได้ระบุอีก <b>%d นัด</b> ยอดรวมจึงยังไม่ครบ</span></div>'
                    ) % (CR100, ic('alert', 16, WARN, 1.9), IN6, missing)
    return card(
        col(txt('รวมทั้งหมด', 13, IN6), money(total, 32, IN9, 600), gap=2),
        row(summary_stat('เฉลี่ยต่อนัด', money(avg, 17, IN9, 600), 'จาก %d นัดที่ระบุแล้ว' % counted),
            '<div style="width: 1px; align-self: stretch; background: %s;"></div>' % CR200,
            summary_stat('เบิกได้', money(6400, 17, IN9, 600), 'เบิกแล้ว ฿3,200'),
            gap=14),
        warn_row, gap=14)

def cost_row_mobile(mon, day, title, place, value=None, claim='none', past=True, grp=('ฝากครรภ์','preg')):
    return card(
        row(datebox(mon, day, past=past),
            col(row(txt(title, 15, IN9, 500), gap=6),
                row(group_tag(grp[0], grp[1]), txt(place, 12, IN4), gap=6),
                gap=4, extra='flex: 1; min-width: 0;'),
            gap=10),
        row(money_input(value, 118), claim_pill(claim), justify='space-between'),
        pad=12, gap=10)

def month_group(name, subtotal, rows_):
    return col(
        row(txt(name, 14, IN6), money(subtotal, 15, IN9, 600), justify='space-between'),
        col(*rows_, gap=8), gap=8)

def mini_row(day, title, value=None, kind='preg'):
    v = money(value, 15, IN9, 500) if value is not None else txt('ยังไม่ระบุ', 13, WARN)
    return row(group_dot(kind, 8),
               txt(day, 13, IN4, extra='width: 52px; flex: none;'),
               txt(title, 14, IN9, extra='flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'),
               v, justify='space-between', gap=8,
               extra='padding: 9px 12px; background: %s; border: 1px solid %s; border-radius: 10px;' % (WHITE, CR200))

def sheet_head(title, sub=None):
    return ('<div style="height: 56px; flex: none; padding: 0 8px 0 4px; background: %s; border-bottom: 1px solid %s; '
            'display: flex; align-items: center; gap: 4px;">'
            '<div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">%s</div>'
            '<div style="display: flex; flex-direction: column;"><span style="font-size: 16px; font-weight: 600; color: %s;">%s</span>'
            '%s</div></div>'
            ) % (WHITE, CR200, ic('x', 22, IN6), IN9, title,
                 ('<span style="font-size: 12px; color: %s;">%s</span>' % (IN4, sub)) if sub else '')

def sticky_footer(*parts):
    return ('<div style="margin-top: auto; flex: none; background: %s; border-top: 1px solid %s; '
            'padding: 12px 16px; display: flex; flex-direction: column; gap: 10px;">%s</div>'
            ) % (WHITE, CR200, ''.join(parts))


# ---------- A. หน้านัดหมาย + ทางเข้าค่าใช้จ่าย ----------
write('CostEntry.dc.html', screen(
  dash_topbar(),
  body(
    row(txt('นัดหมายแพทย์', 24, IN9, 600), justify='space-between'),
    cost_entry_strip(12400, 3),
    toggle2('กำลังจะถึง', 'ผ่านมาแล้ว', 0),
    section_head('สัปดาห์นี้'),
    appt_card('ก.ย.', '1', '09:30', 'ตรวจครรภ์ตามนัด', 'พญ. สมหญิง', 'รพ. ตัวอย่าง',
              'เตือนก่อน 1 ชั่วโมง', 'อีก 6 วัน', 'soft'),
    gap=14),
  fab(), bottomnav(2)), h=900)

# ---------- B. Popup มือถือ — ระบุค่าใช้จ่ายรายนัด ----------
write('CostSheet.dc.html',
  '<div style="width: 390px; min-height: 1180px; background: %s; display: flex; flex-direction: column; color: %s;">%s</div>' % (CR50, IN9,
    sheet_head('ค่าใช้จ่ายนัดหมาย', '10 จาก 13 นัดระบุแล้ว') +
    body(
      cost_summary_card(15900, 1590, 10, 3),
      group_filter(0),
      segmented(['รายนัด', 'รายเดือน', 'รายกลุ่ม'], 0),
      section_head('ผ่านมาแล้ว'),
      cost_row_mobile('ก.ค.', '13', 'ตรวจครรภ์', 'รพ. ตัวอย่าง', 1200, 'done'),
      cost_row_mobile('ก.ค.', '27', 'ตรวจปัสสาวะ', 'รพ. ตัวอย่าง', 800, 'none'),
      cost_row_mobile('ส.ค.', '5', 'ขูดหินปูน', 'คลินิกทันตกรรม', 1500, 'no',
                      grp=('ทันตกรรม', 'dent')),
      cost_row_mobile('ส.ค.', '12', 'ตรวจครรภ์ + อัลตราซาวด์', 'รพ. ตัวอย่าง', 2000, 'none'),
      cost_row_mobile('ก.ย.', '2', 'ฉีดวัคซีนบาดทะยัก', 'คลินิกใกล้บ้าน', None, 'none'),
      section_head('ยังไม่ถึงนัด'),
      # นัดอนาคตกรอกได้ บางที่เก็บค่าฝากครรภ์เหมาจ่ายล่วงหน้า
      cost_row_mobile('ก.ย.', '16', 'ตรวจครรภ์ตามนัด', 'รพ. ตัวอย่าง', None, 'none', past=False),
      cost_row_mobile('ต.ค.', '3', 'อุดฟัน', 'คลินิกทันตกรรม', 2000, 'no', past=False,
                      grp=('ทันตกรรม', 'dent')),
      gap=14) +
    sticky_footer(
      row(txt('รวมที่ระบุแล้ว · ทุกกลุ่ม', 14, IN6), money(15900, 20, IN9, 600), justify='space-between'),
      btn('บันทึก', 'primary'))),
  h=1400)

# ---------- C. รายเดือน — ดูทีละเดือน ----------
# เดิมไล่ทุกเดือนต่อกันเป็นพรืดในหน้าเดียว ยิ่งใช้ไปนานยิ่งยาวและอ่านไม่ออก
# ว่าเดือนนี้จ่ายไปเท่าไหร่ ตอนนี้เลือกดูทีละเดือน ตัวเลขใหญ่คือของเดือนนั้นเท่านั้น
MONTHS = [('เม.ย.', 2800), ('พ.ค.', 2000), ('มิ.ย.', 3600), ('ก.ค.', 2000),
          ('ส.ค.', 3500), ('ก.ย.', 0), ('ต.ค.', 2000)]

write('CostMonthly.dc.html',
  '<div style="width: 390px; min-height: 1000px; background: %s; display: flex; flex-direction: column; color: %s;">%s</div>' % (CR50, IN9,
    sheet_head('ค่าใช้จ่ายนัดหมาย', 'รายเดือน') +
    body(
      group_filter(0),
      segmented(['รายนัด', 'รายเดือน', 'รายกลุ่ม'], 1),
      month_nav('สิงหาคม 2569', 3500, delta=1500,
                groups=[('ฝากครรภ์', 'preg', 2000), ('ทันตกรรม', 'dent', 1500)]),
      month_strip(MONTHS, sel=4),
      section_head('รายการในเดือนนี้'),
      cost_row_mobile('ส.ค.', '5', 'ขูดหินปูน', 'คลินิกทันตกรรม', 1500, 'no',
                      grp=('ทันตกรรม', 'dent')),
      cost_row_mobile('ส.ค.', '12', 'ตรวจครรภ์ + อัลตราซาวด์', 'รพ. ตัวอย่าง', 2000, 'none'),
      gap=14)),
  h=1000)

# ---------- C2. รายเดือน — เดือนที่ยังไม่ได้กรอก ----------
# เดือนที่มีนัดแต่ยังไม่กรอกสักนัด ต้องไม่โชว์ ฿0 เพราะอ่านได้ว่าเดือนนั้นไม่เสียเงิน
write('CostMonthEmpty.dc.html',
  '<div style="width: 390px; min-height: 1000px; background: %s; display: flex; flex-direction: column; color: %s;">%s</div>' % (CR50, IN9,
    sheet_head('ค่าใช้จ่ายนัดหมาย', 'รายเดือน') +
    body(
      group_filter(0),
      segmented(['รายนัด', 'รายเดือน', 'รายกลุ่ม'], 1),
      month_nav('กันยายน 2569', 0, empty=True),
      month_strip(MONTHS, sel=5),
      section_head('รายการในเดือนนี้'),
      cost_row_mobile('ก.ย.', '2', 'ฉีดวัคซีนบาดทะยัก', 'คลินิกใกล้บ้าน', None, 'none'),
      cost_row_mobile('ก.ย.', '16', 'ตรวจครรภ์ตามนัด', 'รพ. ตัวอย่าง', None, 'none', past=False),
      cost_row_mobile('ก.ย.', '30', 'ตรวจครรภ์ตามนัด', 'รพ. ตัวอย่าง', None, 'none', past=False),
      gap=14)),
  h=1000)

# ---------- D. เดสก์ท็อป — ตารางจริง ----------
def th(t, align='left', w=None):
    return ('<div style="font-size: 12px; color: %s; text-align: %s; %s">%s</div>'
            ) % (IN6, align, ('width: %dpx; flex: none;' % w) if w else 'flex: 1; min-width: 0;', t)

def td(html, align='left', w=None):
    return ('<div style="text-align: %s; %s display: flex; align-items: center; %s">%s</div>'
            ) % (align, ('width: %dpx; flex: none;' % w) if w else 'flex: 1; min-width: 0;',
                 'justify-content: flex-end;' if align == 'right' else '', html)

def trow(*cells, head=False):
    bg = 'transparent' if head else WHITE
    bd = ('border-bottom: 1px solid %s;' % CR200)
    return ('<div style="display: flex; align-items: center; gap: 12px; padding: %s; background: %s; %s">%s</div>'
            ) % ('8px 14px' if head else '12px 14px', bg, bd, ''.join(cells))

write('CostDesktop.dc.html',
  ('<div style="width: 1000px; min-height: 720px; background: rgba(43,36,32,0.35); padding: 40px; '
   'box-sizing: border-box; display: flex; align-items: flex-start; justify-content: center; color: %s;">'
   '<div style="width: 100%%; background: %s; border-radius: 16px; box-shadow: 0 8px 24px rgba(43,36,32,0.12); '
   'overflow: hidden; display: flex; flex-direction: column;">%s</div></div>'
  ) % (IN9, CR50,
    ('<div style="height: 60px; flex: none; padding: 0 20px; background: %s; border-bottom: 1px solid %s; '
     'display: flex; align-items: center; justify-content: space-between;">'
     '<div style="display: flex; align-items: center; gap: 10px;">%s<span style="font-size: 17px; font-weight: 600;">ค่าใช้จ่ายนัดหมาย</span>'
     '<span style="font-size: 13px; color: %s;">10 จาก 13 นัดระบุแล้ว</span></div>%s</div>'
     ) % (WHITE, CR200, ic('wallet', 21, PE7), IN4, ic('x', 22, IN6)) +
    ('<div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 16px;">' +
      row(
        card(col(txt('รวมทั้งหมด', 12, IN6), money(15900, 26, IN9, 600), gap=2), pad=14, extra='flex: 1;'),
        card(col(txt('ฝากครรภ์', 12, IN6), money(12400, 26, IN9, 600), gap=2), pad=14, extra='flex: 1;'),
        card(col(txt('ทันตกรรม', 12, IN6), money(3500, 26, IN9, 600), gap=2), pad=14, extra='flex: 1;'),
        card(col(txt('ยังไม่ได้ระบุ', 12, IN6), txt('3 นัด', 26, WARN, 600), gap=2), pad=14, extra='flex: 1;'),
        gap=12) +
      row('<div style="width: 300px; flex: none;">%s</div>' % segmented(['รายนัด', 'รายเดือน', 'รายกลุ่ม'], 0),
          '<div style="flex: 1;"></div>',
          group_filter(0),
          gap=12) +
      ('<div style="background: %s; border: 1px solid %s; border-radius: 12px; overflow: hidden;">' % (WHITE, CR200)) +
      trow(th('วันที่', w=100), th('นัดหมาย'), th('กลุ่ม', w=110), th('สถานที่', w=130),
           th('จำนวนเงิน', 'right', 130), th('การเบิก', 'right', 115), head=True) +
      trow(td(txt('13 ก.ค. 69', 14, IN6), w=100), td(txt('ตรวจครรภ์', 15)),
           td(group_tag('ฝากครรภ์', 'preg'), w=110), td(txt('รพ. ตัวอย่าง', 13, IN4), w=130),
           td(money_input(1200, 118), 'right', 130), td(claim_pill('done'), 'right', 115)) +
      trow(td(txt('5 ส.ค. 69', 14, IN6), w=100), td(txt('ขูดหินปูน', 15)),
           td(group_tag('ทันตกรรม', 'dent'), w=110), td(txt('คลินิกทันตกรรม', 13, IN4), w=130),
           td(money_input(1500, 118), 'right', 130), td(claim_pill('no'), 'right', 115)) +
      trow(td(txt('12 ส.ค. 69', 14, IN6), w=100), td(txt('ตรวจครรภ์ + อัลตราซาวด์', 15)),
           td(group_tag('ฝากครรภ์', 'preg'), w=110), td(txt('รพ. ตัวอย่าง', 13, IN4), w=130),
           td(money_input(2000, 118), 'right', 130), td(claim_pill('none'), 'right', 115)) +
      trow(td(txt('2 ก.ย. 69', 14, IN6), w=100), td(txt('ฉีดวัคซีนบาดทะยัก', 15)),
           td(group_tag('ฝากครรภ์', 'preg'), w=110), td(txt('คลินิกใกล้บ้าน', 13, IN4), w=130),
           td(money_input(None, 118, 'focus'), 'right', 130), td(claim_pill('none'), 'right', 115)) +
      trow(td(txt('3 ต.ค. 69', 14, IN6), w=100),
           td(row(txt('อุดฟัน', 15), badge('ยังไม่ถึงนัด', 'past'), gap=8)),
           td(group_tag('ทันตกรรม', 'dent'), w=110), td(txt('คลินิกทันตกรรม', 13, IN4), w=130),
           td(money_input(2000, 118), 'right', 130), td(claim_pill('no'), 'right', 115)) +
      '</div>' +
      row('<div style="flex: 1;"></div>',
          row(txt('รวมที่ระบุแล้ว · ทุกกลุ่ม', 14, IN6), money(15900, 22, IN9, 600), gap=12),
          btn('บันทึก', 'primary', full=False), gap=16) +
     '</div>')),
  w=1000, h=720)


# ---------- D2. สรุปรายกลุ่ม ----------
write('CostGroups.dc.html',
  '<div style="width: 390px; min-height: 1000px; background: %s; display: flex; flex-direction: column; color: %s;">%s</div>' % (CR50, IN9,
    sheet_head('ค่าใช้จ่ายนัดหมาย', 'รายกลุ่ม') +
    body(
      card(
        col(txt('รวมทุกกลุ่ม', 13, IN6), money(15900, 32, IN9, 600), gap=2),
        # แถบเดียวแบ่งสัดส่วน เห็นทันทีว่าเงินไปลงเรื่องไหนมากที่สุด
        ('<div style="height: 10px; border-radius: 9999px; overflow: hidden; display: flex;">'
         '<div style="width: 78%%; background: %s;"></div>'
         '<div style="width: 22%%; background: %s;"></div></div>'
         ) % (PE7, '#5E7B94'),
        row(row(group_dot('preg', 8), txt('ฝากครรภ์ 78%', 11, IN6), gap=5),
            row(group_dot('dent', 8), txt('ทันตกรรม 22%', 11, IN6), gap=5),
            gap=12, wrap=True),
        gap=12),
      group_filter(0),
      segmented(['รายนัด', 'รายเดือน', 'รายกลุ่ม'], 2),
      group_summary_card('ฝากครรภ์', 'preg', 12400, 8, missing=3, pct=78),
      group_summary_card('ทันตกรรม', 'dent', 3500, 2, missing=0, pct=22),
      card(
        row(ic('plus', 18, BR7), txt('เพิ่มกลุ่มการรักษา', 15, BR7, 500), gap=8),
        txt('เช่น โรคประจำตัว ตรวจสุขภาพประจำปี — นัดหมายที่ไม่ได้เลือกกลุ่มจะไปอยู่ ทั่วไป', 12, IN4),
        pad=14, gap=6, extra='border-style: dashed;'),
      gap=14)),
  h=1000)

# ---------- E. สถานะว่าง + viewer ----------
write('CostEmpty.dc.html',
  '<div style="width: 390px; min-height: 820px; background: %s; display: flex; flex-direction: column; color: %s;">%s</div>' % (CR50, IN9,
    sheet_head('ค่าใช้จ่ายนัดหมาย') +
    body(
      col(('<div style="width: 88px; height: 88px; border-radius: 9999px; background: %s; display: flex; '
           'align-items: center; justify-content: center; margin: 0 auto;">%s</div>') % (CR100, ic('receipt', 38, BR3, 1.5)),
          txt('ยังไม่มีนัดหมายให้ระบุค่าใช้จ่าย', 17, IN9, 600, 'text-align: center;'),
          txt('เพิ่มนัดหมายก่อน แล้วค่อยกลับมาบันทึกค่าใช้จ่ายของแต่ละครั้ง', 14, IN6,
              extra='text-align: center; line-height: 1.6;'),
          btn('เพิ่มนัดหมาย', 'secondary', ic('plus', 18, BR7)),
          gap=14, extra='padding: 48px 12px 0;'),
      '<div style="height: 28px;"></div>',
      section_head('เมื่อเป็น viewer'),
      card(
        row(ic('eye', 18, IN6), txt('คุณมีสิทธิ์ดูอย่างเดียว', 14, IN6), gap=8),
        row(datebox('ส.ค.', '12'),
            col(txt('ตรวจครรภ์ + อัลตราซาวด์', 15, IN9, 500), txt('รพ. ตัวอย่าง', 12, IN4), gap=3,
                extra='flex: 1; min-width: 0;'),
            money(2400, 17, IN9, 600), gap=10),
        txt('ตัวเลขเป็นข้อความธรรมดา ไม่ใช่ช่องกรอก และไม่มีปุ่มบันทึก', 12, IN4),
        pad=12, gap=10),
      gap=14)),
  h=820)


COST_DECISIONS = """ตัดสินใจครบแล้ว พร้อมเขียนโค้ด

  ค่าใช้จ่ายผูกกับนัดหมาย — คอลัมน์ cost_satang ใน appointments
  นัดหมายมีกลุ่มการรักษา แยกยอดรายกลุ่มได้
  นัดหมายอนาคตกรอกค่าใช้จ่ายได้ แต่แยกกลุ่ม ยังไม่ถึงนัด
  ไม่ทำส่งออก CSV
  แท็บรายเดือนดูทีละเดือน ไม่ไล่ทั้งปีในหน้าเดียว


สิ่งที่ตามมาจากการเลือก ผูกกับนัด (ไม่ใช่ปัญหา แต่ควรรู้ไว้)

  1 นัด = 1 ยอด แยกบรรทัดค่าตรวจ/ค่ายา/อัลตราซาวด์ ในนัดเดียวไม่ได้
  ถ้าวันหลังอยากแยก ต้อง migrate ไปตาราง expenses แล้วย้ายข้อมูลเดิม
  ระหว่างนี้ใครอยากแยกก็เขียนลงช่องหมายเหตุแทนได้
  ค่าใช้จ่ายที่ไม่ผูกกับนัด (วิตามิน ของเตรียมคลอด) ยังบันทึกไม่ได้ ตามที่ตกลง


โครงข้อมูลที่จะเขียน

  appointments
    + group_id  TEXT NULL  -> care_groups.id  (null = ทั่วไป)
    + cost_satang INTEGER NULL   null = ยังไม่ได้ระบุ / 0 = ไปแล้วไม่เสียเงิน
      สองอย่างนี้คนละความหมาย UI แยกให้เห็นชัดแล้ว
    + claim_status TEXT NOT NULL DEFAULT 'none'   none | done | no
    + cost_note TEXT NULL

  care_groups (id, family_id, name, color, archived, created_at)
    migration สร้างกลุ่ม ฝากครรภ์ ให้ทุกครอบครัวที่มีอยู่ 1 กลุ่ม
    แล้วอัปเดตนัดหมายเดิมทั้งหมดเข้ากลุ่มนั้น ผู้ใช้เดิมจึงไม่เห็นอะไรเปลี่ยน

  เก็บเงินเป็นจำนวนเต็มสตางค์ ห้ามใช้ REAL/float
    120000 = 1,200 บาท แล้วหารตอนแสดงผล
    D1 เป็น SQLite ไม่มี DECIMAL ให้ใช้ ถ้าใช้ float ยอดรวมจะผิดในบางเคสแน่นอน


กติกาที่ UI ต้องรักษาไว้

  ยอดรวมต้องบอกเสมอว่ายังไม่ได้ระบุกี่นัด ยอดที่เงียบๆ ไม่นับนัดที่ยังไม่กรอก
  คือตัวเลขหลอก เอาไปวางแผนเงินไม่ได้

  ช่องว่างเขียนว่า ยังไม่ระบุ ไม่ใช่ ฿0 · เดือนที่ยังไม่กรอกสักนัดก็เช่นกัน

  ประมาณการจนคลอดนับเฉพาะกลุ่มฝากครรภ์ ไม่รวมเรื่องอื่น
  ไม่งั้นกลายเป็นเอาค่าทำฟันไปคูณจำนวนนัดฝากครรภ์ที่เหลือ

  สิทธิ์ใช้ชุดเดียวกับนัดหมาย editor ขึ้นไปแก้ได้
  viewer เห็นเป็นข้อความธรรมดา ไม่มีช่องกรอก ไม่มีปุ่มบันทึก


ยังไม่ได้ออกแบบ ไว้คุยรอบหน้า

  หน้ารายการนัดหมายกรองตามกลุ่ม
  หน้าจัดการกลุ่ม (เปลี่ยนชื่อ เปลี่ยนสี ซ่อนกลุ่มที่เลิกใช้)"""



# ---------- canvas.json ----------
GROUPS = [
 ('auth', 'Auth + Onboarding',
  ['Login.dc.html','Signup.dc.html','Invite.dc.html','Onboarding.dc.html','OnboardingDone.dc.html'],
  "Auth + Onboarding\nแบรนด์ที่ผู้ใช้เห็นตอนเข้าคือ Health Care (ตัว web app)\nGoogle OAuth + อีเมล/รหัสผ่าน — อีเมลคือชื่อผู้ใช้\nยังไม่มีปุ่มลืมรหัสผ่าน ใช้ข้อความชี้ทางไป Google แทน"),
 ('dash', 'Dashboard',
  ['Main.dc.html','DashboardSetup.dc.html','DashboardViewer.dc.html','DashboardV2.dc.html'],
  "Dashboard 4 แบบ\nแถบบนแสดงชื่อฟีเจอร์ Pre Care — Health Care จะมีฟีเจอร์อื่นตามมาทีหลัง\nเลขสัปดาห์คือจุดสายตาแรก · viewer ไม่เห็น quick actions เลย ไม่ใช่ disabled\nใบขวาสุดคือ Phase 2 ที่เพิ่มการ์ดขนาดลูกน้อย + พัฒนาการเข้ามา"),
 ('health', 'สุขภาพ + นัดหมาย',
  ['Health.dc.html','HealthEmpty.dc.html','HealthForm.dc.html','Appointments.dc.html','AppointmentForm.dc.html'],
  "สุขภาพ + นัดหมาย\nฟอร์มสุขภาพแนบรูปได้ รูปไหลเข้าอัลบั้มอัตโนมัติ (Phase 2)\nFAB หายไปทั้งปุ่มเมื่อเป็น viewer · ความดันเกินเกณฑ์ใช้ danger แบบหม่น ไม่ทำแถบแดงทั้งการ์ด"),
 ('profile', 'โปรไฟล์ + ครอบครัว',
  ['Profile.dc.html','ProfileEdit.dc.html','Family.dc.html','FamilyViewer.dc.html','FamilyInvite.dc.html'],
  "โปรไฟล์ = ทางเข้าครอบครัว\nbottom nav สลับ ครอบครัว ออก เอา อัลบั้ม เข้ามาแทน\nอัปโหลดรูปโปรไฟล์ย้ายมาอยู่ Phase 1 แล้ว · อีเมลแก้ไม่ได้เพราะเป็นชื่อผู้ใช้\nเมนู ⋮ และปุ่มเชิญยังเห็นเฉพาะ owner"),
 ('cost', 'ค่าใช้จ่ายนัดหมาย — เสนอใหม่',
  ['CostEntry.dc.html','CostSheet.dc.html','CostMonthly.dc.html','CostMonthEmpty.dc.html',
   'CostGroups.dc.html','CostDesktop.dc.html','CostEmpty.dc.html'],
  """ค่าใช้จ่ายนัดหมาย — ยังไม่ได้ลงมือ รอ approve (แก้รอบ 2)
นัดหมายมีกลุ่มการรักษาได้ เช่น ฝากครรภ์ ทันตกรรม โรคประจำตัว ยอดจึงแยกดูรายกลุ่มได้
ไม่งั้นค่าทำฟันจะไปปนกับค่าฝากครรภ์แล้วตัวเลขไม่มีความหมาย
เลือกกลุ่มตั้งแต่ตอนสร้างนัด ไม่ต้องมากรอกซ้ำทีหลัง — ดูใบฟอร์มนัดหมายในกลุ่ม สุขภาพ + นัดหมาย
นัดหมายอนาคตกรอกค่าใช้จ่ายได้ แต่แยกกลุ่ม ยังไม่ถึงนัด ให้เห็นว่าไม่ใช่ยอดที่จ่ายไปแล้ว
ยอดรวมต้องบอกเสมอว่ายังไม่ได้ระบุกี่นัด ไม่งั้นเป็นตัวเลขหลอก
ประเด็นที่ยังต้องตัดสินใจ อยู่ในโน้ตใต้แถว"""),
 ('album', 'อัลบั้ม — Phase 2',
  ['Album.dc.html','AlbumUpload.dc.html','PhotoDetail.dc.html'],
  "อัลบั้ม + ดูรูป — Phase 2\nรูปจากฟอร์มสุขภาพมารวมที่นี่ จัดกลุ่มตามสัปดาห์\nปุ่มแชร์ social วางโครงไว้แล้วแต่ยังไม่เปิด (Phase 3) จึงเป็น disabled พร้อมป้ายบอก\nรูปทุกใบเป็น placeholder ยังไม่มีภาพจริง"),
]
heights = {'CostEntry.dc.html':900,'CostSheet.dc.html':1180,'CostMonthly.dc.html':1120,
           'CostDesktop.dc.html':720,'CostEmpty.dc.html':820,'CostGroups.dc.html':1000,'CostMonthly.dc.html':1000,'CostMonthEmpty.dc.html':1000,
           'Health.dc.html':980,'HealthForm.dc.html':1300,'Appointments.dc.html':940,
           'AppointmentForm.dc.html':1230,'Family.dc.html':940,'FamilyInvite.dc.html':700,
           'Profile.dc.html':1320,'ProfileEdit.dc.html':680,'Album.dc.html':1020,'AlbumUpload.dc.html':940,'PhotoDetail.dc.html':980,
           'DashboardV2.dc.html':1080}
titles = {'Login.dc.html':'เข้าสู่ระบบ','Signup.dc.html':'สมัครสมาชิก','Invite.dc.html':'รับคำเชิญ',
          'Onboarding.dc.html':'Onboarding · ขั้น 3','OnboardingDone.dc.html':'Onboarding · ขั้น 4',
          'Main.dc.html':'Dashboard · owner','DashboardSetup.dc.html':'Dashboard · ยังไม่ตั้ง LMP',
          'DashboardViewer.dc.html':'Dashboard · viewer','DashboardV2.dc.html':'Dashboard · Phase 2',
          'Health.dc.html':'บันทึกสุขภาพ','HealthEmpty.dc.html':'บันทึกสุขภาพ · ว่าง',
          'HealthForm.dc.html':'ฟอร์มสุขภาพ','Appointments.dc.html':'นัดหมาย',
          'AppointmentForm.dc.html':'ฟอร์มนัดหมาย','Profile.dc.html':'โปรไฟล์',
          'ProfileEdit.dc.html':'แก้ไขโปรไฟล์ + อัปโหลดรูป','Family.dc.html':'ครอบครัว · owner',
          'FamilyViewer.dc.html':'ครอบครัว · viewer','FamilyInvite.dc.html':'เชิญสมาชิก',
          'CostEntry.dc.html':'นัดหมาย + ทางเข้าค่าใช้จ่าย','CostSheet.dc.html':'Popup · ระบุรายนัด',
          'CostMonthly.dc.html':'Popup · รายเดือน','CostMonthEmpty.dc.html':'รายเดือน · ยังไม่กรอก',
          'CostGroups.dc.html':'Popup · รายกลุ่ม',
          'CostDesktop.dc.html':'เดสก์ท็อป · ตาราง',
          'CostEmpty.dc.html':'ว่าง + สิทธิ์ viewer',
          'Album.dc.html':'อัลบั้ม · Phase 2','AlbumUpload.dc.html':'เพิ่มรูป · Phase 2',
          'PhotoDetail.dc.html':'ดูรูป + แชร์ · Phase 2–3'}

arts, notes, y = [], [], 0
for gid, gname, files, note in GROUPS:
    notes.append({"id": "note-" + gid, "x": 0, "y": y - 190, "w": 470, "page": "screens", "text": note})
    x = 0
    for f in files:
        w = 1000 if f == 'CostDesktop.dc.html' else 390
        arts.append({"file": f, "x": x, "y": y, "w": w,
                     "h": heights.get(f, 844), "title": titles[f], "page": "screens"})
        x += w + 80
    if gid == 'cost':
        # โน้ตตัดสินใจวางใต้แถว วางบนหัวเหมือนกลุ่มอื่นไม่ได้เพราะยาวเกิน
        notes.append({"id": "note-cost-decide", "x": 0,
                      "y": y + max(heights.get(f, 844) for f in files) + 40,
                      "w": 1400, "page": "screens", "text": COST_DECISIONS})
    y += max(heights.get(f, 844) for f in files) + 420

arts.append({"file": "Logo.dc.html", "x": 0, "y": 0, "w": 900, "h": 1680,
             "title": "Pre Care Logo — spec", "page": "logo"})
notes.append({"id":"note-logo","x":0,"y":-200,"w":900,"page":"logo",
  "text":"โลโก้ Pre Care — สรุปแล้ว: ตัวเลือก C (หน่ออ่อน) ใบเขียว sage\nใส่ลงหน้า Login / Signup และ component library เรียบร้อย ไม่มีอะไรค้าง\nสีที่ใช้: หัวใจ peach-500 #E89A6C · จุด peach-300 #F5BE9B · ใบ sage #8AA383\nสิ่งที่ต้อง export ตอน dev: SVG มาร์ก, favicon 32/48, app icon 192/512 (พื้น peach-100 มุมมน 24%)"})
arts.append({"file": "Components.dc.html", "x": 0, "y": 0, "w": 900, "h": 1720,
             "title": "Component Library", "page": "components"})

canvas = {
  "artboards": arts,
  "annotations": notes,
  "pages": [{"id":"logo","name":"โลโก้ Pre Care"},
            {"id":"screens","name":"หน้าจอ"},
            {"id":"components","name":"Component Library"}],
  "launch": {"view":"canvas","page":"screens"}
}
open(os.path.join(OUT,'canvas.json'),'w',encoding='utf-8').write(json.dumps(canvas, ensure_ascii=False, indent=2))
print('generated %d artboards + canvas.json' % len(arts))
