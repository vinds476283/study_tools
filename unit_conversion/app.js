/* ==========================================================================
   单位换算 —— 纯前端，输入即算，无依赖
   ========================================================================== */
(function () {
	'use strict';

	var CATS = window.UNIT_CATS || [];
	var host = document.getElementById('boxes');

	/* ------------------------------------------------------------ 数字处理 */

	/* 允许1,234.5 / 1 234 / 科学计数法；空或非法返回null */
	function parseNum(text) {
		var s = String(text == null ? '' : text)
			.replace(/[\s,，_]/g, '')
			.replace(/。/g, '.')
			.trim();
		if (!s) return null;
		if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
		var v = Number(s);
		return isFinite(v) ? v : null;
	}

	/* 结果格式: 普通范围用常规写法, 太大太小用科学计数法 */
	function fmt(v) {
		if (v === 0) return '0';
		if (!isFinite(v)) return '';
		var a = Math.abs(v);
		if (a >= 1e15 || a < 1e-6) {
			return v.toExponential(9)
				.replace(/(\.\d*?)0+e/, '$1e')
				.replace(/\.e/, 'e')
				.replace('e+', 'e');
		}
		return Number(v.toPrecision(12)).toString();
	}

	/* ------------------------------------------------------------ 建界面 */

	function makeRow(ci, ui, unit) {
		var zh = unit[0];
		var sym = unit[1];
		var to;
		var from;

		if (typeof unit[2] === 'number') {
			var f = unit[2];
			to = function (v) { return v * f; };
			from = function (b) { return b / f; };
		} else {
			to = unit[2];
			from = unit[3];
		}

		var row = document.createElement('div');
		row.className = 'uc-row';

		var id = 'uc-' + ci + '-' + ui;

		var label = document.createElement('label');
		label.className = 'uc-label';
		label.setAttribute('for', id);
		label.appendChild(document.createTextNode(zh));
		/* 符号和名字重复时 (比如 "亩 亩"、"KiB KiB") 就不再显示一遍 */
		if (sym && sym !== zh) {
			var sm = document.createElement('small');
			sm.textContent = sym;
			label.appendChild(sm);
		}

		var input = document.createElement('input');
		input.type = 'text';
		input.id = id;
		input.className = 'uc-input';
		input.setAttribute('inputmode', 'decimal');
		input.setAttribute('autocomplete', 'off');
		input.setAttribute('spellcheck', 'false');
		input.setAttribute('aria-label', zh + '（' + sym + '）');

		row.appendChild(label);
		row.appendChild(input);

		return { el: row, input: input, to: to, from: from };
	}

	function markActive(rows, src) {
		for (var i = 0; i < rows.length; i++) {
			rows[i].input.classList.toggle('uc-active', rows[i] === src);
		}
	}

	/* 某一格变了: 换算到同组的其它格 */
	function update(rows, src) {
		var v = parseNum(src.input.value);
		for (var i = 0; i < rows.length; i++) {
			var other = rows[i];
			if (other === src) continue;
			if (v === null) {
				other.input.value = '';
				continue;
			}
			var base = src.to(v);
			other.input.value = fmt(other.from(base));
		}
		if (v === null) markActive(rows, null);
	}

	function makeBox(cat, ci) {
		var box = document.createElement('section');
		box.className = 'uc-box';

		var title = document.createElement('h2');
		title.className = 'uc-title';
		title.textContent = cat.name;
		box.appendChild(title);

		if (cat.note) {
			var note = document.createElement('p');
			note.className = 'uc-note';
			note.textContent = cat.note;
			box.appendChild(note);
		}

		var grid = document.createElement('div');
		grid.className = 'uc-grid';
		box.appendChild(grid);

		var rows = [];
		for (var i = 0; i < cat.units.length; i++) {
			var item = makeRow(ci, i, cat.units[i]);
			rows.push(item);
			grid.appendChild(item.el);
		}

		/* 事件: 输入即换算 */
		for (var j = 0; j < rows.length; j++) {
			(function (item) {
				item.input.addEventListener('input', function () {
					markActive(rows, item);
					update(rows, item);
				});
				item.input.addEventListener('focus', function () {
					markActive(rows, item);
					item.input.select();
				});
				item.input.addEventListener('blur', function () {
					item.input.classList.remove('uc-active');
				});
			})(rows[j]);
		}

		return box;
	}

	function render() {
		var frag = document.createDocumentFragment();
		for (var i = 0; i < CATS.length; i++) {
			frag.appendChild(makeBox(CATS[i], i));
		}
		host.appendChild(frag);
	}

	render();
})();
