/* ==========================================================================
   碳原子标号 —— 用JSME导出的molfile坐标画一张带编号的结构图
   编号就是原子在结构里的索引（0开始），也就是RDKit.js里的atom index，
   它属于「规范序」，不是IUPAC位次。
   ========================================================================== */
(function () {
	'use strict';

	var btn = document.getElementById('btn-carbon-num');
	var view = document.getElementById('carbon-num-view');
	var hint = document.getElementById('carbon-num-hint');

	if (!btn || !view) return;

	var SHORT = '此处的碳原子标号是“规范序”，不是IUPAC位次，在与他人或生成式人工智能交流时请注意说明“根据RDKit.js”的标号。';

	/* ---------------------------------------------------------- molfile */

	function parseMol(text) {
		var lines = String(text || '').split(/\r?\n/);
		if (lines.length < 5) return null;

		var counts = lines[3] || '';
		var nAtoms = parseInt(counts.slice(0, 3), 10);
		var nBonds = parseInt(counts.slice(3, 6), 10);
		if (!isFinite(nAtoms) || nAtoms <= 0) return null;

		var atoms = [];
		var i;

		for (i = 0; i < nAtoms; i++) {
			var l = lines[4 + i];
			if (!l) return null;
			atoms.push({
				x: parseFloat(l.slice(0, 10)),
				y: parseFloat(l.slice(10, 20)),
				sym: (l.slice(31, 34) || '').trim() || 'C'
			});
		}

		var bonds = [];
		for (i = 0; i < nBonds; i++) {
			var b = lines[4 + nAtoms + i];
			if (!b) break;
			bonds.push({
				a: parseInt(b.slice(0, 3), 10) - 1,
				b: parseInt(b.slice(3, 6), 10) - 1,
				order: parseInt(b.slice(6, 9), 10) || 1
			});
		}

		return { atoms: atoms, bonds: bonds };
	}

	/* ---------------------------------------------------------- 画图 */

	function draw(mol) {
		var atoms = mol.atoms;
		var bonds = mol.bonds;

		/* molfile的y轴向上, SVG向下, 所以取负 */
		var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		atoms.forEach(function (a) {
			var y = -a.y;
			if (a.x < minX) minX = a.x;
			if (a.x > maxX) maxX = a.x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		});

		var pad = 1.2;
		var vb = [minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2];

		var svg = [];
		svg.push('<svg class="cn-svg" viewBox="' + vb.join(' ') + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="带碳原子标号的结构图">');
		svg.push('<g stroke-linecap="round">');

		/* 键 */
		bonds.forEach(function (bd) {
			var A = atoms[bd.a];
			var B = atoms[bd.b];
			if (!A || !B) return;

			var x1 = A.x, y1 = -A.y, x2 = B.x, y2 = -B.y;
			var dx = x2 - x1, dy = y2 - y1;
			var len = Math.sqrt(dx * dx + dy * dy) || 1;
			var nx = -dy / len, ny = dx / len;

			var offsets = bd.order === 2 ? [-0.075, 0.075] : (bd.order === 3 ? [-0.14, 0, 0.14] : [0]);

			offsets.forEach(function (o) {
				svg.push('<line x1="' + (x1 + nx * o) + '" y1="' + (y1 + ny * o) +
					'" x2="' + (x2 + nx * o) + '" y2="' + (y2 + ny * o) +
					'" stroke="currentColor" stroke-width="0.07"/>');
			});
		});

		svg.push('</g>');

		/* 原子 */
		atoms.forEach(function (a, idx) {
			var isC = a.sym === 'C';
			var cx = a.x;
			var cy = -a.y;

			if (isC) {
				/* 碳: 标号放在顶点左上角, 加一圈底色描边免得被键挡住 */
				svg.push('<text x="' + (cx - 0.16) + '" y="' + (cy - 0.16) + '" text-anchor="middle" ' +
					'font-size="0.46" font-weight="700" fill="#d33" stroke="var(--c-bg)" stroke-width="0.14" ' +
					'paint-order="stroke" style="paint-order:stroke">' + idx + '</text>');
			} else {
				svg.push('<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" ' +
					'font-size="0.5" font-weight="600" fill="currentColor" stroke="var(--c-bg)" stroke-width="0.16" ' +
					'paint-order="stroke" style="paint-order:stroke">' + a.sym + '</text>');
			}
		});

		svg.push('</svg>');
		return svg.join('');
	}

	/* ---------------------------------------------------------- 交互 */

	function refresh() {
		var jsme = window.__jsme;
		if (!jsme) {
			hint.textContent = '画布还在加载，稍等一下再点。';
			return;
		}

		var text = '';
		try {
			text = jsme.molFile();
		} catch (e) {
			text = '';
		}

		var mol = text ? parseMol(text) : null;
		if (!mol) {
			hint.textContent = '先在左边画一个结构，再点「碳原子标号」。';
			view.hidden = true;
			return;
		}

		var carbons = mol.atoms.filter(function (a) { return a.sym === 'C'; }).length;
		view.innerHTML = draw(mol);
		view.hidden = false;

		hint.textContent = SHORT + '（共' + carbons + '个碳原子，编号从0开始）';
	}

	btn.addEventListener('click', refresh);
})();
