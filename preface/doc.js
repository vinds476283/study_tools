/* ==========================================================================
   前言页 —— 读取同目录的preface.md, 渲染成HTML
   只用到一个很小的Markdown子集: 标题 / 段落 / 列表 / 引用 / 代码块 /
   表格 / 分隔线 / 行内 `code` **粗体** [链接](url)
   ========================================================================== */
(function () {
	'use strict';

	var host = document.getElementById('content');
	var src = document.body.getAttribute('data-md') || 'preface.md';

	function esc(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	/* 行内标记: 先取出行内代码, 免得里面的 ** 和 [] 被误处理 */
	function inline(text) {
		var codes = [];
		var out = esc(text).replace(/`([^`]+)`/g, function (m, code) {
			codes.push(code);
			return '\u0000' + (codes.length - 1) + '\u0000';
		});

		/* 允许作者写 <br> / <br /> 换行 */
		out = out.replace(/&lt;br\s*\/?&gt;/gi, '<br>');

		out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

		/* 先处理markdown链接, 结果先存起来, 免得下面自动链接把href又包一层 */
		var anchors = [];
		out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, href) {
			var ext = /^https?:/i.test(href);
			anchors.push('<a href="' + href + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label + '</a>');
			return '\u0001' + (anchors.length - 1) + '\u0001';
		});

		/* 裸链接 (表格里直接写URL的情况) 自动变成可点的链接 */
		out = out.replace(/https?:\/\/[^\s<>"'\u0000\u0001]+/g, function (url) {
			var tail = '';
			var m = url.match(/[.,;:!?，。；：、）)]+$/);
			if (m) { tail = m[0]; url = url.slice(0, -tail.length); }
			return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>' + tail;
		});

		out = out.replace(/\u0001(\d+)\u0001/g, function (m, i) { return anchors[+i]; });

		return out.replace(/\u0000(\d+)\u0000/g, function (m, i) {
			return '<code>' + codes[+i] + '</code>';
		});
	}

	function cells(line) {
		return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
	}

	function render(md) {
		var lines = md.replace(/\r\n?/g, '\n').split('\n');
		var html = [];
		var i = 0;

		while (i < lines.length) {
			var line = lines[i];

			if (!line.trim()) { i++; continue; }

			/* 围栏代码块 */
			if (/^\s*```/.test(line)) {
				var buf = [];
				i++;
				while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
				i++;
				html.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
				continue;
			}

			/* 标题 */
			var h = line.match(/^(#{1,6})\s+(.*)$/);
			if (h) {
				var lv = h[1].length;
				html.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>');
				i++;
				continue;
			}

			/* 分隔线 */
			if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { html.push('<hr>'); i++; continue; }

			/* 引用 */
			if (/^>\s?/.test(line)) {
				var quote = [];
				while (i < lines.length && /^>\s?/.test(lines[i])) {
					quote.push(lines[i].replace(/^>\s?/, ''));
					i++;
				}
				html.push('<blockquote>' + render(quote.join('\n')) + '</blockquote>');
				continue;
			}

			/* 表格 */
			if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
				var head = cells(line);
				i += 2;
				var body = [];
				while (i < lines.length && /^\s*\|/.test(lines[i])) { body.push(cells(lines[i])); i++; }
				var thead = '<tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr>';
				var tbody = body.map(function (r) {
					return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
				}).join('');
				html.push('<div class="table-wrap"><table><thead>' + thead +
					'</thead><tbody>' + tbody + '</tbody></table></div>');
				continue;
			}

			/* 无序列表 */
			if (/^\s*[-*+]\s+/.test(line)) {
				var items = [];
				while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
					items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
					i++;
				}
				html.push('<ul>' + items.map(function (t) { return '<li>' + inline(t) + '</li>'; }).join('') + '</ul>');
				continue;
			}

			/* 有序列表 */
			if (/^\s*\d+\.\s+/.test(line)) {
				var oitems = [];
				while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
					oitems.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
					i++;
				}
				html.push('<ol>' + oitems.map(function (t) { return '<li>' + inline(t) + '</li>'; }).join('') + '</ol>');
				continue;
			}

			/* 段落: 一直吃到空行或者下一个块的开头 */
			var para = [];
			while (i < lines.length && lines[i].trim() &&
				!/^\s*(#{1,6}\s|```|>|\||[-*+]\s|\d+\.\s)/.test(lines[i])) {
				para.push(lines[i]);
				i++;
			}
			if (para.length) html.push('<p>' + inline(para.join(' ')) + '</p>');
			else i++;   /* 兜底, 防止卡死 */
		}

		return html.join('\n');
	}

	function fail(err) {
		host.innerHTML = '<p class="status">读取 ' + esc(src) + ' 失败（' + esc(err.message) + '）。<br>' +
			'用静态服务器（http://）访问这个页面即可正常显示；直接双击HTML时浏览器会拦下本地文件的fetch。</p>';
	}

	fetch(src, { cache: 'no-store' }).then(function (res) {
		if (!res.ok) throw new Error('HTTP ' + res.status);
		return res.text();
	}).then(function (md) {
		host.innerHTML = render(md);
	}).catch(fail);
})();
