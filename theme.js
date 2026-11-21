/* ==========================================================================
   铟子vinds学习工具 — 主题
   在 <head> 里同步执行: 先把主题定下来, 避免页面闪一下白
   同时负责白天 / 夜间模式按钮
   ========================================================================== */
(function () {
	'use strict';

	var KEY = 'theme';

	function read() {
		try {
			var t = localStorage.getItem(KEY);
			if (t === 'light' || t === 'dark') return t;
		} catch (e) { /* 忽略 */ }
		return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	function apply(theme) {
		document.documentElement.setAttribute('data-theme', theme);
		var btn = document.getElementById('theme-btn');
		if (btn) {
			btn.textContent = theme === 'dark' ? '☀' : '☾';
			btn.setAttribute('aria-label', theme === 'dark' ? '切换到白天模式' : '切换到夜间模式');
		}
	}

	apply(read());

	function bind() {
		var btn = document.getElementById('theme-btn');
		if (!btn) return;
		/* 按钮是后加载的, 进来先把图标同步成当前主题 */
		apply(document.documentElement.getAttribute('data-theme') || read());
		btn.addEventListener('click', function () {
			var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
			try { localStorage.setItem(KEY, next); } catch (e) { /* 忽略 */ }
			apply(next);
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', bind);
	} else {
		bind();
	}
})();
