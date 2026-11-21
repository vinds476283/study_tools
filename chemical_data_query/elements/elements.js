/* ==========================================================================
   元素周期表
   - 14 个字段可勾选, 勾哪个就在格子里显示哪个
   - 每个字段下面一个搜索框, 多个搜索取交集, 不匹配的格子隐藏
   ========================================================================== */
(function () {
	'use strict';

	var F = window.ElFormat;

	/* 侧栏顺序 */
	var FIELDS = [
		'zh', 'pinyin', 'en', 'phonetic', 'symbol', 'number', 'mass',
		'isotope', 'electron_configuration', 'radius', 'i1', 'e1', 'electronegativity'
	];

	/* 格子里的行: 每行放哪些字段; 带前缀的显示成 "前缀=值" */
	var CELL_ROWS = [
		[['zh'], ['pinyin']],
		[['en'], ['phonetic']],
		[['isotope']],
		[['electron_configuration']],
		[['i1', 'I<sub>1</sub>'], ['e1', 'E<sub>1</sub>']],
		[['electronegativity', 'χ'], ['radius', 'r']]
	];

	var grid = document.getElementById('grid');
	var fieldsBox = document.getElementById('fields');
	var countEl = document.getElementById('count');
	var allBox = document.getElementById('all');

	var elements = [];
	var cells = [];
	var head = null;
	var searches = {};
	var checked = {};

	/* ------------------------------------------------------------ 位置 */

	function position(z) {
		if (z === 1) return [1, 1];
		if (z === 2) return [1, 18];
		if (z >= 3 && z <= 4) return [2, z - 2];
		if (z >= 5 && z <= 10) return [2, z + 8];
		if (z >= 11 && z <= 12) return [3, z - 10];
		if (z >= 13 && z <= 18) return [3, z];
		if (z >= 19 && z <= 36) return [4, z - 18];
		if (z >= 37 && z <= 54) return [5, z - 36];
		if (z >= 55 && z <= 56) return [6, z - 54];
		if (z >= 57 && z <= 71) return [9, z - 54];
		if (z >= 72 && z <= 86) return [6, z - 68];
		if (z >= 87 && z <= 88) return [7, z - 86];
		if (z >= 89 && z <= 103) return [10, z - 86];
		if (z >= 104 && z <= 118) return [7, z - 100];
		return [1, 1];
	}

	/* ------------------------------------------------------------ 格子 */

	function buildCell(item) {
		var z = Number(item.number);
		var pos = position(z);

		var a = document.createElement('a');
		a.className = 'el';
		a.href = String(item.en).toLowerCase() + '/';
		a.style.gridRow = pos[0];
		a.style.gridColumn = pos[1];
		a.setAttribute('aria-label', item.zh + ' ' + item.en);

		var num = document.createElement('span');
		num.className = 'el-num';
		num.setAttribute('data-field', 'number');
		num.textContent = item.number;
		a.appendChild(num);

		var sym = document.createElement('span');
		sym.className = 'el-sym';
		sym.setAttribute('data-field', 'symbol');
		sym.innerHTML = F.html('symbol', item.symbol);
		a.appendChild(sym);

		var mass = document.createElement('span');
		mass.className = 'el-mass';
		mass.setAttribute('data-field', 'mass');
		mass.innerHTML = F.html('mass', item.mass);
		a.appendChild(mass);

		var box = document.createElement('span');
		box.className = 'el-fields';

		CELL_ROWS.forEach(function (row) {
			var line = document.createElement('span');
			line.className = 'el-row';

			row.forEach(function (def) {
				var key = def[0];
				var prefix = def[1] || '';
				var raw = item[key];

				var s = document.createElement('span');
				s.setAttribute('data-field', key);
				s.title = F.label(key, head) + ': ' + F.plain(raw);

				if (prefix) {
					s.innerHTML = prefix + '=' + (F.plain(raw) ? F.html(key, raw) : '—');
				} else {
					s.innerHTML = F.html(key, raw);
				}

				line.appendChild(s);
			});

			box.appendChild(line);
		});

		a.appendChild(box);

		return a;
	}

	/* ------------------------------------------------------------ 筛选 */

	function applyFilters() {
		var active = Object.keys(searches).filter(function (k) { return searches[k]; });
		var shown = 0;

		for (var i = 0; i < cells.length; i++) {
			var cell = cells[i];
			var ok = true;

			for (var k = 0; k < active.length; k++) {
				var key = active[k];
				var q = searches[key];
				var text = F.plain(cell.data[key]).toLowerCase();
				if (text.indexOf(q) < 0) { ok = false; break; }
			}

			cell.el.classList.toggle('is-hidden', !ok);
			if (ok) shown++;
		}

		countEl.textContent = '显示 ' + shown + ' / ' + cells.length + ' 种元素';
	}

	/* ------------------------------------------------------------ 字段 */

	function toggleField(key, on) {
		checked[key] = on;
		var nodes = grid.querySelectorAll('[data-field="' + key + '"]');
		for (var i = 0; i < nodes.length; i++) nodes[i].classList.toggle('is-off', !on);
	}

	function syncAll() {
		var on = FIELDS.every(function (k) { return checked[k]; });
		allBox.checked = on;
	}

	function buildFields() {
		FIELDS.forEach(function (key) {
			var wrap = document.createElement('div');
			wrap.className = 'pt-field';

			var label = document.createElement('label');
			var box = document.createElement('input');
			box.type = 'checkbox';
			box.checked = true;
			box.setAttribute('data-key', key);

			var text = document.createElement('span');
			text.textContent = F.label(key, head);

			label.appendChild(box);
			label.appendChild(text);
			wrap.appendChild(label);

			var search = document.createElement('input');
			search.type = 'search';
			search.placeholder = '搜索' + (head[key] || key);
			search.setAttribute('data-search', key);
			search.autocomplete = 'off';
			wrap.appendChild(search);

			box.addEventListener('change', function () {
				toggleField(key, box.checked);
				syncAll();
			});

			search.addEventListener('input', function () {
				searches[key] = search.value.trim().toLowerCase();
				applyFilters();
			});

			fieldsBox.appendChild(wrap);

			checked[key] = true;
		});
	}

	allBox.addEventListener('change', function () {
		FIELDS.forEach(function (key) {
			checked[key] = allBox.checked;
			var boxes = fieldsBox.querySelectorAll('input[data-key="' + key + '"]');
			var nodes = grid.querySelectorAll('[data-field="' + key + '"]');
			for (var i = 0; i < boxes.length; i++) boxes[i].checked = allBox.checked;
			for (var j = 0; j < nodes.length; j++) nodes[j].classList.toggle('is-off', !allBox.checked);
		});
	});

	/* ------------------------------------------------------------ 启动 */

	fetch('../elements.json')
		.then(function (res) {
			if (!res.ok) throw new Error();
			return res.json();
		})
		.then(function (data) {
			head = data[0];
			elements = data.slice(1).filter(function (item) {
				return item && item.number && isFinite(Number(item.number));
			});

			elements.sort(function (a, b) { return Number(a.number) - Number(b.number); });

			var frag = document.createDocumentFragment();
			elements.forEach(function (item) {
				var a = buildCell(item);
				frag.appendChild(a);
				cells.push({ el: a, data: item });
			});

			/* 镧系/锕系与主表之间留一点空隙 */
			var spacer = document.createElement('div');
			spacer.className = 'pt-gap';
			spacer.style.gridRow = '8';
			spacer.style.gridColumn = '1 / span 18';
			frag.appendChild(spacer);

			grid.appendChild(frag);

			buildFields();
			applyFilters();
		})
		.catch(function () {
			countEl.textContent = '元素数据没能加载，刷新页面再试试。';
		});
})();
