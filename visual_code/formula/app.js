/* ==========================================================================
   公式渲染 —— KaTeX + mhchem
   左边写TeX, 右边实时渲染 (始终行间公式)
   附带一个符号面板: 点一下就插到光标处
   ========================================================================== */
(function () {
	'use strict';

	var tex = document.getElementById('tex');
	var out = document.getElementById('out');
	var hint = document.getElementById('hint');
	var tabs = document.getElementById('tabs');
	var symbols = document.getElementById('symbols');
	var btnCopy = document.getElementById('btn-copy');
	var btnClear = document.getElementById('btn-clear');

	if (!window.katex) {
		out.textContent = 'KaTeX没能加载，检查vendor/katex目录。';
		return;
	}

	/* ------------------------------------------------------------ 符号面板 */

	var PALETTE = [
		{
			name: '常用',
			items: [
				['x^{2}', 'x^{2}'],
				['x_{n}', 'x_{n}'],
				['\\frac{a}{b}', '\\frac{a}{b}'],
				['\\sqrt{x}', '\\sqrt{x}'],
				['\\sqrt[n]{x}', '\\sqrt[n]{x}'],
				['\\int_{a}^{b}', '\\int_{a}^{b}'],
				['\\sum_{i=1}^{n}', '\\sum_{i=1}^{n}'],
				['\\prod_{i=1}^{n}', '\\prod_{i=1}^{n}'],
				['\\lim_{x\\to 0}', '\\lim_{x \\to 0}'],
				['\\sin', '\\sin'],
				['\\cos', '\\cos'],
				['\\tan', '\\tan'],
				['\\log', '\\log'],
				['\\ln', '\\ln'],
				['\\pm', '\\pm'],
				['\\times', '\\times'],
				['\\div', '\\div'],
				['\\cdot', '\\cdot'],
				['\\infty', '\\infty'],
				['^{\\circ}', '^{\\circ}'],
				['\\%', '\\%'],
				['\\neq', '\\neq'],
				['\\le', '\\le'],
				['\\ge', '\\ge'],
				['\\approx', '\\approx']
			]
		},
		{
			name: '希腊字母',
			items: [
				['\\alpha', '\\alpha'], ['\\beta', '\\beta'], ['\\gamma', '\\gamma'], ['\\delta', '\\delta'],
				['\\epsilon', '\\epsilon'], ['\\varepsilon', '\\varepsilon'], ['\\zeta', '\\zeta'], ['\\eta', '\\eta'],
				['\\theta', '\\theta'], ['\\vartheta', '\\vartheta'], ['\\iota', '\\iota'], ['\\kappa', '\\kappa'],
				['\\lambda', '\\lambda'], ['\\mu', '\\mu'], ['\\nu', '\\nu'], ['\\xi', '\\xi'],
				['\\pi', '\\pi'], ['\\rho', '\\rho'], ['\\sigma', '\\sigma'], ['\\tau', '\\tau'],
				['\\upsilon', '\\upsilon'], ['\\phi', '\\phi'], ['\\varphi', '\\varphi'], ['\\chi', '\\chi'],
				['\\psi', '\\psi'], ['\\omega', '\\omega'],
				['\\Gamma', '\\Gamma'], ['\\Delta', '\\Delta'], ['\\Theta', '\\Theta'], ['\\Lambda', '\\Lambda'],
				['\\Xi', '\\Xi'], ['\\Pi', '\\Pi'], ['\\Sigma', '\\Sigma'], ['\\Phi', '\\Phi'],
				['\\Psi', '\\Psi'], ['\\Omega', '\\Omega']
			]
		},
		{
			name: '关系符',
			items: [
				['=', '='], ['\\neq', '\\neq'], ['\\approx', '\\approx'], ['\\equiv', '\\equiv'],
				['\\cong', '\\cong'], ['\\sim', '\\sim'], ['\\propto', '\\propto'],
				['\\le', '\\le'], ['\\ge', '\\ge'], ['\\ll', '\\ll'], ['\\gg', '\\gg'],
				['\\in', '\\in'], ['\\notin', '\\notin'], ['\\ni', '\\ni'],
				['\\subset', '\\subset'], ['\\supset', '\\supset'], ['\\subseteq', '\\subseteq'],
				['\\perp', '\\perp'], ['\\parallel', '\\parallel'], ['\\angle', '\\angle'],
				['\\triangle', '\\triangle'], ['\\square', '\\square']
			]
		},
		{
			name: '运算符',
			items: [
				['+', '+'], ['-', '-'], ['\\times', '\\times'], ['\\div', '\\div'],
				['\\pm', '\\pm'], ['\\mp', '\\mp'], ['\\cdot', '\\cdot'],
				['\\ast', '\\ast'], ['\\star', '\\star'], ['\\circ', '\\circ'],
				['\\oplus', '\\oplus'], ['\\ominus', '\\ominus'], ['\\otimes', '\\otimes'],
				['\\cup', '\\cup'], ['\\cap', '\\cap'], ['\\setminus', '\\setminus'],
				['\\wedge', '\\wedge'], ['\\vee', '\\vee'], ['\\neg', '\\neg']
			]
		},
		{
			name: '箭头',
			items: [
				['\\to', '\\to'], ['\\leftarrow', '\\leftarrow'], ['\\leftrightarrow', '\\leftrightarrow'],
				['\\Rightarrow', '\\Rightarrow'], ['\\Leftarrow', '\\Leftarrow'], ['\\Leftrightarrow', '\\Leftrightarrow'],
				['\\uparrow', '\\uparrow'], ['\\downarrow', '\\downarrow'], ['\\mapsto', '\\mapsto'],
				['\\longrightarrow', '\\longrightarrow'], ['\\xrightarrow{}', '\\xrightarrow{}'],
				['\\rightleftharpoons', '\\rightleftharpoons']
			]
		},
		{
			name: '集合与逻辑',
			items: [
				['\\emptyset', '\\emptyset'], ['\\mathbb{N}', '\\mathbb{N}'], ['\\mathbb{Z}', '\\mathbb{Z}'],
				['\\mathbb{Q}', '\\mathbb{Q}'], ['\\mathbb{R}', '\\mathbb{R}'], ['\\mathbb{C}', '\\mathbb{C}'],
				['\\forall', '\\forall'], ['\\exists', '\\exists'], ['\\therefore', '\\therefore'],
				['\\because', '\\because'], ['\\ldots', '\\ldots'], ['\\cdots', '\\cdots'],
				['\\dots', '\\dots'], ['\\vdots', '\\vdots']
			]
		},
		{
			name: '微积分与结构',
			items: [
				['\\int', '\\int'], ['\\iint', '\\iint'], ['\\iiint', '\\iiint'], ['\\oint', '\\oint'],
				['\\sum', '\\sum'], ['\\prod', '\\prod'], ['\\partial', '\\partial'], ['\\nabla', '\\nabla'],
				['\\vec{a}', '\\vec{a}'], ['\\hat{a}', '\\hat{a}'], ['\\bar{a}', '\\bar{a}'],
				['\\overline{AB}', '\\overline{AB}'], ['\\dot{a}', '\\dot{a}'], ['\\ddot{a}', '\\ddot{a}'],
				['\\left(\\right)', '\\left( \\right)'], ['\\left[\\right]', '\\left[ \\right]'],
				['\\left\\{\\right\\}', '\\left\\{ \\right\\}'],
				['\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],
				['\\begin{cases}\\end{cases}', '\\begin{cases} \\end{cases}']
			]
		},
		{
			name: '化学',
			items: [
				['\\ce{}', '\\ce{}'],
				['\\ce{H2O}', '\\ce{H2O}'],
				['\\ce{CO2}', '\\ce{CO2}'],
				['\\ce{OH-}', '\\ce{OH-}'],
				['\\ce{SO4^2-}', '\\ce{SO4^2-}'],
				['\\ce{->}', '\\ce{->}'],
				['\\ce{<=>}', '\\ce{<=>}'],
				['\\ce{2H2 + O2 -> 2H2O}', '\\ce{2H2 + O2 -> 2H2O}'],
				['\\ce{CH3CH2OH}', '\\ce{CH3CH2OH}']
			]
		}
	];

	var currentGroup = 0;

	function label(texSrc) {
		try {
			return window.katex.renderToString(texSrc, { throwOnError: false, trust: true });
		} catch (e) {
			return texSrc;
		}
	}

	function showGroup(i) {
		currentGroup = i;
		symbols.innerHTML = '';
		var frag = document.createDocumentFragment();

		PALETTE[i].items.forEach(function (item) {
			var b = document.createElement('button');
			b.type = 'button';
			b.className = 'fx-sym';
			b.title = item[1];
			b.innerHTML = label(item[0]);
			b.addEventListener('click', function () { insert(item[1]); });
			frag.appendChild(b);
		});

		symbols.appendChild(frag);

		var tabBtns = tabs.querySelectorAll('.fx-tab');
		for (var k = 0; k < tabBtns.length; k++) {
			tabBtns[k].classList.toggle('on', k === i);
		}
	}

	PALETTE.forEach(function (group, i) {
		var b = document.createElement('button');
		b.type = 'button';
		b.className = 'fx-tab';
		b.textContent = group.name;
		b.addEventListener('click', function () { showGroup(i); });
		tabs.appendChild(b);
	});

	/* 插到光标处, 有 {} 就把光标放进第一对花括号里 */
	function insert(text) {
		var start = tex.selectionStart;
		var end = tex.selectionEnd;
		var value = tex.value;
		var before = value.slice(0, start);
		var after = value.slice(end);

		/* 不用在紧挨着的地方重复补空格 */
		var needsSpace = before && !/[\s{(\[]$/.test(before);
		var piece = (needsSpace ? ' ' : '') + text;

		tex.value = before + piece + after;

		var caret = before.length + piece.length;
		var hole = piece.indexOf('{}');
		if (hole >= 0) caret = before.length + hole + 1;

		tex.focus();
		tex.setSelectionRange(caret, caret);
		render();
	}

	/* ------------------------------------------------------------ 渲染 */

	var CJK = /[\u2E80-\u2EFF\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

	/* 把 \text{...} 保护起来, 其余中文/全角符号自动套上 \text{} */
	function wrapCjk(src) {
		var outText = '';
		var i = 0;
		var wrapped = false;

		while (i < src.length) {
			var rest = src.slice(i);
			var m = /^\\text\s*\{/.exec(rest);

			if (m) {
				var open = i + m[0].length - 1;
				var depth = 0;
				var j = open;
				for (; j < src.length; j++) {
					if (src.charAt(j) === '{') depth++;
					else if (src.charAt(j) === '}') {
						depth--;
						if (depth === 0) { j++; break; }
					}
				}
				outText += src.slice(i, j);
				i = j;
				continue;
			}

			var ch = src.charAt(i);
			if (CJK.test(ch)) {
				var run = '';
				while (i < src.length && CJK.test(src.charAt(i))) { run += src.charAt(i); i++; }
				outText += '\\text{' + run + '}';
				wrapped = true;
				continue;
			}

			outText += ch;
			i++;
		}

		return { text: outText, wrapped: wrapped };
	}

	function render() {
		var text = tex.value;
		out.innerHTML = '';

		var blocks = text.split(/\n\s*\n/).filter(function (b) { return b.trim() !== ''; });
		if (!blocks.length) {
			hint.textContent = '';
			return;
		}

		var anyWrapped = false;

		blocks.forEach(function (block) {
			var src = wrapCjk(block.trim());
			if (src.wrapped) anyWrapped = true;

			var div = document.createElement('div');
			try {
				window.katex.render(src.text, div, {
					throwOnError: true,
					displayMode: true,
					strict: false,
					trust: true
				});
			} catch (err) {
				div.className = 'vc-error';
				div.textContent = '解析失败：' + err.message;
			}
			out.appendChild(div);
		});

		hint.textContent = anyWrapped
			? '提示：中文（或全角符号）没有用 \\text{} 包裹。'
			: '';
	}

	var timer = null;
	function schedule() {
		clearTimeout(timer);
		timer = setTimeout(render, 120);
	}

	tex.addEventListener('input', schedule);

	btnClear.addEventListener('click', function () {
		tex.value = '';
		render();
		tex.focus();
	});

	btnCopy.addEventListener('click', function () {
		var text = tex.value;
		var done = function () {
			btnCopy.textContent = '已复制';
			setTimeout(function () { btnCopy.textContent = '复制TeX'; }, 1200);
		};
		var fallback = function () {
			var ta = document.createElement('textarea');
			ta.value = text;
			ta.style.position = 'fixed';
			ta.style.top = '-1000px';
			document.body.appendChild(ta);
			ta.select();
			try { document.execCommand('copy'); done(); } catch (e) { /* 忽略 */ }
			document.body.removeChild(ta);
		};
		if (navigator.clipboard && window.isSecureContext) {
			navigator.clipboard.writeText(text).then(done).catch(fallback);
		} else {
			fallback();
		}
	});

	showGroup(0);
	render();
})();
