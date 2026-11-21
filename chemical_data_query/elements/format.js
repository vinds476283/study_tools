/* ==========================================================================
   元素数据的显示格式
   - 同位素里的 _N 加下划线; 括号里的放射性同位素改成红色并去掉括号
   - 元素符号的括号同理
   ========================================================================== */
(function () {
	'use strict';

	/* 两个字段的说明要跟渲染方式保持一致 */
	var LABEL_FIX = {
		symbol: ['加括号为放射性元素', '红色为放射性元素'],
		isotope: ['加括号为放射性同位素', '红色为放射性同位素']
	};

	function escapeHtml(text) {
		return String(text === undefined || text === null ? '' : text)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function label(key, head) {
		var text = (head && head[key]) || key;
		var fix = LABEL_FIX[key];
		if (fix) text = text.replace(fix[0], fix[1]);
		return text;
	}

	/* 搜索用的纯文本: 去掉标签、括号、下划线 */
	function plain(raw) {
		return String(raw === undefined || raw === null ? '' : raw)
			.replace(/<[^>]*>/g, '')
			.replace(/[()（）_]/g, '')
			.trim();
	}

	function markSymbol(raw) {
		var text = String(raw === undefined || raw === null ? '' : raw).trim();
		if (/^\(.*\)$/.test(text)) {
			return '<span class="rad">' + escapeHtml(text.slice(1, -1)) + '</span>';
		}
		return escapeHtml(text);
	}

	function markIsotope(raw) {
		return String(raw === undefined || raw === null ? '' : raw)
			.split(',')
			.map(function (part) {
				var text = part.trim();
				if (!text) return '';

				var underline = false;
				if (text.charAt(0) === '_') {
					underline = true;
					text = text.slice(1);
				}

				var red = false;
				if (/^\(.*\)$/.test(text)) {
					red = true;
					text = text.slice(1, -1);
				}

				var html = escapeHtml(text);
				if (red) html = '<span class="rad">' + html + '</span>';
				if (underline) html = '<u>' + html + '</u>';
				return html;
			})
			.filter(Boolean)
			.join(', ');
	}

	/* 其余字段直接输出, 好让数据里的 <sub> 标签生效 */
	function html(key, raw) {
		if (key === 'symbol') return markSymbol(raw);
		if (key === 'isotope') return markIsotope(raw);
		return String(raw === undefined || raw === null ? '' : raw);
	}

	window.ElFormat = {
		label: label,
		html: html,
		plain: plain,
		markSymbol: markSymbol,
		markIsotope: markIsotope
	};
})();
