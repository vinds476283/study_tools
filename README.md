# 说明

## 初心

碍于学校的网络只能访问有 ICP 备案的网站, 很多实用的小工具都没法用, 所以我就弄了下面几个小工具 (大多是以前的项目改改就放过来了其实), 希望能带来一些便利.

## 有哪些工具

### 数学

- **GeoGebra**: 完整的 GeoGebra 经典版 (Classic 5), 可以绘制函数图像和几何图形, 我觉得这个工具还是很重要的, 因为有些函数图像不画出来有些题目是完全看不懂, 借此可以绘制, 也方便纠正答案与思路.
- **Wolfram Alpha**: Wolfram|Alpha 是一个很强大的工具, 不仅数学, 物理化学也有大量涉猎, 但校园网不一定连得上它, 这个还需要一段时间的测试和想办法, 目前这个虽然理论上能用, 但不一定能用.

### 物理

- **单位换算**: 长度, 质量, 温度, 面积, 体积, 速度, 时间, 角度, 压强, 能量, 功率, 力, 频率, 数据存储, 数据速率, 电流, 电压, 电阻, 密度, 一共 19 类, 200 多个单位. 在任意一格输入数字, 同一类的其它单位会立刻跟着换算, 不用按回车.

### 化学

- **化学数据查询**: 化合物热力学数据, 酸碱与难溶物的解离常数查询. 未来会引入更多数据表.
- **有机分子结构式与名称**: 实现结构与名称互查, 生成三维模型. 这是考虑到现在的多模态大模型普遍对简单几何图形的空间关系和几何属性表现非常糟糕, 这是大模型难以解决的问题之一, 同时语言大模型不太能画图, 所以在指定原子的时候很难说清楚, 常常会用 IUPAC 命名法给原子标序号, 然后能通过这个知道这些是哪个序号, 所以与 AI 讨论有机化学的难度不亚于让草履虫骑自行车. 所以有这么一个东西, 希望能借此降低与 AI 交流的难度. 然后就顺手做了一个 3D 分子渲染的功能. 另外有一个 "碳原子标号" 按钮, 点一下会画一张带编号的结构图 (RDKit.js 的规范序, 不是 IUPAC 位次).
- **晶胞结构**: 左侧选化学式, 右侧画晶胞, 可拖动旋转, 缩放; 能按 a, b, c, `a*`, `b*`, `c*` 和任意 hkl 方向换视角, 可切换等轴 / 透视投影, 还能点两个原子量距离.

### 可视化代码

- **公式渲染**: 左边写 TeX, 右边实时渲染, 用的是 KaTeX; 装了 mhchem 扩展.
- **可视化公式编辑**: 字面意思.
- **手写公式识别**: 字面意思. 注意第一次用要下载约 7 MB 模型, 之后浏览器会缓存.
- **Markdown 渲染**: 字面意思.

## 使用

此项目大部分是静态网页, 能在前端做的计算都在客户端完成, 不联网也能用. 有两处需要 Python 服务在后台跑: 有机分子的 IUPAC 名称转换 (`organic_molecule/server/`) 和 Wolfram|Alpha 的代理 (`wolfram_alpha/server/`), 两个都是可选的, 服务不开的时候其它功能照常使用.

联网计算是因为纯前端的计算远远不够使用, 所以要调用更复杂的计算就需要通过服务器在后台运算. 不要滥用联网计算, 浪费服务器算力.

## 怎么跑起来

直接用浏览器打开 `index.html` 是不行的 (`file://` 下拿不到 JSON, 也不能加载 wasm), 需要一个 HTTP 服务器.

- **自己电脑上试**: 双击 `start-windows.bat`, 它会开两个最小化的窗口 (静态站点 8000 / Wolfram 代理 8018) 并自动打开浏览器. 那些窗口是服务本身, 用的时候别关; 关掉它们就是停服务.
- **部署到学校服务器**: 把整个目录当静态站点丢给 IIS / nginx / Apache 就行, 不需要 Python, 所有页面立刻可用.

只有两个功能需要额外起 Python 服务, 不开的话其它功能照常用:

| 功能               | 需要的服务                                                     | 位置                |
| ------------------ | -------------------------------------------------------------- | ------------------- |
| Wolfram Alpha 计算 | `wolfram_alpha/server/wa_server.py` (还要配 App ID 和 token) | 见该目录下的 README |
| 有机分子名称互查   | `organic_molecule/server/iupac_server.py` (还要 Java)        | 见该目录下的 README |

## 目录结构

```
study_tools/
├── index.html            首页 (前言 / 数学 / 物理 / 化学 / 可视化代码)
├── style.css             全站样式
├── theme.js              白天 / 夜间模式
├── favicon.ico
├── LICENSE               MIT 许可证 (geogebra/ 除外)
├── .gitignore            不提交的文件 (Wolfram 的 App ID / token 等)
├── start-windows.bat     一键启动 (静态服务 + Wolfram 代理), 双击就行
├── README.md             本说明 (preface/ 页面读取它)
├── preface/              说明页
├── geogebra/             GeoGebra 经典版
├── chemical_data_query/  化学数据查询
├── unit_cell/            晶胞结构
│   └── files/            晶胞文件 (.vesta)
├── organic_molecule/     有机分子结构式与名称
│   ├── data.js           本地分子名录
│   ├── vendor/           JSME, OpenChemLib, 3Dmol.js
│   └── server/           可选的 IUPAC 转换服务 (Python)
├── unit_conversion/      单位换算
├── visual_code/          可视化代码
│   ├── formula/          公式渲染 (KaTeX + mhchem)
│   ├── editor/           可视化公式编辑 (MathLive)
│   ├── handwriting/      手写公式识别 (ink-on + ONNX Runtime)
│   ├── markdown/         Markdown 渲染 (marked)
│   └── vendor/           几个前端库
└── wolfram_alpha/        Wolfram Alpha
    ├── index.html        页面 (token + 计算)
    └── server/           代理服务 (Python), data/ 里放 App ID 和 token, 已被 gitignore
```

## 其他

下列所有内容都是由生成式人工智能完成的, 但已经经过人工审核: 

- 所有样式, 除了第三方开源组件自带的样式,, 经过人工查验和修改;
- 所有`.bat`文件, 经过人工查验, 没有修改;
- 本文档的"怎么跑起来"标题, 经过人工查验, 没有修改;
- 除了本文档之外的其余所有`README.md`, 经过人工查验, 没有修改. 

## 版权与许可

本项目采用双许可结构:

- **GeoGebra 部分** (`geogebra/` 目录): 归 GeoGebra GmbH 所有, 按 GeoGebra 自己的许可分发, 仅限非商业使用且须署名, 详见 https://www.geogebra.org/license . 这部分**不适用** MIT 许可.
- **其余全部内容** (页面, 样式, 脚本, 数据, 文档, 以及 `preface/`, `unit_cell/`, `unit_conversion/`, `visual_code/`, `organic_molecule/`, `chemical_data_query/` 等目录): 采用 MIT 许可证, 全文见仓库根目录的 `LICENSE` 文件.

第三方组件各自保留原有许可, 详见下表; 许可证原文随对应目录一起提供.

### 使用的开源组件

#### 直接使用 (随站点分发)

| 组件                                  | 链接                                                                                         | 版权                                                     | 许可证                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| GeoGebra Classic 5                    | 官网许可 https://www.geogebra.org/license<br />源码 https://github.com/geogebra/geogebra     | © GeoGebra GmbH                                         | GeoGebra 非商业许可 (仅限非商业, 须署名) |
| JSME                                  | https://github.com/jsme-editor/jsme-editor.github.io<br />官网 https://jsme-editor.github.io | © Peter Ertl, Bruno Bienfait                            | BSD-3-Clause                             |
| OpenChemLib (JS 版)                   | https://github.com/cheminfo/openchemlib-js                                                   | © 2015-2017 cheminfo                                    | BSD-3-Clause                             |
| OpenChemLib (Java 原版)               | https://github.com/actelion/openchemlib                                                      | © Actelion Pharmaceuticals Ltd. 及贡献者                | BSD-3-Clause                             |
| 3Dmol.js                              | https://github.com/3dmol/3Dmol.js                                                            | © David Koes 及贡献者                                   | BSD-3-Clause                             |
| GLmol<br />(3Dmol.js 内含改编代码)    | https://github.com/biochem-fan/GLmol                                                         | © biochem_fan                                           | MIT                                      |
| Three.js<br />(3Dmol.js 内含改编代码) | https://github.com/mrdoob/three.js                                                           | © 2010-至今 three.js authors (Ricardo Cabello 及贡献者) | MIT                                      |
| jQuery<br />(3Dmol.js 内含改编代码)   | https://github.com/jquery/jquery                                                             | © OpenJS Foundation and other contributors              | MIT                                      |
| Orthonym                              | https://github.com/Steinbeck-Lab/Orthonym                                                    | © Steinbeck Lab                                         | MIT                                      |
| OPSIN                                 | https://github.com/dan2097/opsin                                                             | © Daniel Lowe                                           | MIT                                      |
| py2opsin                              | https://github.com/JacksonBurns/py2opsin                                                     | © Jackson Burns                                         | MIT                                      |
| chemical_data_query                   | https://github.com/vinds476283/chemical_data_query                                           | © vinds476283                                           | MIT                                      |
| KaTeX                                 | https://github.com/KaTeX/KaTeX                                                               | © Khan Academy 及贡献者                                 | MIT                                      |
| mhchem<br />(KaTeX 自带扩展)          | https://github.com/KaTeX/KaTeX                                                               | © Martin Hensel 及贡献者                                | MIT                                      |
| MathLive                              | https://github.com/arnog/mathlive                                                            | © Arno Gourdol 及贡献者                                 | MIT                                      |
| marked                                | https://github.com/markedjs/marked                                                           | © Christopher Jeffrey 及贡献者                          | MIT                                      |
| ink-on                                | https://github.com/kimseungdae/ink-on                                                        | © Seungdae Kim                                          | Apache-2.0                               |
| ONNX Runtime Web                      | https://github.com/microsoft/onnxruntime                                                     | © Microsoft Corporation                                 | MIT                                      |

#### 间接依赖

| 组件          | 链接                                    | 版权                                                                  | 许可证         |
| ------------- | --------------------------------------- | --------------------------------------------------------------------- | -------------- |
| RDKit         | https://github.com/rdkit/rdkit          | © Rational Discovery LLC, Greg Landrum 及贡献者                      | BSD-3-Clause   |
| JPype1        | https://github.com/jpype-project/jpype  | © Steve Menard 及贡献者                                              | Apache-2.0     |
| lxml          | https://github.com/lxml/lxml            | © lxml 作者 (Stefan Behnel 等)                                       | BSD-3-Clause   |
| NumPy         | https://github.com/numpy/numpy          | © NumPy Developers                                                   | BSD-3-Clause   |
| Pillow        | https://github.com/python-pillow/Pillow | © Secret Labs AB / Fredrik Lundh (PIL); © Jeffrey A. Clark 及贡献者 | HPND (MIT-CMU) |
| Python 运行时 | https://github.com/python/cpython       | © Python Software Foundation                                         | PSF-2.0        |

> 间接依赖只是 `pip install -r requirements.txt` 装进虚拟环境, 不随仓库或站点分发.
