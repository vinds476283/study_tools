#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Wolfram|Alpha 代理服务（校园内网用）

为什么要有这个服务：
  - App ID 不能放在网页里，否则谁都能扒下来；
  - 每个 token 每天最多算 5 次，次数要记在服务器的 json 文件里；
  - 校园网访问不了 api.wolframalpha.com，需要一台能上网的机器做中转。

用法::

    python -X utf8 wa_server.py                  # 监听 0.0.0.0:8018
    python -X utf8 wa_server.py --port 8020
    python -X utf8 wa_server.py --check          # 只做本地自检
    python -X utf8 wa_server.py --check --online # 顺便真发一次请求试试

接口（JSON，带 CORS，网页端可以跨端口调用）::

    GET  /health                                -> {"ok": true, "appid": true, "tokens": 3, "limit": 5}
    POST /api/quota   {"token": "xxx"}          -> {"ok": true, "remaining": 4, "used": 1, "limit": 5}
    POST /api/query   {"token": "xxx", "input": "1+1"}
                                                -> {"ok": true, "result": "...", "remaining": 4, ...}

数据文件（默认放在 ./data/，可用 --data-dir 改到别处）::

    appid.txt     一行，Wolfram|Alpha 的 App ID
    tokens.json   允许使用的 token 名单
    usage.json    每个 token 每天的已用次数（服务自动维护）
"""

import argparse
import json
import os
import socket
import ssl
import sys
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_PORT = 8018
DAILY_LIMIT = 5
WA_URL = "https://api.wolframalpha.com/v2/query"
KEEP_DAYS = 30

LOCK = threading.Lock()
INFLIGHT = {}          # token -> 正在计算中的请求数（防并发超发）
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


# ------------------------------------------------------------------ 文件

def data_file(name):
    return os.path.join(DATA_DIR, name)


def read_appid():
    """appid.txt 里第一行不是注释的内容"""
    path = data_file("appid.txt")
    try:
        with open(path, encoding="utf-8-sig") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    return line
    except FileNotFoundError:
        return ""
    except Exception:
        traceback.print_exc()
    return ""


def load_tokens():
    """tokens.json -> [token, ...]

    支持两种写法::

        ["token1", "token2"]
        {"tokens": ["token1", {"token": "token2", "note": "张三"}]}
    """
    path = data_file("tokens.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8-sig") as f:
        raw = json.load(f)
    if isinstance(raw, dict):
        raw = raw.get("tokens") or []
    out = []
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
            elif isinstance(item, dict):
                token = item.get("token")
                if isinstance(token, str) and token.strip():
                    out.append(token.strip())
    return out


def load_usage():
    path = data_file("usage.json")
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8-sig") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        traceback.print_exc()
        return {}


def save_usage(usage):
    """写回 usage.json，顺手把 30 天以前的记录删掉"""
    cutoff = (date.today() - timedelta(days=KEEP_DAYS)).isoformat()
    compact = {day: counts for day, counts in usage.items() if day >= cutoff}
    path = data_file("usage.json")
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(compact, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)


def today():
    return date.today().isoformat()


def used_today(usage, token):
    return int((usage.get(today()) or {}).get(token, 0))


# ------------------------------------------------------------------ Wolfram|Alpha

# 这几个由命令行参数控制（见 main）
HTTP_NO_PROXY = False
HTTP_INSECURE = False
HTTP_CACERT = ""


def make_opener():
    """按配置造一个 opener：代理 / 证书校验都可以单独调"""
    handlers = []
    if HTTP_NO_PROXY:
        handlers.append(urllib.request.ProxyHandler({}))
    if HTTP_INSECURE:
        ctx = ssl._create_unverified_context()          # 只给明确加了 --insecure 的情况用
    elif HTTP_CACERT:
        ctx = ssl.create_default_context(cafile=HTTP_CACERT)
    else:
        ctx = ssl.create_default_context()
    handlers.append(urllib.request.HTTPSHandler(context=ctx))
    return urllib.request.build_opener(*handlers)


def ask_wolfram(appid, text, attempts=3):
    """调 Wolfram|Alpha 的 Full Results API，返回解析后的 JSON

    网络抖动 / 代理偶发证书错误时会重试几次；HTTP 4xx、5xx 不重试。
    """
    url = WA_URL + "?" + urllib.parse.urlencode({
        "appid": appid,
        "input": text,
        "output": "json",
        "format": "plaintext",
        "reinterpret": "true",
        "units": "metric",
    })
    req = urllib.request.Request(url, headers={"User-Agent": "vinds-wa-proxy/1.0"})
    opener = make_opener()

    last_exc = None
    for i in range(attempts):
        try:
            with opener.open(req, timeout=30) as resp:
                body = resp.read().decode("utf-8", "replace")
            return json.loads(body)
        except urllib.error.HTTPError:
            raise
        except Exception as exc:  # noqa: BLE001  SSL / 连接 / 超时
            last_exc = exc
            if i + 1 < attempts:
                time.sleep(0.8 * (i + 1))
    raise last_exc


def explain_network_error(reason):
    """把常见的网络错误翻译成人能看懂的提示"""
    text = str(reason)
    if "CERTIFICATE_VERIFY_FAILED" in text or "certificate verify failed" in text:
        return ("连不上 Wolfram|Alpha：证书校验失败。这台机器可能挂着本地代理（代理会换掉证书），"
                "可以加 --insecure 跳过校验，或用 --cacert 指定代理的根证书，也可以加 --no-proxy 走直连。")
    low = text.lower()
    if "timed out" in low or "timeout" in low:
        return "连不上 Wolfram|Alpha：连接超时。检查这台机器的网络能不能访问 api.wolframalpha.com。"
    return "连不上 Wolfram|Alpha（%s），检查服务器的网络。" % text


def format_result(payload):
    """把 pods 拼成一段能直接看的文本，返回 (ok, 文本)"""
    err = payload.get("error")
    if err:
        code = err.get("code")
        msg = err.get("msg") or ""
        if code == 401:
            return False, "服务端的 App ID 无效（401），请检查 server/data/appid.txt"
        return False, "Wolfram|Alpha 报错 %s: %s" % (code, msg)

    qr = payload.get("queryresult") or {}
    pods = qr.get("pods") or []

    if not qr.get("success") and not pods:
        return False, "Wolfram|Alpha 没有理解这个问题。"

    lines = []
    for pod in pods[:20]:
        title = (pod.get("title") or "").strip()
        texts = []
        for sub in pod.get("subpods") or []:
            text = (sub.get("plaintext") or "").strip()
            if text:
                texts.append(text)
        if not texts:
            continue
        body = "；".join(texts)
        lines.append("%s: %s" % (title, body) if title else body)

    if not lines:
        return False, "Wolfram|Alpha 没有理解这个问题。"

    merged = "\n".join(lines)
    if len(merged) > 20000:
        merged = merged[:20000] + "\n……（结果太长，后面省略）"
    return True, merged


# ------------------------------------------------------------------ 连通性测试

PING_URL = "https://test.vinds.top/test.txt"
PING_TIMEOUT = 30
PING_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
           "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 vinds-ping/1.0")


def ping_remote():
    """让服务器去取一次 test.txt，30 秒内拿到 1 就算通

    返回 (ok, 耗时 ms, 说明)
    """
    started = time.time()
    req = urllib.request.Request(PING_URL, headers={"User-Agent": PING_UA})
    try:
        with make_opener().open(req, timeout=PING_TIMEOUT) as resp:
            status = resp.status
            body = resp.read(64).decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        ms = int((time.time() - started) * 1000)
        return False, ms, "测试地址返回 HTTP %s" % exc.code
    except Exception as exc:  # noqa: BLE001
        ms = int((time.time() - started) * 1000)
        return False, ms, explain_network_error(exc)

    ms = int((time.time() - started) * 1000)
    if status != 200:
        return False, ms, "测试地址返回 HTTP %s" % status
    if body.strip() != "1":
        return False, ms, "测试地址返回的不是 1（是 %r）" % body.strip()[:20]
    return True, ms, "ok"


def probe_headers():
    """真发一次请求，把「发出去的头」和「回来的头」都记下来（给 /test 页用）"""
    started = time.time()
    req = urllib.request.Request(PING_URL, headers={"User-Agent": PING_UA})

    status = None
    resp_headers = []
    body = ""
    error = ""

    try:
        with make_opener().open(req, timeout=PING_TIMEOUT) as resp:
            status = resp.status
            resp_headers = list(resp.headers.items())
            body = resp.read(400).decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        status = exc.code
        resp_headers = list(exc.headers.items()) if exc.headers else []
        try:
            body = exc.read(400).decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            body = ""
        error = "测试地址返回 HTTP %s" % exc.code
    except Exception as exc:  # noqa: BLE001
        error = explain_network_error(exc)

    ms = int((time.time() - started) * 1000)

    try:
        sent = list(req.header_items())
    except Exception:  # noqa: BLE001
        sent = [("User-Agent", PING_UA)]

    # urllib 在真正发请求时才补这几条，这里补回去，好让页面显示的就是实际发出的头
    if not any(k.lower() == "accept-encoding" for k, _ in sent):
        sent.insert(0, ("Accept-Encoding", "identity"))
    if not any(k.lower() == "connection" for k, _ in sent):
        sent.append(("Connection", "close"))

    # urllib 在真正发请求时才补 Host，这里手动补上，方便看
    encoded = urllib.parse.urlsplit(PING_URL)
    host = encoded.netloc
    if not any(k.lower() == "host" for k, _ in sent):
        sent.insert(0, ("Host", host))

    return {
        "url": PING_URL,
        "sent": sent,
        "status": status,
        "resp_headers": resp_headers,
        "body": body,
        "error": error,
        "ms": ms,
        "ok": (status == 200 and body.strip() == "1"),
    }


def render_test_page(user_line, user_headers, probe):
    """把两边的请求头摆成一个页面"""
    import html as html_mod

    def esc(value):
        return html_mod.escape(str(value), quote=False)

    def header_block(lines):
        return "\n".join(esc(line) for line in lines)

    user_lines = [user_line] + ["%s: %s" % (k, v) for k, v in user_headers]
    sent_lines = ["GET %s HTTP/1.1" % urllib.parse.urlsplit(probe["url"]).path] + \
                 ["%s: %s" % (k, v) for k, v in probe["sent"]]

    resp_lines = []
    if probe["status"] is not None:
        resp_lines.append("HTTP %s" % probe["status"])
        resp_lines.extend("%s: %s" % (k, v) for k, v in probe["resp_headers"])
    else:
        resp_lines.append(probe["error"] or "没有拿到响应")
    if probe["body"]:
        resp_lines.append("")
        resp_lines.append("（响应体，最多 400 字）")
        resp_lines.append(probe["body"])

    verdict = ('<b class="ok">成功</b>' if probe["ok"] else '<b class="bad">失败</b>')
    detail = "HTTP %s" % probe["status"] if probe["status"] is not None else (probe["error"] or "")

    return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>请求诊断 | Wolfram|Alpha 代理</title>
<style>
	:root { color-scheme: light dark; }
	body { margin: 0; background: #fff; color: #000; line-height: 1.75;
		font-family: system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
	header { background: #08f; color: #fff; padding: 11px 16px; font-weight: 700; font-size: 15px; }
	main { max-width: 980px; margin: 0 auto; padding: 20px 18px 56px; }
	h1 { font-size: 22px; margin: 0 0 6px; }
	h2 { font-size: 16px; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #d9d9d9; }
	p { margin: 0 0 10px; }
	p.muted { color: #595959; font-size: 14px; }
	pre { margin: 0; padding: 10px 12px; background: #f5f5f5; border: 1px solid #d9d9d9;
		border-radius: 6px; overflow: auto; font-size: 13px; line-height: 1.6;
		font-family: ui-monospace, Consolas, "Courier New", monospace; white-space: pre-wrap; word-break: break-all; }
	.ok { color: #2a7; }
	.bad { color: #d33; }
	@media (prefers-color-scheme: dark) {
		body { background: #000; color: #fff; }
		pre { background: #141414; border-color: #333; }
		h2 { border-color: #333; }
		p.muted { color: #a3a3a3; }
	}
</style>
</head>
<body>
<header>Wolfram|Alpha 代理 · 请求诊断</header>
<main>
	<h1>请求诊断</h1>
	<p class="muted">若您不知道此页面是用来做什么的，或者不清楚自己要做什么，请退出此页面。同时绝对不要向任何人分享此页面的任何内容，以免泄露隐私信息。</p>
	<p>结果：%(verdict)s · 耗时 %(ms)dms  %(detail)s</p>

	<h2>① 你的请求（浏览器 → 本服务）</h2>
	<pre>%(user)s</pre>

	<h2>② 服务器的请求（本服务 → %(url)s）</h2>
	<pre>%(sent)s</pre>
	<p class="muted">Accept-Encoding 和 Connection 是 Python 的 HTTP 库自动补的，其余是服务里设的。</p>

	<h2>③ 对方的响应</h2>
	<pre>%(resp)s</pre>
</main>
</body>
</html>
""" % {
        "verdict": verdict,
        "ms": probe["ms"],
        "detail": esc(detail),
        "user": header_block(user_lines),
        "url": esc(probe["url"]),
        "sent": header_block(sent_lines),
        "resp": header_block(resp_lines),
    }


# ------------------------------------------------------------------ HTTP

class Handler(BaseHTTPRequestHandler):
    server_version = "WAServer/1.0"

    # -------------------------------------------------- 基础
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
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
            try:
                tokens = load_tokens()
            except Exception:
                tokens = []
            appid = read_appid()
            placeholder = appid.upper().startswith(("PUT-", "YOUR-"))
            self._json(200, {
                "ok": True,
                "service": "wolframalpha",
                "appid": bool(appid) and not placeholder,
                "appid_placeholder": placeholder,
                "tokens": len(tokens),
                "limit": DAILY_LIMIT,
                "python": sys.version.split()[0],
            })
            return
        if path == "/api/ping":
            self._handle_ping()
            return
        if path == "/test":
            self._handle_test()
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

        if path == "/api/quota":
            self._handle_quota(data)
        elif path == "/api/query":
            self._handle_query(data)
        elif path == "/api/ping":
            self._handle_ping()
        else:
            self._json(404, {"ok": False, "error": "未知路径"})

    # -------------------------------------------------- 业务
    def _handle_test(self):
        """/test —— 把「浏览器 → 本服务」和「本服务 → 测试地址」的请求头全列出来"""
        probe = probe_headers()
        qs = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        wants_json = (qs.get("format") or [""])[0] == "json"

        user_line = "%s %s %s" % (self.command, self.path, self.request_version)
        user_headers = list(self.headers.items())

        if wants_json:
            self._json(200, {
                "ok": probe["ok"],
                "ms": probe["ms"],
                "target": probe["url"],
                "you": {
                    "line": user_line,
                    "headers": [[k, v] for k, v in user_headers],
                },
                "server": {
                    "sent": [[k, v] for k, v in probe["sent"]],
                    "status": probe["status"],
                    "headers": [[k, v] for k, v in probe["resp_headers"]],
                    "body": probe["body"],
                    "error": probe["error"],
                },
            })
            return

        page = render_test_page(user_line, user_headers, probe).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(page)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(page)

    def _handle_ping(self):
        ok, ms, message = ping_remote()
        if ok:
            self._json(200, {"ok": True, "ms": ms, "value": "1", "target": PING_URL})
        else:
            self._json(200, {"ok": False, "ms": ms, "error": message, "target": PING_URL})

    def _check_token(self, data):
        token = str(data.get("token") or "").strip()
        if not token:
            return None, "请先填写 token"
        try:
            tokens = load_tokens()
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            return None, "服务端的 tokens.json 读不了: %s" % exc
        if token not in tokens:
            return None, "token 无效，请找老师确认"
        return token, None

    def _handle_quota(self, data):
        token, err = self._check_token(data)
        if err:
            self._json(200, {"ok": False, "error": err, "limit": DAILY_LIMIT})
            return

        with LOCK:
            usage = load_usage()
            used = used_today(usage, token)
            inflight = INFLIGHT.get(token, 0)

        remaining = max(0, DAILY_LIMIT - used - inflight)
        self._json(200, {
            "ok": True,
            "token": token,
            "used": used,
            "limit": DAILY_LIMIT,
            "remaining": remaining,
            "date": today(),
        })

    def _handle_query(self, data):
        token, err = self._check_token(data)
        if err:
            self._json(200, {"ok": False, "error": err, "limit": DAILY_LIMIT})
            return

        text = str(data.get("input") or "").strip()
        if not text:
            self._json(200, {"ok": False, "error": "请先填写要计算的内容", "limit": DAILY_LIMIT})
            return
        if len(text) > 500:
            text = text[:500]

        appid = read_appid()
        if not appid:
            self._json(503, {"ok": False, "error": "服务端还没有配置 App ID（server/data/appid.txt）"})
            return
        if appid.upper().startswith("PUT-") or appid.upper().startswith("YOUR-"):
            self._json(503, {"ok": False, "error": "服务端的 App ID 还是占位符，请把真的 App ID 写进 server/data/appid.txt"})
            return

        # 先占一个名额，再发请求；失败了再退回来
        with LOCK:
            usage = load_usage()
            used = used_today(usage, token)
            inflight = INFLIGHT.get(token, 0)
            if used + inflight >= DAILY_LIMIT:
                self._json(200, {
                    "ok": False,
                    "error": "这个 token 今天 %d 次已经用完了，明天再来" % DAILY_LIMIT,
                    "used": used,
                    "limit": DAILY_LIMIT,
                    "remaining": 0,
                    "date": today(),
                })
                return
            INFLIGHT[token] = inflight + 1

        started = time.time()
        try:
            payload = ask_wolfram(appid, text)
            ok, message = format_result(payload)
        except urllib.error.HTTPError as exc:
            ok, message = False, "连接 Wolfram|Alpha 失败（HTTP %s）" % exc.code
        except urllib.error.URLError as exc:
            ok, message = False, explain_network_error(exc.reason)
        except Exception as exc:  # noqa: BLE001
            text_err = str(exc)
            if "CERTIFICATE_VERIFY_FAILED" in text_err or "certificate verify failed" in text_err:
                ok, message = False, explain_network_error(exc)
            else:
                traceback.print_exc()
                ok, message = False, "调用 Wolfram|Alpha 出错: %s" % exc
        finally:
            elapsed_ms = int((time.time() - started) * 1000)

        with LOCK:
            INFLIGHT[token] = max(0, INFLIGHT.get(token, 1) - 1)
            usage = load_usage()
            if ok:
                day = usage.setdefault(today(), {})
                day[token] = int(day.get(token, 0)) + 1
                try:
                    save_usage(usage)
                except Exception:
                    traceback.print_exc()
            used = used_today(usage, token)
            inflight = INFLIGHT.get(token, 0)

        remaining = max(0, DAILY_LIMIT - used - inflight)

        if ok:
            self._json(200, {
                "ok": True,
                "result": message,
                "used": used,
                "limit": DAILY_LIMIT,
                "remaining": remaining,
                "ms": elapsed_ms,
                "date": today(),
            })
        else:
            # 没算出来的情况不扣次数
            self._json(200, {
                "ok": False,
                "error": message,
                "used": used,
                "limit": DAILY_LIMIT,
                "remaining": remaining,
                "ms": elapsed_ms,
                "date": today(),
            })


# ------------------------------------------------------------------ 自检 / 启动

def port_free(host, port):
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
    print("=" * 58)
    print("Wolfram|Alpha 代理服务 自检")
    print("=" * 58)
    ok = True

    print("Python      : %s" % sys.version.split()[0])
    print("数据目录    : %s" % DATA_DIR)

    if os.path.isdir(DATA_DIR):
        print("目录存在    : 是")
    else:
        print("目录存在    : 否（启动时会自动创建，或先跑一次 start-windows.bat）")
        os.makedirs(DATA_DIR, exist_ok=True)

    appid = read_appid()
    if not appid:
        print("appid.txt   : 没有或者为空  ← 先写好 App ID")
        ok = False
    elif appid.upper().startswith("PUT-") or appid.upper().startswith("YOUR-"):
        print("appid.txt   : 还是占位符 %r  ← 换成真的 App ID" % appid)
        ok = False
    else:
        print("appid.txt   : 已配置（%s…）" % appid[:4])

    try:
        tokens = load_tokens()
        print("tokens.json : %d 个 token" % len(tokens))
        if not tokens:
            print("              ← 一个 token 都没有，谁都算不了")
            ok = False
    except Exception as exc:  # noqa: BLE001
        print("tokens.json : 读不了 ← %s" % exc)
        ok = False

    try:
        usage = load_usage()
        print("usage.json  : %d 天记录" % len(usage))
    except Exception as exc:  # noqa: BLE001
        print("usage.json  : 读不了 ← %s" % exc)
        ok = False

    free, why = port_free(args.host, args.port)
    if free:
        print("端口 %-6d: 可用" % args.port)
    else:
        print("端口 %-6d: 被占用 ← %s（换一个: --port 8020）" % (args.port, why))
        ok = False

    if args.online and appid and not appid.upper().startswith(("PUT-", "YOUR-")):
        print("联网实测    : 正在问 1+1 …")
        try:
            payload = ask_wolfram(appid, "1+1")
            good, text = format_result(payload)
            print("              %s" % ("成功: " + text.replace("\n", " / ")[:120] if good else "失败: " + text))
            if not good:
                ok = False
        except Exception as exc:  # noqa: BLE001
            print("              异常: %s" % exc)
            ok = False
    elif args.online:
        print("联网实测    : 跳过（没有可用的 App ID）")

    print("=" * 58)
    print("结论: %s" % ("全部正常，可以启动服务" if ok else "有问题，先按上面的提示处理"))
    print("=" * 58)
    return 0 if ok else 1


def main():
    global DATA_DIR, DAILY_LIMIT, HTTP_NO_PROXY, HTTP_INSECURE, HTTP_CACERT

    parser = argparse.ArgumentParser(description="Wolfram|Alpha 代理服务")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址，默认 0.0.0.0（局域网可访问）")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="监听端口，默认 %d" % DEFAULT_PORT)
    parser.add_argument("--data-dir", default="", help="数据目录，默认是脚本旁边的 data/")
    parser.add_argument("--limit", type=int, default=DAILY_LIMIT, help="每个 token 每天的次数，默认 %d" % DAILY_LIMIT)
    parser.add_argument("--check", action="store_true", help="只做自检，不启动服务")
    parser.add_argument("--online", action="store_true", help="自检时顺便真发一次请求")
    parser.add_argument("--no-proxy", action="store_true", help="不走系统代理，直连 Wolfram|Alpha")
    parser.add_argument("--insecure", action="store_true", help="跳过 HTTPS 证书校验（代理换过证书时用）")
    parser.add_argument("--cacert", default="", help="用指定的 CA 证书文件校验（.pem）")
    args = parser.parse_args()

    HTTP_NO_PROXY = args.no_proxy
    HTTP_INSECURE = args.insecure
    HTTP_CACERT = args.cacert

    if args.data_dir:
        DATA_DIR = os.path.abspath(args.data_dir)
    if args.limit and args.limit > 0:
        DAILY_LIMIT = args.limit

    if args.check:
        sys.exit(check(args))

    os.makedirs(DATA_DIR, exist_ok=True)

    if not read_appid():
        print("提示: 还没有 App ID，先把 appid.txt 写好（现在启动，网页会提示未配置）", flush=True)

    try:
        httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError as exc:
        print("\n启动失败：端口 %d 用不了（%s）。换个端口试试: --port 8020" % (args.port, exc), flush=True)
        sys.exit(2)

    print("")
    print("=" * 58)
    print("  Wolfram|Alpha 代理服务已启动，保持这个窗口开着")
    print("  监听: http://%s:%d" % (args.host, args.port))
    print("  网页端默认连 http://<本机 IP>:%d" % args.port)
    print("  自测: 浏览器打开 http://127.0.0.1:%d/health" % args.port)
    print("  每个 token 每天 %d 次" % DAILY_LIMIT)
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
