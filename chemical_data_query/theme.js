/* 在 <head> 里同步执行: 先把主题定下来, 避免页面闪一下白 */
(function () {
	try {
		var t = localStorage.getItem('theme');
		if (t !== 'light' && t !== 'dark') {
			t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		document.documentElement.setAttribute('data-theme', t);
	} catch (e) { /* 忽略 */ }
})();
