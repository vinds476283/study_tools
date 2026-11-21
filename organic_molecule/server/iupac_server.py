#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""有机分子名称转换服务（校园内网用，全部离线运行）

  结构 -> IUPAC 名 : Orthonym  (MIT)  https://github.com/Steinbeck-Lab/Orthonym
  IUPAC 名 -> 结构 : OPSIN     (MIT)  https://github.com/dan2097/opsin   （经由 py2opsin 调用）

两者都需要一个 Java 运行时；Orthonym 第一次运行会自动把 OPSIN 的 jar 下载到
~/.cache/orthonym/jars（只下一次，之后离线可用）。

用法::

    python -X utf8 iupac_server.py                 # 监听 0.0.0.0:8017
    python -X utf8 iupac_server.py --port 8020
    python -X utf8 iupac_server.py --host 127.0.0.1 --no-warmup

接口（JSON，带 CORS，网页端可直接跨端口调用）：::

    GET  /health                           -> {"ok": true, ...}
    POST /api/name      {"smiles": "CCO"}  -> {"ok": true, "pin": "ethanol", "systematic": "ethan-1-ol"}
    POST /api/structure {"name": "ethanol"} -> {"ok": true, "smiles": "CCO"}
"""

import argparse
import importlib.util
import json
import os
import sys
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ---------------------------------------------------------------- 环境修正
# Windows 中文系统默认 GBK，Orthonym 读它自带的 JSON 数据时会 UnicodeDecodeError。
# 这里把本进程里"文本方式的 open"默认编码改成 UTF-8（二进制模式不动）。
if not sys.flags.utf8_mode:
    import builtins
    import io

    _real_open = io.open

    def _open_utf8(file, mode="r", *args, **kwargs):
        if "b" not in mode and "encoding" not in kwargs and not args:
            kwargs["encoding"] = "utf-8"
        return _real_open(file, mode, *args, **kwargs)

    builtins.open = _open_utf8
    io.open = _open_utf8

LOCK = threading.Lock()


def _have(module):
    try:
        return importlib.util.find_spec(module) is not None
    except Exception:
        return False


def _attach_jvm():
    """jpype 的 JVM 只在主线程 attach，处理请求的线程要先挂上去"""
    try:
        import jpype
    except Exception:
        return
    try:
        if not jpype.isThreadAttachedToJVM():
            jpype.attachThreadToJVM()
    except Exception:
        pass


def structure_to_name(smiles):
    """SMILES -> (PIN, 系统名)，取不到就给空串"""
    from orthonym import name_compound
    pin = name_compound(smiles, style="pin") or ""
    try:
        systematic = name_compound(smiles, style="systematic") or ""
    except Exception:
        systematic = ""
    return pin, systematic


def name_to_structure(name):
    """IUPAC/常用名 -> SMILES，解析不出来返回空串"""
    from py2opsin import py2opsin
    out = py2opsin(name)
    if isinstance(out, (list, tuple)):
        out = out[0] if out else ""
    return str(out or "").strip()


def warmup():
    """把 JVM、OPSIN jar 都先热起来，免得第一个用户等十几秒"""
    try:
        with LOCK:
            structure_to_name("CCO")
        print("[warmup] 结构命名就绪", flush=True)
    except Exception as exc:  # noqa: BLE001
        print("[warmup] 结构命名不可用: %s" % exc, flush=True)
    try:
        with LOCK:
            name_to_structure("ethanol")
        print("[warmup] 名称解析就绪", flush=True)
    except Exception as exc:  # noqa: BLE001
        print("[warmup] 名称解析不可用: %s" % exc, flush=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "IUPACServer/1.0"

    # -------------------------------------------------- 基础
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        # Chrome 的私有网络访问（页面在公网/本地文件，接口在内网）会多发一个头
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Cache-Control", "no-store")

    def _json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stdout.write("[%s] %s\n" % (self.address_string(), fmt % args))
        sys.stdout.flush()

    # -------------------------------------------------- 路由
    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):  # noqa: N802
        path = self.path.split("?")[0].rstrip("/") or "/"
        if path == "/health":
            self._json(200, {
                "ok": True,
                "service": "iupac",
                "name": _have("orthonym"),
                "structure": _have("py2opsin"),
                "python": sys.version.split()[0],
            })
            return
        self._json(404, {"ok": False, "error": "未知路径"})

    def do_POST(self):  # noqa: N802
        path = self.path.split("?")[0].rstrip("/")
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            data = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            self._json(400, {"ok": False, "error": "请求体不是合法 JSON"})
            return

        if path == "/api/name":
            self._handle_name(data)
        elif path == "/api/structure":
            self._handle_structure(data)
        else:
            self._json(404, {"ok": False, "error": "未知路径"})

    # -------------------------------------------------- 业务
    def _handle_name(self, data):
        smiles = str(data.get("smiles") or "").strip()
        if not smiles:
            self._json(400, {"ok": False, "error": "缺少 smiles"})
            return
        try:
            _attach_jvm()
            with LOCK:
                pin, systematic = structure_to_name(smiles)
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            self._json(500, {"ok": False, "error": "%s: %s" % (type(exc).__name__, exc)})
            return
        if not pin and not systematic:
            self._json(200, {"ok": False, "error": "没能给这个结构命名（可能超出规则范围）"})
            return
        self._json(200, {"ok": True, "pin": pin, "systematic": systematic})

    def _handle_structure(self, data):
        name = str(data.get("name") or "").strip()
        if not name:
            self._json(400, {"ok": False, "error": "缺少 name"})
            return
        try:
            _attach_jvm()
            with LOCK:
                smiles = name_to_structure(name)
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            self._json(500, {"ok": False, "error": "%s: %s" % (type(exc).__name__, exc)})
            return
        if not smiles:
            self._json(200, {"ok": False, "error": "这个名字解析不出结构"})
            return
        self._json(200, {"ok": True, "smiles": smiles, "name": name})


def _java_version():
    """返回 Java 版本字符串；没装就返回 None"""
    import shutil
    import subprocess
    exe = shutil.which("java")
    if not exe:
        return None
    try:
        out = subprocess.run([exe, "-version"], capture_output=True, text=True, timeout=20)
        text = (out.stderr or out.stdout or "").strip().splitlines()
        return text[0] if text else "已找到（版本未知）"
    except Exception as exc:  # noqa: BLE001
        return "找到但调不起来: %s" % exc


def _port_free(host, port):
    import socket
    # 服务实际是 bind 到 0.0.0.0，这里也必须按同样的地址试，否则测不出占用
    bind_host = "" if host in ("0.0.0.0", "") else host
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind((bind_host, port))
        return True, ""
    except OSError as exc:
        return False, str(exc)
    finally:
        s.close()


def check(args):
    """环境自检: 把能想到的坑都先查一遍"""
    print("=" * 58)
    print("名称转换服务 自检")
    print("=" * 58)
    ok = True

    print("Python      : %s" % sys.version.split()[0])
    print("解释器      : %s" % sys.executable)
    print("UTF-8 模式  : %s" % ("是" if sys.flags.utf8_mode else "否（已用 open 兜底）"))

    jv = _java_version()
    if jv:
        print("Java        : %s" % jv)
    else:
        print("Java        : 没找到  ← Orthonym / OPSIN 都要用 Java，请先安装 Java 17+")
        ok = False

    for mod in ("jpype", "rdkit", "orthonym", "py2opsin"):
        try:
            __import__(mod)
            print("%-12s: 已安装" % mod)
        except Exception as exc:  # noqa: BLE001
            print("%-12s: 导入失败  ← %s" % (mod, exc))
            ok = False

    free, why = _port_free(args.host, args.port)
    if free:
        print("端口 %-6d: 可用" % args.port)
    else:
        print("端口 %-6d: 被占用  ← %s（换一个: --port 8020）" % (args.port, why))
        ok = False

    if ok:
        print("实测一次结构命名 …")
        try:
            with LOCK:
                pin, sysname = structure_to_name("CCO")
            print("            CCO -> %s / %s" % (pin, sysname))
            if not pin:
                print("            ← 没给出名字，检查 Java 与 ~/.cache/orthonym/jars")
                ok = False
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            print("            ← 失败: %s" % exc)
            ok = False

    print("=" * 58)
    print("结论: %s" % ("全部正常，可以启动服务" if ok else "有问题，先按上面的提示处理"))
    print("=" * 58)
    return 0 if ok else 1


def main():
    parser = argparse.ArgumentParser(description="有机分子名称转换服务")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址，默认 0.0.0.0（局域网可访问）")
    parser.add_argument("--port", type=int, default=8017, help="监听端口，默认 8017")
    parser.add_argument("--no-warmup", action="store_true", help="启动时不预热（第一次请求会慢）")
    parser.add_argument("--check", action="store_true", help="只做环境自检，不启动服务")
    args = parser.parse_args()

    if args.check:
        sys.exit(check(args))

    print("Orthonym: %s   py2opsin: %s" % (
        "已安装" if _have("orthonym") else "缺少（pip install orthonym）",
        "已安装" if _have("py2opsin") else "缺少（pip install py2opsin）",
    ), flush=True)

    if not args.no_warmup:
        threading.Thread(target=warmup, daemon=True).start()

    try:
        httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError as exc:
        print("\n启动失败：端口 %d 用不了（%s）。换个端口试试: --port 8020" % (args.port, exc), flush=True)
        sys.exit(2)

    print("")
    print("=" * 58)
    print("  服务已启动，保持这个窗口开着")
    print("  网页端会自动连 http://127.0.0.1:%d" % args.port)
    print("  自测: 浏览器打开 http://127.0.0.1:%d/health" % args.port)
    print("  Ctrl+C 结束")
    print("=" * 58)
    print("", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止", flush=True)
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
