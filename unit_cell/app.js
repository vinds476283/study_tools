/* ==========================================================================
   晶胞结构 —— 3Dmol.js 画晶胞
   数据来自 data.js (VESTA 文件已展开空间群对称操作)
   功能: 超胞渲染 / 等轴(正交)投影 / 按 a b c a* b* c* hkl 换视角 / 测距
   触屏手势 (单指转动 / 双指缩放) 由 3Dmol 自带的控制器处理。
   ========================================================================== */
(function () {
	'use strict';

	var DATA = window.UNIT_CELLS;
	var el = {
		tree: document.getElementById('tree'),
		search: document.getElementById('search'),
		title: document.getElementById('uc-title'),
		meta: document.getElementById('uc-meta'),
		legend: document.getElementById('legend'),
		viewer: document.getElementById('viewer'),
		btnReset: document.getElementById('btn-reset'),
		btnMeasure: document.getElementById('btn-measure'),
		btnHkl: document.getElementById('btn-hkl'),
		hkl: document.getElementById('hkl'),
		optOrtho: document.getElementById('opt-ortho'),
		optCell: document.getElementById('opt-cell'),
		optSmall: document.getElementById('opt-small'),
		measureInfo: document.getElementById('measure-info')
	};

	if (!DATA || !DATA.structures.length) {
		el.meta.textContent = '没有找到晶胞数据（data.js）。';
		return;
	}

	var state = {
		viewer: null,
		cur: null,
		curIndex: 0,
		rot: null,          /* 3x3 视角旋转, 直接作用在坐标上 */
		measure: false,
		picks: [],
		frac: []            /* 模型里每个原子的分数坐标 */
	};

	/* ------------------------------------------------------------ 向量工具 */

	function lattice(cell) {
		var rad = Math.PI / 180;
		var al = cell.alpha * rad;
		var be = cell.beta * rad;
		var ga = cell.gamma * rad;

		var va = [cell.a, 0, 0];
		var vb = [cell.b * Math.cos(ga), cell.b * Math.sin(ga), 0];
		var cx = cell.c * Math.cos(be);
		var cy = cell.c * (Math.cos(al) - Math.cos(be) * Math.cos(ga)) / Math.sin(ga);
		var cz = Math.sqrt(Math.max(0, cell.c * cell.c - cx * cx - cy * cy));

		return [va, vb, [cx, cy, cz]];
	}

	function toCart(vec, f) {
		return [
			f[0] * vec[0][0] + f[1] * vec[1][0] + f[2] * vec[2][0],
			f[0] * vec[0][1] + f[1] * vec[1][1] + f[2] * vec[2][1],
			f[0] * vec[0][2] + f[1] * vec[1][2] + f[2] * vec[2][2]
		];
	}

	function cross(a, b) {
		return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
	}
	function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
	function norm(a) { return Math.sqrt(dot(a, a)); }
	function unit(a) {
		var n = norm(a) || 1;
		return [a[0] / n, a[1] / n, a[2] / n];
	}

	/* 让方向 d 指向屏幕里头, 返回 3x3 矩阵 */
	function lookAlong(d) {
		var z = unit(d);
		var up = Math.abs(z[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
		var x = unit(cross(up, z));
		var y = cross(z, x);
		return [x, y, z];
	}

	function applyRot(R, v) {
		return [dot(R[0], v), dot(R[1], v), dot(R[2], v)];
	}

	function defaultRot(vec) {
		var dir = [0, 0, 0];
		[0, 1, 2].forEach(function (i) {
			var u = unit(vec[i]);
			dir[0] += u[0];
			dir[1] += u[1];
			dir[2] += u[2];
		});
		dir[2] *= 0.8;   /* c 轴压一点, 免得细长晶胞只看到顶端 */
		return lookAlong(dir);
	}

	/* ------------------------------------------------------------ 超胞 */

	/* 晶胞里的原子再按 {0,1}^3 平移一次, 这样落在棱和面上的原子两侧都有 */
	function cellAtoms(struct) {
		var out = [];
		var seen = {};
		var shifts = [0, 1];

		struct.atoms.forEach(function (a) {
			shifts.forEach(function (sx) {
				shifts.forEach(function (sy) {
					shifts.forEach(function (sz) {
						var f = [a[1] + sx, a[2] + sy, a[3] + sz];
						if (f[0] > 1 + 1e-6 || f[1] > 1 + 1e-6 || f[2] > 1 + 1e-6) return;
						var key = a[0] + '|' + f.map(function (v) { return v.toFixed(3); }).join(',');
						if (seen[key]) return;
						seen[key] = 1;
						out.push({ s: a[0], p: f });
					});
				});
			});
		});

		return out;
	}

	/* ------------------------------------------------------------ 画布 */

	function bg() {
		return document.documentElement.getAttribute('data-theme') === 'dark' ? '#000000' : '#ffffff';
	}

	function makeViewer() {
		el.viewer.innerHTML = '';
		var v = window.$3Dmol.createViewer(el.viewer, {
			backgroundColor: bg(),
			antialias: true
		});
		v.setCameraParameters({ orthographic: !!el.optOrtho.checked });
		return v;
	}

	function rebuild() {
		state.viewer = makeViewer();
		render();
	}

	function drawCell(vec, R) {
		var corner = 0x888888;

		function P(f) {
			var c = toCart(vec, f);
			var r = applyRot(R, c);
			return { x: r[0], y: r[1], z: r[2] };
		}

		var edges = [
			[[0, 0, 0], [1, 0, 0]], [[0, 1, 0], [1, 1, 0]], [[0, 0, 1], [1, 0, 1]], [[0, 1, 1], [1, 1, 1]],
			[[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]], [[0, 0, 1], [0, 1, 1]], [[1, 0, 1], [1, 1, 1]],
			[[0, 0, 0], [0, 0, 1]], [[1, 0, 0], [1, 0, 1]], [[0, 1, 0], [0, 1, 1]], [[1, 1, 0], [1, 1, 1]]
		];

		edges.forEach(function (e) {
			state.viewer.addCylinder({
				start: P(e[0]),
				end: P(e[1]),
				radius: 0.04,
				color: corner,
				fromCap: 1,
				toCap: 1
			});
		});
	}

	/* ------------------------------------------------------------ 渲染 */

	function render() {
		var struct = state.cur;
		var v = state.viewer;
		if (!struct || !v) return;

		v.removeAllShapes();
		v.removeAllModels();
		v.removeAllLabels();
		state.picks = [];
		state.frac = [];

		var vec = lattice(struct.cell);
		var R = state.rot;
		var scale = el.optSmall.checked ? 0.5 : 1;
		var atoms = cellAtoms(struct);
		var modelAtoms = [];

		atoms.forEach(function (a, i) {
			var c = toCart(vec, a.p);
			var r = applyRot(R, c);
			var color = DATA.colors[a.s] || [130, 130, 130];
			var radius = ((struct.radii && struct.radii[a.s]) || 0.6) * scale;

			state.viewer.addSphere({
				center: { x: r[0], y: r[1], z: r[2] },
				radius: radius,
				color: 'rgb(' + color.join(',') + ')'
			});

			state.frac[i] = a.p;
			modelAtoms.push({ elem: a.s, x: r[0], y: r[1], z: r[2], index: i });
		});

		if (el.optCell.checked) drawCell(vec, R);

		/* 看不见的模型: 提供点击区域和包围盒 */
		var model = v.addModel();
		model.addAtoms(modelAtoms);
		v.setStyle({}, { sphere: { hidden: true }, clicksphere: { radius: 0.9 } });
		v.setClickable({}, true, onAtomClick);

		v.zoomTo();
		v.render();

		el.title.innerHTML = formulaHtml(struct.formula) +
			'<span class="uc-sub"> · ' + struct.name + '</span>';

		var counts = {};
		atoms.forEach(function (a) { counts[a.s] = (counts[a.s] || 0) + 1; });

		var parts = Object.keys(counts).map(function (k) { return k + '<sub>' + counts[k] + '</sub>'; });

		el.meta.innerHTML = 'a = ' + round3(struct.cell.a) + ' Å，b = ' + round3(struct.cell.b) + ' Å，c = ' +
			round3(struct.cell.c) + ' Å；α = ' + round3(struct.cell.alpha) + '°，β = ' + round3(struct.cell.beta) +
			'°，γ = ' + round3(struct.cell.gamma) + '°；晶胞内含 ' + parts.join(' + ') + '，' +
			'图上共 ' + atoms.length + ' 个原子。';

		el.legend.innerHTML = '';
		Object.keys(counts).forEach(function (sym) {
			var color = DATA.colors[sym] || [130, 130, 130];
			var item = document.createElement('span');
			item.className = 'item';
			var d = document.createElement('span');
			d.className = 'dot';
			d.style.background = 'rgb(' + color.join(',') + ')';
			item.appendChild(d);
			item.appendChild(document.createTextNode(sym + '（' + counts[sym] + '）'));
			el.legend.appendChild(item);
		});

		el.measureInfo.textContent = '';
	}

	function round3(n) {
		return Math.round(n * 1000) / 1000;
	}

	function formulaHtml(formula) {
		var out = '';
		var re = /([A-Z][a-z]?)(\d*)/g;
		var m;
		while ((m = re.exec(formula)) !== null) {
			if (!m[1]) break;
			out += m[1] + (m[2] ? '<sub>' + m[2] + '</sub>' : '');
		}
		return out;
	}

	/* ------------------------------------------------------------ 测距 */

	function onAtomClick(atom) {
		if (!state.measure || !atom) return;

		var idx = atom.index;
		if (idx === undefined || !state.frac[idx]) return;

		state.picks.push(idx);

		if (state.picks.length === 1) {
			el.measureInfo.textContent = '已选第1个原子，再点一个原子。';
			return;
		}

		var i1 = state.picks[0];
		var i2 = state.picks[1];
		state.picks = [];

		var f1 = state.frac[i1];
		var f2 = state.frac[i2];
		var df = [f2[0] - f1[0], f2[1] - f1[1], f2[2] - f1[2]];

		var vec = lattice(state.cur.cell);
		var dist = norm(toCart(vec, df));

		var a = state.cur.cell.a;
		var b = state.cur.cell.b;
		var c = state.cur.cell.c;

		el.measureInfo.innerHTML =
			'分数坐标差 Δx = ' + fmt(df[0]) + '，Δy = ' + fmt(df[1]) + '，Δz = ' + fmt(df[2]) +
			'；三个方向的长度：|Δx|·a = ' + fmt(Math.abs(df[0]) * a) + ' Å，|Δy|·b = ' +
			fmt(Math.abs(df[1]) * b) + ' Å，|Δz|·c = ' + fmt(Math.abs(df[2]) * c) + ' Å；实际距离 = ' +
			'<b>' + fmt(dist) + ' Å</b>';

		var p1 = applyRot(state.rot, toCart(vec, f1));
		var p2 = applyRot(state.rot, toCart(vec, f2));

		state.viewer.addCylinder({
			start: { x: p1[0], y: p1[1], z: p1[2] },
			end: { x: p2[0], y: p2[1], z: p2[2] },
			radius: 0.06,
			color: '#d33',
			fromCap: 1,
			toCap: 1
		});

		state.viewer.addLabel(fmt(dist) + ' Å', {
			position: { x: (p1[0] + p2[0]) / 2, y: (p1[1] + p2[1]) / 2, z: (p1[2] + p2[2]) / 2 },
			backgroundColor: '#d33',
			backgroundOpacity: 0.85,
			fontColor: 'white',
			fontSize: 12
		});

		state.viewer.render();
	}

	function fmt(n) {
		var v = Math.abs(n) < 1e-9 ? 0 : n;
		return String(Math.round(v * 1000) / 1000);
	}

	/* ------------------------------------------------------------ 视角 */

	function setAxis(kind) {
		var struct = state.cur;
		if (!struct) return;

		var vec = lattice(struct.cell);
		var d = null;

		if (kind === 'a') d = vec[0];
		else if (kind === 'b') d = vec[1];
		else if (kind === 'c') d = vec[2];
		else if (kind === 'a*') d = cross(vec[1], vec[2]);
		else if (kind === 'b*') d = cross(vec[2], vec[0]);
		else if (kind === 'c*') d = cross(vec[0], vec[1]);

		if (!d) return;
		state.rot = lookAlong(d);
		rebuild();
	}

	function setHkl(h, k, l) {
		var vec = lattice(state.cur.cell);
		var d = [
			h * vec[0][0] + k * vec[1][0] + l * vec[2][0],
			h * vec[0][1] + k * vec[1][1] + l * vec[2][1],
			h * vec[0][2] + k * vec[1][2] + l * vec[2][2]
		];
		if (norm(d) < 1e-6) return;
		state.rot = lookAlong(d);
		rebuild();
	}

	/* ------------------------------------------------------------ 侧栏 */

	function select(i) {
		var buttons = el.tree.querySelectorAll('button');
		for (var k = 0; k < buttons.length; k++) buttons[k].classList.toggle('on', k === i);

		state.curIndex = i;
		state.cur = DATA.structures[i];
		state.rot = defaultRot(lattice(state.cur.cell));

		if (!state.viewer) state.viewer = makeViewer();
		render();
	}

	function buildTree() {
		el.tree.innerHTML = '';
		DATA.structures.forEach(function (s, i) {
			var li = document.createElement('li');
			var b = document.createElement('button');
			b.type = 'button';
			b.className = i === 0 ? 'on' : '';
			b.innerHTML = formulaHtml(s.formula) + '<small>' + s.name + '</small>';
			b.addEventListener('click', function () { select(i); });
			li.appendChild(b);
			el.tree.appendChild(li);
		});
	}

	el.search.addEventListener('input', function () {
		var q = el.search.value.trim().toLowerCase();
		var items = el.tree.querySelectorAll('li');
		DATA.structures.forEach(function (s, i) {
			var hit = !q || s.formula.toLowerCase().indexOf(q) >= 0 || s.name.toLowerCase().indexOf(q) >= 0;
			items[i].style.display = hit ? '' : 'none';
		});
	});

	/* ------------------------------------------------------------ 事件 */

	el.btnReset.addEventListener('click', function () {
		state.measure = false;
		el.btnMeasure.classList.remove('on');
		state.rot = defaultRot(lattice(state.cur.cell));
		rebuild();
	});

	el.optOrtho.addEventListener('change', function () {
		if (state.viewer) {
			state.viewer.setCameraParameters({ orthographic: !!el.optOrtho.checked });
			state.viewer.render();
		}
	});

	el.optCell.addEventListener('change', function () { render(); });
	el.optSmall.addEventListener('change', function () { render(); });

	el.btnMeasure.addEventListener('click', function () {
		state.measure = !state.measure;
		state.picks = [];
		el.btnMeasure.classList.toggle('on', state.measure);
		el.measureInfo.textContent = state.measure ? '测距模式：依次点击两个原子。' : '';
	});

	document.querySelectorAll('[data-axis]').forEach(function (b) {
		b.addEventListener('click', function () { setAxis(b.getAttribute('data-axis')); });
	});

	el.btnHkl.addEventListener('click', function () {
		var parts = el.hkl.value.replace(/[,\s]+/g, ' ').trim().split(' ').filter(Boolean).map(Number);
		if (parts.length !== 3 || parts.some(function (n) { return !isFinite(n); })) {
			el.measureInfo.textContent = 'hkl 要写三个整数，例如 1 1 0。';
			return;
		}
		if (parts.every(function (n) { return n === 0; })) {
			el.measureInfo.textContent = 'hkl 不能全为 0。';
			return;
		}
		setHkl(parts[0], parts[1], parts[2]);
	});

	el.hkl.addEventListener('keydown', function (e) {
		if (e.key === 'Enter') el.btnHkl.click();
	});

	/* 主题切换 */
	var lastTheme = document.documentElement.getAttribute('data-theme');
	setInterval(function () {
		var now = document.documentElement.getAttribute('data-theme');
		if (now === lastTheme) return;
		lastTheme = now;
		if (state.viewer) {
			state.viewer.setBackgroundColor(bg());
			render();
		}
	}, 300);

	buildTree();
	select(0);
})();
