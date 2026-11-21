/* ==========================================================================
   可视化公式编辑 —— MathLive
   编辑框内容变化 -> 同步输出TeX
   ========================================================================== */
(function () {
	'use strict';

	var mf = document.getElementById('mf');
	var out = document.getElementById('tex-out');
	var status = document.getElementById('status');
	var btnCopy = document.getElementById('btn-copy');
	var btnClear = document.getElementById('btn-clear');
	var wrap = document.getElementById('wrap');

	if (!window.MathfieldElement) {
		status.textContent = 'MathLive没能加载，检查vendor/mathlive目录。';
		return;
	}

	/* 字体和按键音都从本地读, 不走CDN; 界面语言用自带的简体中文 */
	try {
		window.MathfieldElement.fontsDirectory = '../vendor/mathlive/fonts';
		window.MathfieldElement.soundsDirectory = '../vendor/mathlive/sounds';
		window.MathfieldElement.locale = 'zh-cn';
	} catch (e) { /* 忽略 */ }

	function sync() {
		out.value = mf.value || '';
		status.textContent = '共' + (mf.value || '').length + '个字符';
	}

	mf.addEventListener('input', sync);
	sync();

	btnClear.addEventListener('click', function () {
		mf.value = '';
		sync();
		mf.focus();
	});

	function texToCopy() {
		var v = mf.value || '';
		return wrap.checked ? '$$\n' + v + '\n$$' : v;
	}

	btnCopy.addEventListener('click', function () {
		var text = texToCopy();
		var done = function () {
			btnCopy.textContent = '已复制';
			setTimeout(function () { btnCopy.textContent = '复制TeX'; }, 1200);
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
})();
