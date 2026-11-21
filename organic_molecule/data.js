/* ==========================================================================
   有机分子常用名录
   字段: [中文名, 英文名, SMILES, 别名(用 | 分隔), IUPAC名]
   用途: 绘制结构后按结构反查名称; 输入名称后取出结构
   说明: 中文名/英文名用教学里最常见的叫法, 最后一个字段是系统IUPAC名
         （由Orthonym + OPSIN离线生成, 见server/README.md）
   ========================================================================== */
window.MOLECULES = [
	// ---- 烷烃 ----
	['甲烷', 'methane', 'C', '沼气', 'methane'],
	['乙烷', 'ethane', 'CC', '', 'ethane'],
	['丙烷', 'propane', 'CCC', '', 'propane'],
	['丁烷', 'butane', 'CCCC', '正丁烷', 'butane'],
	['异丁烷', '2-methylpropane', 'CC(C)C', '2-甲基丙烷', '2-methylpropane'],
	['戊烷', 'pentane', 'CCCCC', '正戊烷', 'pentane'],
	['异戊烷', '2-methylbutane', 'CCC(C)C', '2-甲基丁烷', '2-methylbutane'],
	['新戊烷', '2,2-dimethylpropane', 'CC(C)(C)C', '2,2-二甲基丙烷', '2,2-dimethylpropane'],
	['己烷', 'hexane', 'CCCCCC', '正己烷', 'hexane'],
	['庚烷', 'heptane', 'CCCCCCC', '正庚烷', 'heptane'],
	['辛烷', 'octane', 'CCCCCCCC', '正辛烷', 'octane'],
	['环丙烷', 'cyclopropane', 'C1CC1', '', 'cyclopropane'],
	['环丁烷', 'cyclobutane', 'C1CCC1', '', 'cyclobutane'],
	['环戊烷', 'cyclopentane', 'C1CCCC1', '', 'cyclopentane'],
	['环己烷', 'cyclohexane', 'C1CCCCC1', '', 'cyclohexane'],
	['甲基环己烷', 'methylcyclohexane', 'CC1CCCCC1', '', 'methylcyclohexane'],

	// ---- 烯烃 / 炔烃 ----
	['乙烯', 'ethene', 'C=C', '', 'ethene'],
	['丙烯', 'propene', 'CC=C', '', 'propene'],
	['1-丁烯', 'but-1-ene', 'C=CCC', '', 'but-1-ene'],
	['2-丁烯', 'but-2-ene', 'CC=CC', '', 'but-2-ene'],
	['异丁烯', '2-methylpropene', 'CC(=C)C', '2-甲基丙烯', '2-methylprop-1-ene'],
	['1,3-丁二烯', 'buta-1,3-diene', 'C=CC=C', '', 'buta-1,3-diene'],
	['异戊二烯', '2-methylbuta-1,3-diene', 'CC(=C)C=C', '2-甲基-1,3-丁二烯', '2-methylbuta-1,3-diene'],
	['环己烯', 'cyclohexene', 'C1=CCCCC1', '', 'cyclohexene'],
	['苯乙烯', 'styrene', 'C=Cc1ccccc1', '乙烯基苯', 'ethenylbenzene'],
	['乙炔', 'ethyne', 'C#C', '电石气', 'ethyne'],
	['丙炔', 'propyne', 'CC#C', '', 'propyne'],
	['1-丁炔', 'but-1-yne', 'CCC#C', '', 'but-1-yne'],

	// ---- 芳香烃 ----
	['苯', 'benzene', 'c1ccccc1', '', 'benzene'],
	['甲苯', 'toluene', 'Cc1ccccc1', '甲基苯', 'methylbenzene'],
	['乙苯', 'ethylbenzene', 'CCc1ccccc1', '', 'ethylbenzene'],
	['邻二甲苯', '1,2-dimethylbenzene', 'Cc1ccccc1C', '1,2-二甲苯', '1,2-dimethylbenzene'],
	['间二甲苯', '1,3-dimethylbenzene', 'Cc1cccc(C)c1', '1,3-二甲苯', '1,3-dimethylbenzene'],
	['对二甲苯', '1,4-dimethylbenzene', 'Cc1ccc(C)cc1', '1,4-二甲苯', '1,4-dimethylbenzene'],
	['萘', 'naphthalene', 'c1ccc2ccccc2c1', '', 'naphthalene'],
	['蒽', 'anthracene', 'c1ccc2cc3ccccc3cc2c1', '', 'anthracene'],

	// ---- 卤代烃 ----
	['氯甲烷', 'chloromethane', 'CCl', '一氯甲烷', 'chloromethane'],
	['二氯甲烷', 'dichloromethane', 'ClCCl', '', 'dichloromethane'],
	['三氯甲烷', 'trichloromethane', 'ClC(Cl)Cl', '氯仿', 'trichloromethane'],
	['四氯化碳', 'tetrachloromethane', 'ClC(Cl)(Cl)Cl', '', 'tetrachloromethane'],
	['氯乙烷', 'chloroethane', 'CCCl', '乙基氯', 'chloroethane'],
	['1,2-二氯乙烷', '1,2-dichloroethane', 'ClCCCl', '', '1,2-dichloroethane'],
	['溴乙烷', 'bromoethane', 'CCBr', '乙基溴', 'bromoethane'],
	['氯苯', 'chlorobenzene', 'Clc1ccccc1', '', 'chlorobenzene'],
	['溴苯', 'bromobenzene', 'Brc1ccccc1', '', 'bromobenzene'],

	// ---- 醇 / 酚 / 醚 ----
	['甲醇', 'methanol', 'CO', '木醇', 'methanol'],
	['乙醇', 'ethanol', 'CCO', '酒精', 'ethan-1-ol'],
	['丙-1-醇', 'propan-1-ol', 'CCCO', '正丙醇', 'propan-1-ol'],
	['丙-2-醇', 'propan-2-ol', 'CC(C)O', '异丙醇', 'propan-2-ol'],
	['丁-1-醇', 'butan-1-ol', 'CCCCO', '正丁醇', 'butan-1-ol'],
	['乙二醇', 'ethane-1,2-diol', 'OCCO', '甘醇', 'ethane-1,2-diol'],
	['丙三醇', 'propane-1,2,3-triol', 'OCC(O)CO', '甘油', 'propane-1,2,3-triol'],
	['苯酚', 'phenol', 'Oc1ccccc1', '石炭酸', 'phenol'],
	['苯甲醇', 'phenylmethanol', 'OCc1ccccc1', '苄醇', 'phenylmethanol'],
	['环己醇', 'cyclohexanol', 'OC1CCCCC1', '', 'cyclohexanol'],
	['甲醚', 'methoxymethane', 'COC', '二甲醚', 'methoxymethane'],
	['乙醚', 'ethoxyethane', 'CCOCC', '二乙醚', 'ethoxyethane'],
	['四氢呋喃', 'tetrahydrofuran', 'C1CCOC1', '', 'oxolane'],
	['苯甲醚', 'methoxybenzene', 'COc1ccccc1', '甲氧基苯', 'methoxybenzene'],

	// ---- 醛 / 酮 ----
	['甲醛', 'methanal', 'C=O', '蚁醛', 'methanal'],
	['乙醛', 'ethanal', 'CC=O', '醋醛', 'ethanal'],
	['丙醛', 'propanal', 'CCC=O', '', 'propanal'],
	['苯甲醛', 'benzaldehyde', 'O=Cc1ccccc1', '', 'benzaldehyde'],
	['丙烯醛', 'prop-2-enal', 'C=CC=O', '', 'prop-2-enal'],
	['丙酮', 'propan-2-one', 'CC(=O)C', '二甲基酮', 'propan-2-one'],
	['丁酮', 'butan-2-one', 'CCC(C)=O', '甲乙酮', 'butan-2-one'],
	['环己酮', 'cyclohexanone', 'O=C1CCCCC1', '', 'cyclohexanone'],
	['苯乙酮', '1-phenylethanone', 'CC(=O)c1ccccc1', '', '1-phenylethan-1-one'],

	// ---- 羧酸 ----
	['甲酸', 'methanoic acid', 'OC=O', '蚁酸', 'methanoic acid'],
	['乙酸', 'ethanoic acid', 'CC(=O)O', '醋酸', 'ethanoic acid'],
	['丙酸', 'propanoic acid', 'CCC(=O)O', '', 'propanoic acid'],
	['丁酸', 'butanoic acid', 'CCCC(=O)O', '酪酸', 'butanoic acid'],
	['乙二酸', 'oxalic acid', 'OC(=O)C(=O)O', '草酸', 'ethanedioic acid'],
	['苯甲酸', 'benzoic acid', 'O=C(O)c1ccccc1', '安息香酸', 'benzoic acid'],
	['水杨酸', '2-hydroxybenzoic acid', 'O=C(O)c1ccccc1O', '邻羟基苯甲酸', '2-hydroxybenzoic acid'],
	['丙烯酸', 'prop-2-enoic acid', 'C=CC(=O)O', '', 'prop-2-enoic acid'],
	['乳酸', '2-hydroxypropanoic acid', 'CC(O)C(=O)O', '2-羟基丙酸', '2-hydroxypropanoic acid'],
	['柠檬酸', '2-hydroxypropane-1,2,3-tricarboxylic acid', 'OC(=O)CC(O)(CC(=O)O)C(=O)O', '枸橼酸', '2-hydroxypropane-1,2,3-tricarboxylic acid'],
	['阿司匹林', '2-acetoxybenzoic acid', 'CC(=O)Oc1ccccc1C(=O)O', '乙酰水杨酸', '2-(acetyloxy)benzoic acid'],
	['硬脂酸', 'octadecanoic acid', 'CCCCCCCCCCCCCCCCCC(=O)O', '十八酸', 'octadecanoic acid'],

	// ---- 酯 ----
	['甲酸甲酯', 'methyl methanoate', 'COC=O', '', 'methyl formate'],
	['乙酸甲酯', 'methyl ethanoate', 'COC(C)=O', '', 'methyl acetate'],
	['乙酸乙酯', 'ethyl ethanoate', 'CCOC(C)=O', '', 'ethyl acetate'],
	['苯甲酸甲酯', 'methyl benzoate', 'COC(=O)c1ccccc1', '', 'methyl benzoate'],

	// ---- 含氮化合物 / 杂环 ----
	['甲胺', 'methanamine', 'CN', '一甲胺', 'methanamine'],
	['乙胺', 'ethanamine', 'CCN', '一乙胺', 'ethanamine'],
	['苯胺', 'aniline', 'Nc1ccccc1', '氨基苯', 'aniline'],
	['乙酰胺', 'ethanamide', 'CC(N)=O', '', 'acetamide'],
	['尿素', 'urea', 'NC(=O)N', '脲', 'urea'],
	['乙腈', 'ethanenitrile', 'CC#N', '甲基氰', 'ethanenitrile'],
	['硝基苯', 'nitrobenzene', '[O-][N+](=O)c1ccccc1', '', 'nitrobenzene'],
	['吡啶', 'pyridine', 'c1ccncc1', '', 'pyridine'],
	['呋喃', 'furan', 'c1ccoc1', '', 'furan'],
	['噻吩', 'thiophene', 'c1ccsc1', '', 'thiophene'],
	['吲哚', 'indole', 'c1ccc2[nH]ccc2c1', '', '1H-indole'],
	['甘氨酸', 'glycine', 'NCC(=O)O', '氨基乙酸', 'aminoacetic acid'],
	['丙氨酸', 'alanine', 'CC(N)C(=O)O', '2-氨基丙酸', '2-aminopropanoic acid'],
	['咖啡因', 'caffeine', 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C', '1,3,7-三甲基黄嘌呤', '1,3,7-trimethyl-3,7-dihydro-1H-purine-2,6-dione']
];
