/* ==========================================================================
   元素详情页 —— 把 elements.json 里这个元素的所有字段列出来
   ========================================================================== */
(function () {
	'use strict';

	var F = window.ElFormat;
	var z = document.body.getAttribute('data-element');
	var tag = document.getElementById('el-tag');
	var dl = document.getElementById('el-data');

	if (!z || !dl) return;

	function escapeHtml(text) {
		return String(text === undefined || text === null ? '' : text)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	fetch('../../elements.json')
		.then(function (res) {
			if (!res.ok) throw new Error();
			return res.json();
		})
		.then(function (data) {
			var head = data[0];
			var item = data.slice(1).filter(function (row) {
				return row && String(row.number) === String(z);
			})[0];

			if (!item) throw new Error();

			tag.innerHTML = '原子序数 ' + escapeHtml(item.number) +
				' · ' + escapeHtml(item.zh) + ' · 符号 ' + F.html('symbol', item.symbol);

			var frag = document.createDocumentFragment();
			Object.keys(head).forEach(function (key) {
				var row = document.createElement('div');

				var dt = document.createElement('dt');
				dt.textContent = F.label(key, head);

				var dd = document.createElement('dd');
				var raw = F.html(key, item[key]);
				dd.innerHTML = (raw === '' || raw === null || raw === undefined) ? '—' : raw;

				row.appendChild(dt);
				row.appendChild(dd);
				frag.appendChild(row);
			});

			dl.innerHTML = '';
			dl.appendChild(frag);
		})
		.catch(function () {
			dl.innerHTML = '<div><dt>数据</dt><dd>没能加载，刷新页面再试试。</dd></div>';
		});
})();
