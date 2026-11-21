# 名称转换服务（IUPAC）

网页上的「联网转换」和「联网查IUPAC名」两个按钮会请求这个服务。
它跑在局域网里，不连外网也能用（第一次装依赖和下载OPSIN的jar时需要一次网络）。

「联网转换」是**双向**的：

- 输入框里写了名字 → 名称转结构（OPSIN）
- 输入框空着、画布上有结构 → 结构转名称（Orthonym）

信息面板下面另有「联网查IUPAC名」（只做结构→名称）和「复制信息」（把名称信息复制到剪贴板）。

| 方向 | 用到的开源项目 | 许可证 |
| --- | --- | --- |
| 结构 → IUPAC名 | [Orthonym](https://github.com/Steinbeck-Lab/Orthonym) 1.1.0 | MIT |
| IUPAC名 → 结构 | [OPSIN](https://github.com/dan2097/opsin) 2.9.0（via [py2opsin](https://github.com/JacksonBurns/py2opsin)） | MIT |

两个库都通过Java运行（Orthonym用JPype挂OPSIN做回读校验），所以机器上要有 **Java 17+**。

## 一、装

需要Python 3.10+ 和Java 17+。

**Windows**：双击 `start-windows.bat`。它会按顺序做：

1. 检查Python / Java；
2. 第一次运行时装依赖（约60 MB，几分钟，装在 `%LOCALAPPDATA%\vinds-iupac\venv`，
   **不会**塞进网站目录）；
3. 跑一遍环境自检（`--check`），把Python / Java / 各依赖 / 端口占用都列出来；
4. 自检通过才启动服务，窗口里会打印 `自测: 浏览器打开http://127.0.0.1:8017/health`。

出问题先双击 `check-windows.bat`，它只做自检、不启动服务，把输出发我就能定位。

**Linux / macOS**：

```bash
chmod +x start-linux.sh
./start-linux.sh
```

依赖装在 `~/.local/share/vinds-iupac/venv`。

也可以手动来：

```bash
python3 -m venv ~/.local/share/vinds-iupac/venv
~/.local/share/vinds-iupac/venv/bin/pip install -r requirements.txt
~/.local/share/vinds-iupac/venv/bin/python -X utf8 iupac_server.py --check
~/.local/share/vinds-iupac/venv/bin/python -X utf8 iupac_server.py
```

> `-X utf8` 别省：Windows中文系统默认GBK，Orthonym读自带数据文件会报 `UnicodeDecodeError`。
> 服务里对 `open()` 做了兜底，手动跑不加也能启动，但启动脚本一律带上。

## 二、跑

```bash
python -X utf8 iupac_server.py                    # 默认0.0.0.0:8017
python -X utf8 iupac_server.py --check            # 只自检，不启动
python -X utf8 iupac_server.py --port 8020        # 换端口
python -X utf8 iupac_server.py --host 127.0.0.1   # 只给本机用
python -X utf8 iupac_server.py --no-warmup        # 启动时不预热
```

启动后先自检：

```bash
curl http://127.0.0.1:8017/health
curl -X POST http://127.0.0.1:8017/api/name -H "Content-Type: application/json" -d "{\"smiles\":\"CCO\"}"
curl -X POST http://127.0.0.1:8017/api/structure -H "Content-Type: application/json" -d "{\"name\":\"ethanoic acid\"}"
```

正常会返回：

```json
{"ok": true, "pin": "ethanol", "systematic": "ethan-1-ol"}
{"ok": true, "smiles": "CCO", "name": "ethanoic acid"}
```

`--check` 的正常输出长这样：

```
==========================================================
名称转换服务 自检
==========================================================
Python      : 3.14.7
解释器      : C:\Users\xxx\AppData\Local\vinds-iupac\venv\Scripts\python.exe
UTF-8模式  : 是
Java        : openjdk version "25.0.3" ...
jpype       : 已安装
rdkit       : 已安装
orthonym    : 已安装
py2opsin    : 已安装
端口8017  : 可用
实测一次结构命名 …
            CCO -> ethanol / ethan-1-ol
==========================================================
结论: 全部正常，可以启动服务
==========================================================
```

## 三、网页这边怎么对接

网页默认请求 `http://<当前访问的主机名>:8017`，所以只要服务开在放网站的那台机器上、端口不改，**什么都不用配**。

要改地址有三种办法（优先级从高到低）：

1. 地址栏加参数：`.../organic_molecule/?api=http://192.168.1.10:8020`
2. 浏览器控制台设一次：`localStorage.setItem('iupac_api', 'http://192.168.1.10:8020')`
3. 改 `app.js` 里的 `API_PORT` / `apiBase()`

服务端已经开了 `Access-Control-Allow-Origin: *`，网页跨端口调用不会被拦。

## 四、扩展本地名录

`../data.js` 每条是 `[中文名, 英文名, SMILES, 别名, IUPAC名]`。
想加新分子，把前三项填好（IUPAC名留空），然后：

```bash
.venv/bin/python -X utf8 refresh_iupac.py        # Windows: .venv\Scripts\python.exe
```

它会用Orthonym把第5个字段补齐（离线、批量，几秒钟一条）。
页面上会优先显示这个IUPAC名；没有的再走「联网查IUPAC名」。

## 五、常见问题

- **第一次转很久**：JVM和OPSIN的jar要加载，启动日志里 `[warmup]` 两行出现后就快了。
- **提示"连不上"**：先在浏览器地址栏打开 `http://127.0.0.1:8017/health`：
  - 打不开 → 服务没启动（看启动窗口有没有报错），或者8017被占用（`--port 8020` 换一个）。
  - 能打开 → 网页被跨域拦了，点信息面板下面那行「转换服务：…（点这里改）」把地址改对。
- **只有本机能用、别人连不上**：服务默认监听 `0.0.0.0`；如果启动时写了 `--host 127.0.0.1`，
  就只有本机能访问，局域网其他机器会提示"服务只监听了本机"。
- **`UnicodeDecodeError`**：没加 `-X utf8`（服务里已做兜底，正常不会再遇到）。
- **`JVM not found` / `jpype` 报错**：没装Java，或 `JAVA_HOME` 不对。
- **名字解析不出来**：OPSIN只认系统命名（`ethanoic acid`、`2-methylpropane`），
  `醋酸`、`acetic acid` 这类俗名它也能认一部分，但中文名不认。
- **复制按钮没反应**：内网 `http://192.168.x.x` 不是安全上下文，`navigator.clipboard` 不可用，
  页面已改用 `execCommand` 兜底；如果浏览器策略仍然禁止，手动选中文字复制即可。
- 内存占用：JVM常驻大约200–400 MB，学校机器够用。
