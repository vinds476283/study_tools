# -*- coding: utf-8 -*-
"""用假的 Wolfram|Alpha 返回值测试配额逻辑，不联网。"""
import json
import os
import shutil
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.join(HERE, '..', '..', 'study_tools', 'wolfram_alpha', 'server')
sys.path.insert(0, os.path.abspath(SERVER_DIR))

import wa_server  # noqa: E402

TMP = tempfile.mkdtemp(prefix='wa-test-')
wa_server.DATA_DIR = TMP
wa_server.DAILY_LIMIT = 5

with open(os.path.join(TMP, 'appid.txt'), 'w', encoding='utf-8') as f:
    f.write('# comment\nTEST-APPID-123\n')
with open(os.path.join(TMP, 'tokens.json'), 'w', encoding='utf-8') as f:
    json.dump({'tokens': [{'token': 'demo-token-abc', 'note': '测试'}, 'other']}, f)

CALLS = {'n': 0}


def fake_ask(appid, text):
    CALLS['n'] += 1
    return {'queryresult': {'success': True, 'pods': [
        {'title': 'Input', 'subpods': [{'plaintext': text}]},
        {'title': 'Result', 'subpods': [{'plaintext': '42'}]},
    ]}}


wa_server.ask_wolfram = fake_ask

httpd = wa_server.ThreadingHTTPServer(('127.0.0.1', 0), wa_server.Handler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()
time.sleep(0.3)

BASE = 'http://127.0.0.1:%d' % port


def call(path, payload=None):
    if payload is None:
        req = urllib.request.Request(BASE + path)
    else:
        body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(BASE + path, data=body,
                                     headers={'Content-Type': 'text/plain;charset=UTF-8'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        # 503 之类也带 JSON，读出来看看
        return json.loads(exc.read().decode('utf-8'))


ok = True


def check(name, cond, extra=''):
    global ok
    print(('  OK   ' if cond else '  FAIL ') + name + (('  ' + extra) if extra and not cond else ''))
    if not cond:
        ok = False


print('== health ==')
h = call('/health')
print('   ', h)
check('appid 已配置', h['appid'] is True)
check('token 数量 = 2', h['tokens'] == 2)

print('== 无效 token ==')
r = call('/api/quota', {'token': 'nope'})
check('返回 ok=false', r['ok'] is False, r)

print('== 空 token ==')
r = call('/api/quota', {'token': ''})
check('提示要填 token', r['ok'] is False and 'token' in r['error'], r)

print('== 初始配额 ==')
r = call('/api/quota', {'token': 'demo-token-abc'})
print('   ', r)
check('剩余 5', r['remaining'] == 5)

print('== 连续计算 5 次 ==')
for i in range(5):
    q = call('/api/query', {'token': 'demo-token-abc', 'input': '1+1'})
    check('第 %d 次 ok' % (i + 1), q['ok'] is True, q)
    check('剩余 %d' % (4 - i), q['remaining'] == 4 - i, q)
    check('结果里有 42', '42' in (q.get('result') or ''))

print('== 第 6 次应该被挡 ==')
r = call('/api/query', {'token': 'demo-token-abc', 'input': '1+1'})
print('   ', r)
check('ok=false', r['ok'] is False)
check('提示用完', '用完' in (r.get('error') or ''), r)
check('剩余 0', r['remaining'] == 0)

print('== 另一个 token 不受影响 ==')
r = call('/api/quota', {'token': 'other'})
check('other 还剩 5', r['remaining'] == 5, r)

print('== 空输入不扣次数 ==')
r = call('/api/query', {'token': 'other', 'input': '   '})
check('ok=false', r['ok'] is False, r)
r = call('/api/quota', {'token': 'other'})
check('other 还是 5', r['remaining'] == 5, r)

print('== usage.json 内容 ==')
with open(os.path.join(TMP, 'usage.json'), encoding='utf-8') as f:
    usage = json.load(f)
print('   ', usage)
today = wa_server.today()
check('今天的记录 = 5', usage.get(today, {}).get('demo-token-abc') == 5, usage)

print('== 计算失败不扣次数 ==')


def fail_ask(appid, text):
    return {'queryresult': {'success': False, 'pods': []}}


wa_server.ask_wolfram = fail_ask
r = call('/api/query', {'token': 'other', 'input': '???'})
check('ok=false', r['ok'] is False, r)
check('other 仍然 5', r['remaining'] == 5, r)

print('== App ID 占位符 ==')
with open(os.path.join(TMP, 'appid.txt'), 'w', encoding='utf-8') as f:
    f.write('PUT-YOUR-APPID-HERE\n')
r = call('/api/query', {'token': 'other', 'input': '1+1'})
check('提示占位符', r['ok'] is False and '占位符' in (r.get('error') or ''), r)

httpd.shutdown()
shutil.rmtree(TMP, ignore_errors=True)

print()
print('结论:', '全部通过' if ok else '有失败项')
sys.exit(0 if ok else 1)
