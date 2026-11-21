#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Wolfram|Alpha 代理服务 —— 使用说明

这个服务做三件事:

1. 保管 App ID（不放进网页，学生扒不到）
2. 校验 token，并记录每个 token 每天算了几次（最多 5 次）
3. 替学生去调 api.wolframalpha.com，把结果带回来

## 目录

    server/
    ├── wa_server.py        服务本体，只依赖 Python 标准库
    ├── data/               私密数据（已写进 .gitignore）
    │   ├── appid.txt       第一行写 App ID
    │   ├── tokens.json     允许使用的 token 名单
    │   └── usage.json      自动生成，记录每天的次数
    ├── start-windows.bat   双击启动
    └── check-windows.bat   双击自检

## 三个文件怎么写

`data/appid.txt`：一行，就是 App ID，例如

    ABCD-1234567890

`data/tokens.json`：两种写法都行

```json
["token1", "token2"]
```

```json
{
  "tokens": [
    { "token": "token1", "note": "张三" },
    { "token": "token2", "note": "李四" }
  ]
}
```

`data/usage.json`：不用手写，服务自己维护，长这样

```json
{
  "2026-11-22": { "demo-token-abc": 3 }
}
```

## 启动

双击 `start-windows.bat`（等价于 `python -X utf8 wa_server.py`），保持窗口开着。

浏览器打开 <http://127.0.0.1:8018/health>，看到

```json
{"ok": true, "appid": true, "tokens": 1, "limit": 5, ...}
```

就说明服务起来了。`appid` 是 `false` 说明 `appid.txt` 还没填。

网页端默认连 `http://<当前网页的主机名>:8018`，也可以在网址后面加 `?api=http://192.168.1.10:8018` 临时指定。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 自检：App ID 是否配置、token 数量 |
| GET/POST | `/api/ping` | 连通性测试：服务器去取 <https://test.vinds.top/test.txt>，30 秒内拿到 `1` 就算通 |
| GET | `/test` | 请求诊断页：把「浏览器 → 本服务」和「本服务 → 测试地址」两边的请求头全列出来，加 `?format=json` 出 JSON |
| POST | `/api/quota` | 查某个 token 今天还剩几次 |
| POST | `/api/query` | 真正算一次 |

请求体都是 JSON 文本（`Content-Type: text/plain` 也行，免预检）：

```json
{"token": "demo-token-abc", "input": "integrate x^2 dx"}
```

返回：

```json
{"ok": true, "result": "Integral: x^3/3\n...", "used": 1, "limit": 5, "remaining": 4, "ms": 1200}
```

## 规则

- 每个 token 每天最多 5 次（`--limit` 可以改）
- **只有真正算出来才扣次数**：Wolfram|Alpha 没看懂、网络出错、App ID 无效都不扣
- 深夜过 0 点自动重新计数（按服务器本地日期）
- `usage.json` 只保留最近 30 天
- 网页上的「计算」按钮要同时满足三条才可点：**连通性测试通过 + token 有效 + 有输入**

## 连通性测试

网页上 token 上面有个「连通性测试」按钮，点一下就是让**服务器**去取
<https://test.vinds.top/test.txt>：

- 30 秒内拿到内容 `1` → 显示「测试成功，耗时：235ms。」
- 超时、连不上、返回的不是 `1` → 显示失败原因

测试通过后按钮会锁住，刷新页面才能再测。**测试失败时红字本身就是链接**，点开是
<http://127.0.0.1:8018/test>：那一页会重新发一次请求，把两边的请求头全摊开

- ① 你的请求（浏览器 → 本服务）
- ② 服务器的请求（本服务 → test.vinds.top）
- ③ 对方的响应（状态码 + 响应头 + 响应体前 400 字）

想看 JSON 版就在后面加 `?format=json`：

```
curl "http://127.0.0.1:8018/test?format=json"
```

这个测试走的是和 Wolfram|Alpha 一样的网络路径（同样的代理 / 证书设置），
所以它通，基本就说明服务器能出网。注意它**不消耗**任何 token 次数。

```
curl http://127.0.0.1:8018/api/ping
{"ok": true, "ms": 412, "value": "1", "target": "https://test.vinds.top/test.txt"}
```

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 网页提示连不上服务 | 服务没启动，或者端口不是 8018；Windows 防火墙第一次会问，选「允许」 |
| 浏览器直接开 `/health` 显示「拒绝连接」 | 服务没在跑（控制台窗口被关了，或者启动就报错了）。重新双击 `start-windows.bat`，看窗口里有没有报错 |
| `/health` 里 `appid` 是 false | `data/appid.txt` 没写或还是占位符 |
| 网页提示 token 无效 | 检查 `data/tokens.json` 里有没有这个 token（区分大小写） |
| 提示 App ID 无效（401） | App ID 写错了，或者这个 App ID 被 Wolfram 停了 |
| 提示连不上 Wolfram|Alpha | 跑服务的这台机器本身要能上外网（校园网直连是不行的，得挂代理或放到能上网的机器上） |
| 想换端口 | `python -X utf8 wa_server.py --port 8020`，网页端用 `?api=` 指过去 |

## 网络 / 代理

服务要连 `api.wolframalpha.com`。默认会用系统代理（和浏览器用的是同一个设置）。

| 情况 | 加什么 |
| --- | --- |
| 这台机器挂着本地代理，证书被代理换掉了（报 `CERTIFICATE_VERIFY_FAILED`） | `--insecure`，或者 `--cacert 代理根证书.pem` |
| 直连能通，但系统代理反而不通 | `--no-proxy` |
| 什么都连不上 | 先在这台机器上用浏览器打开 <https://api.wolframalpha.com/> 看看能不能通 |

```
python -X utf8 wa_server.py --insecure
python -X utf8 wa_server.py --no-proxy
python -X utf8 wa_server.py --cacert "C:\certs\proxy-ca.pem"
```

网络抖动时服务会自己重试 3 次（每次间隔递增），还失败才会报错。

## 不花次数地测一遍

```
python -X utf8 test_quota.py
```

这个脚本用假的 Wolfram|Alpha 返回值跑一遍配额逻辑（token 校验、每天 5 次、第 6 次被挡、算不出来不扣次数、usage.json 落盘），完全本地、不联网、不消耗 API 额度。

## 安全提醒

`data/` 目录千万别被静态服务器公开出去，否则 App ID 就泄露了。这个目录里放了：

- `server/.htaccess`（Apache：整目录拒绝访问）
- `server/web.config`（IIS：整目录拒绝访问）

nginx 请在站点配置里加：

```nginx
location ^~ /study_tools/wolfram_alpha/server/ {
    deny all;
    return 404;
}
```

如果嫌麻烦，也可以把数据目录挪到网站根目录外面：

```powershell
python -X utf8 wa_server.py --data-dir "D:\vinds-data\wa"
```
