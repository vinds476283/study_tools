#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给 ../data.js 的每条分子补上「IUPAC 名」（第 5 个字段）

用法::

    python -X utf8 refresh_iupac.py                 # 就地更新 ../data.js
    python -X utf8 refresh_iupac.py --dry-run       # 只打印，不写文件

新增分子到 data.js 之后跑一次即可；已有的 IUPAC 名会被重新算一遍。
"""

import argparse
import re
import sys
import os
from pathlib import Path

if not sys.flags.utf8_mode:
    try:
        os.execv(sys.executable, [sys.executable, "-X", "utf8"] + sys.argv)
    except Exception:
        pass

ROW_RE = re.compile(r"\[\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'(?:\s*,\s*'([^']*)'\s*)?\]")


def main():
    parser = argparse.ArgumentParser(description="刷新 data.js 里的 IUPAC 名")
    here = Path(__file__).resolve().parent
    parser.add_argument("--data", default=str(here.parent / "data.js"), help="data.js 路径")
    parser.add_argument("--dry-run", action="store_true", help="只打印")
    args = parser.parse_args()

    from orthonym import name_compound

    path = Path(args.data)
    src = path.read_text(encoding="utf-8")
    cache = {}

    def sys_name(smiles):
        if smiles not in cache:
            try:
                cache[smiles] = name_compound(smiles, style="systematic") or ""
            except Exception:
                cache[smiles] = ""
        return cache[smiles]

    def repl(m):
        zh, en, smi, alias = m.group(1), m.group(2), m.group(3), m.group(4)
        nm = sys_name(smi).replace("\\", "\\\\").replace("'", "\\'")
        return "['%s', '%s', '%s', '%s', '%s']" % (zh, en, smi, alias, nm)

    out, count = ROW_RE.subn(repl, src)
    print("处理了 %d 条" % count)
    empty = [l.strip() for l in out.splitlines() if re.search(r"'\s*\]\s*,?\s*$", l) and l.count(",") >= 4]
    if empty:
        print("有 %d 条没算出名字（保持空串）" % len(empty))

    if args.dry_run:
        for line in out.splitlines()[:15]:
            print(line)
        print("... (dry run, 未写文件)")
        return

    path.write_text(out, encoding="utf-8")
    print("已写入 %s" % path)


if __name__ == "__main__":
    main()
