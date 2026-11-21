# 化学数据查询

## 初心

懒得查表, 所以顺手写个网页来查.

## 数据来源

- 热力学数据: W M Haynes. CRC Handbook of Chemistry and Physics. 97th ed. Boca Raton: CRC Press Inc, 2016-2017: 5-3~5-64.
- 解离常数: 砷酸数据: W M Haynes. CRC Handbook of Chemistry and Physics. 97th ed. Boca Raton: CRC Press Inc, 2016-2017: 5-87. 弱酸弱碱数据: James G Speight. Lange's Handbook of Chemistry. 16th ed. New York: McGraw-Hill Companies Inc, 2005: Table 1.74, Table 2.59, Table 1.71.
- 元素周期表:
  - 相对原子质量: IUPAC 相对原子质量表 (2018), 删节至五位有效数字.
  - 原子半径: Ga 原子: A F Holleman, E Wiberg. Inorganic Chemistry. San Francisco: Academic Press, 2001. 金属元素: James G Speight. Lange's Handbook of Chemistry. 16th ed. New York: McGraw-Hill Companies Ine, 2005: Table1.31. 非金属元素: James G Speight. Lange's Handbook of Chemistry. 16th ed. New York: McGraw-Hill Companies Ine, 2005: Table1.33.
  - 元素的第一电离能: J R Rumble. CRC Handbook of Chemistry and Physics. 101st ed. Boca Raton: CRC Press Inc, 2020-2021: 1-16. 原数据的单位为电子伏特, 此处乘以96.4853, 所得数据单位为 kJ/mol.
  - 元素的第一亲合能: J R Rumble. CRC Handbook of Chemistry and Physics. 101st ed. Boca Raton: CRC Press Inc, 2020-2021: 10-54~10-56. 原数据的单位为电子伏特, 此处乘以96.4853, 所得数据单位为 kJ/mol.
  - 元素的电负性: J R Rumble. CRC Handbook of Chemistry and Physics. 101st ed. Boca Raton: CRC Press Inc, 2020-2021: 19-105.

若有出入, 请以原文为准.

## 项目结构

- `index.html`: 入口页, 列出四张卡片
- `doc/`: 本说明页
- `elements/`: 元素周期表
  - `elements/format.js`: 元素数据的显示格式 (下划线、红色标注)
  - `elements/hydrogen/`, `elements/helium/` …: 每种元素一个详情页, 目录名是英文名的小写
- `thermodynamic_data/`: 热力学数据, 598 条
- `dissociation_constant/`: 酸碱难溶物解离常数, 302 条
- `script.js`: 搜索与表格渲染
- `site.css`, `style.css`: 样式
- `theme.js`: 白天 / 夜间模式
- `elements.json`, `thermodynamic_data.json`, `dissociation_constant.json`: 数据
- `README.md`: 本说明
- `LICENSE`: 许可证

## 许可证

本项目复制, 修改, 分发自[https://github.com/vinds476283/chemical_data_query](https://github.com/vinds476283/chemical_data_query). 代码采用 [MIT](https://opensource.org/license/mit) 协议.
