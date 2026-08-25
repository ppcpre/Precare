#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""แปลงตาราง task ใน docs/project-plan.md -> scripts/create-issues.sh

รันใหม่ทุกครั้งที่แก้ task ในแผน:  python3 scripts/gen-issues.py
สคริปต์ที่ได้กันสร้างซ้ำอยู่แล้ว จึงรัน create-issues.sh ซ้ำได้ปลอดภัย
"""
import re, os, shlex
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAN = os.path.join(ROOT, 'docs', 'project-plan.md')
OUT = os.path.join(ROOT, 'scripts', 'create-issues.sh')
REPO = 'ppcpre/Precare'

MILESTONES = {
 'M0': ('Foundation + Deploy', '3–4 วัน'), 'M1': ('Database + Data layer', '3–4 วัน'),
 'M2': ('Auth', '2–3 วัน'),                'M3': ('API layer', '5–6 วัน'),
 'M4': ('Design หน้าจอ', '5–7 วัน'),        'M5': ('UI implementation', '9–11 วัน'),
 'M6': ('Test + Go live', '3–4 วัน'),
}
COLORS = {'M0':'0E4B99','M1':'1D76DB','M2':'5319E7','M3':'B60205',
          'M4':'D93F0B','M5':'0E8A16','M6':'6B4F3F'}
DONE = {'T0.1'}   # task ที่ปิดไปแล้ว ไม่ต้องสร้าง issue


def clean(c):
    c = re.sub(r'\*\*(.+?)\*\*', r'\1', c.strip())
    c = re.sub(r'~~(.+?)~~', r'\1', c)
    return c.replace('<br>', ' ').replace('✅', '').strip()


def parse():
    tasks, cur, headers = [], None, []
    for ln in open(PLAN, encoding='utf-8').read().split('\n'):
        m = re.match(r'^### (M\d) ', ln)
        if m:
            cur, headers = m.group(1), []
            continue
        if not cur or not ln.startswith('|'):
            continue
        cells = ln.strip().strip('|').split('|')
        if not headers and 'ID' in cells[0]:
            headers = [clean(c) for c in cells]
            continue
        if set(''.join(cells).strip()) <= set('-: '):
            continue
        tid = clean(cells[0])
        if not re.fullmatch(r'T\d\.\d+', tid):
            continue
        rest = [(headers[i] if i < len(headers) else 'หมายเหตุ', clean(cells[i]))
                for i in range(2, len(cells)) if clean(cells[i]) and clean(cells[i]) != '—']
        tasks.append((cur, tid, clean(cells[1]) if len(cells) > 1 else '', rest))
    return tasks


def build(tasks):
    L = ['#!/usr/bin/env bash',
         '# สร้าง GitHub Issues จาก docs/project-plan.md',
         '# generate โดย scripts/gen-issues.py — อย่าแก้ไฟล์นี้มือ ให้แก้ project-plan.md แล้ว regenerate',
         '#', '# ใช้งาน:  brew install gh && gh auth login && ./scripts/create-issues.sh', '',
         'set -euo pipefail', 'REPO="%s"' % REPO, '',
         'command -v gh >/dev/null || { echo "❌ ยังไม่ได้ติดตั้ง gh — brew install gh"; exit 1; }',
         'gh auth status >/dev/null 2>&1 || { echo "❌ ยังไม่ได้ล็อกอิน — gh auth login"; exit 1; }',
         '', 'echo "==> สร้าง label"']
    for m, (name, est) in MILESTONES.items():
        L.append('gh label create %s --repo "$REPO" --color %s --description %s --force >/dev/null'
                 % (m, COLORS[m], shlex.quote('%s (%s)' % (name, est))))
    L += ['gh label create blocked --repo "$REPO" --color BFBFBF --description "รอ task อื่นก่อน" --force >/dev/null',
          '', 'echo "==> เช็ค issue เดิม (กันสร้างซ้ำ)"',
          "EXISTING=$(gh issue list --repo \"$REPO\" --state all --limit 500 --json title --jq '.[].title' || true)",
          '', 'create() {  # $1=title  $2=body  $3=labels',
          '  if grep -Fxq "$1" <<< "$EXISTING"; then echo "  ข้าม (มีแล้ว): $1"; return; fi',
          '  gh issue create --repo "$REPO" --title "$1" --body "$2" --label "$3" >/dev/null',
          '  echo "  สร้าง: $1"', '}', '']
    for m, tid, title, rest in tasks:
        if tid in DONE:
            continue
        body = ['**Milestone %s — %s**' % (m, MILESTONES[m][0]), '']
        body += ['**%s:** %s' % (k, v) for k, v in rest]
        body += ['', 'อ้างอิง: [docs/project-plan.md](https://github.com/%s/blob/main/docs/project-plan.md)' % REPO]
        labels = m + (',blocked' if any(k == 'ขึ้นกับ' for k, _ in rest) else '')
        L.append('create %s %s %s' % (shlex.quote('%s %s' % (tid, title)),
                                      shlex.quote('\n'.join(body)), shlex.quote(labels)))
    L += ['', 'echo', 'echo "✅ เสร็จ — ดูที่ https://github.com/$REPO/issues"',
          'echo "   ขั้นถัดไป: สร้าง Project board แล้วลาก issue เข้าไป"']
    return '\n'.join(L) + '\n'


if __name__ == '__main__':
    t = parse()
    open(OUT, 'w', encoding='utf-8').write(build(t))
    os.chmod(OUT, 0o755)
    n = len([x for x in t if x[1] not in DONE])
    print('parsed %d tasks -> %d issues' % (len(t), n))
    print(dict(Counter(x[0] for x in t)))
