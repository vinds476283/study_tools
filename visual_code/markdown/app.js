/* ==========================================================================
   Markdown渲染 —— marked + 一个很小的白名单过滤器
   ========================================================================== */
(function () {
	'use strict';

	var md = document.getElementById('md');
	var out = document.getElementById('out');
	var status = document.getElementById('status');
	var btnClear = document.getElementById('btn-clear');
	var btnCopy = document.getElementById('btn-copy-md');

	if (!window.marked) {
		status.textContent = 'marked没能加载，检查vendor/marked目录。';
		return;
	}

	var BAD_TAGS = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|BASE|FORM|INPUT|TEXTAREA|BUTTON|SELECT)$/;

	/* marked不做净化, 这里把脚本/事件属性/javascript: 链接都去掉 */
	function sanitize(html) {
		var doc = new DOMParser().parseFromString(html, 'text/html');
		var list = doc.body.querySelectorAll('*');

		for (var i = 0; i < list.length; i++) {
			var el = list[i];

			/* 任务列表的复选框保留, 但只留type/checked/disabled */
			if (el.tagName === 'INPUT') {
				if ((el.getAttribute('type') || '').toLowerCase() === 'checkbox') {
					var keepChecked = el.hasAttribute('checked');
					var attrs0 = Array.prototype.slice.call(el.attributes);
					for (var k = 0; k < attrs0.length; k++) {
						var an = attrs0[k].name.toLowerCase();
						if (an !== 'type' && an !== 'checked') el.removeAttribute(attrs0[k].name);
					}
					el.setAttribute('type', 'checkbox');
					el.setAttribute('disabled', '');
					if (!keepChecked) el.removeAttribute('checked');
					continue;
				}
			}

			if (BAD_TAGS.test(el.tagName)) {
				el.parentNode && el.parentNode.removeChild(el);
				continue;
			}

			var attrs = Array.prototype.slice.call(el.attributes);
			for (var j = 0; j < attrs.length; j++) {
				var name = attrs[j].name.toLowerCase();
				var value = String(attrs[j].value || '').replace(/\s/g, '').toLowerCase();

				if (name.indexOf('on') === 0) {
					el.removeAttribute(attrs[j].name);
				} else if ((name === 'href' || name === 'src' || name === 'xlink:href') && value.indexOf('javascript:') === 0) {
					el.removeAttribute(attrs[j].name);
				} else if (name === 'style' && /expression\(/.test(value)) {
					el.removeAttribute(attrs[j].name);
				}
			}
		}

		return doc.body.innerHTML;
	}

	function render() {
		var text = md.value;
		if (!text.trim()) {
			out.innerHTML = '';
			status.textContent = '输入Markdown后会实时渲染';
			return;
		}
		var html;
		try {
			html = window.marked.parse(text, { gfm: true, breaks: false });
		} catch (err) {
			out.textContent = '解析失败：' + err.message;
			return;
		}
		out.innerHTML = sanitize(html);

		/* 外部链接新窗口打开 */
		var links = out.querySelectorAll('a[href]');
		for (var i = 0; i < links.length; i++) {
			var href = links[i].getAttribute('href') || '';
			if (/^https?:/i.test(href)) {
				links[i].setAttribute('target', '_blank');
				links[i].setAttribute('rel', 'noopener noreferrer');
			}
		}

		status.textContent = '已渲染 · ' + text.length + '个字符 · ' +
			out.querySelectorAll('*').length + '个节点';
	}

	var timer = null;
	md.addEventListener('input', function () {
		clearTimeout(timer);
		timer = setTimeout(render, 120);
	});

	btnClear.addEventListener('click', function () {
		md.value = '';
		render();
		md.focus();
	});

	btnCopy.addEventListener('click', function () {
		var text = md.value;
		var done = function () {
			btnCopy.textContent = '已复制';
			setTimeout(function () { btnCopy.textContent = '复制Markdown'; }, 1200);
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

	render();
})();
