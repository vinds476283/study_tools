/* ==========================================================================
   手写公式识别 —— 画板 + ink-on（CoMER / ONNX Runtime Web）
   全部在本地跑: 模型7 MB + wasm 15 MB只下载一次, 之后走浏览器缓存
   ========================================================================== */
(function () {
	'use strict';

	var board = document.getElementById('board');
	var status = document.getElementById('status');
	var texOut = document.getElementById('tex');
	var preview = document.getElementById('preview');
	var btnRec = document.getElementById('btn-rec');
	var btnUndo = document.getElementById('btn-undo');
	var btnClear = document.getElementById('btn-clear');
	var modeSel = document.getElementById('mode');
	var btnCopy = document.getElementById('btn-copy');

	var InkOn = window.InkOn;
	var ort = window.ort;

	/* ------------------------------------------------------------ 画板 */

	var ctx = board.getContext('2d');
	var strokes = [];        /* [{ lineWidth, points: [{x,y}] }] */
	var current = null;
	var dpr = window.devicePixelRatio || 1;

	function resize() {
		var rect = board.getBoundingClientRect();
		var w = Math.max(1, Math.round(rect.width));
		var h = Math.max(1, Math.round(rect.height));
		dpr = window.devicePixelRatio || 1;
		board.width = Math.round(w * dpr);
		board.height = Math.round(h * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		paint();
	}

	function paint() {
		var w = board.width / dpr;
		var h = board.height / dpr;
		ctx.fillStyle = '#111';
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = '#fff';
		ctx.fillStyle = '#fff';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		for (var i = 0; i < strokes.length; i++) {
			var pts = strokes[i].points;
			if (!pts.length) continue;
			ctx.lineWidth = strokes[i].lineWidth;
			ctx.beginPath();
			ctx.moveTo(pts[0].x, pts[0].y);
			for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
			ctx.stroke();
			if (pts.length === 1) {
				ctx.beginPath();
				ctx.arc(pts[0].x, pts[0].y, strokes[i].lineWidth / 2, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}

	function pos(e) {
		var rect = board.getBoundingClientRect();
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
	}

	board.addEventListener('pointerdown', function (e) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		e.preventDefault();
		try { board.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件没有真实指针id */ }
		current = { lineWidth: 3.5, points: [pos(e)] };
		strokes.push(current);
		paint();
	});

	board.addEventListener('pointermove', function (e) {
		if (!current) return;
		e.preventDefault();
		var p = pos(e);
		var last = current.points[current.points.length - 1];
		if (Math.abs(p.x - last.x) < 1.2 && Math.abs(p.y - last.y) < 1.2) return;
		current.points.push(p);
		paint();
	});

	function endStroke(e) {
		if (!current) return;
		if (e && e.pointerType === 'mouse' && e.button !== 0) return;
		current = null;
		try { board.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
	}

	board.addEventListener('pointerup', endStroke);
	board.addEventListener('pointercancel', endStroke);
	board.addEventListener('pointerleave', function (e) { if (current) endStroke(e); });

	window.addEventListener('resize', resize);

	/* ------------------------------------------------------------ 预览 */

	function renderPreview() {
		var text = texOut.value.trim();
		preview.innerHTML = '';
		if (!text) return;
		var div = document.createElement('div');
		try {
			window.katex.render(text, div, {
				throwOnError: false,
				displayMode: true,
				strict: false
			});
		} catch (err) {
			div.className = 'vc-error';
			div.textContent = err.message;
		}
		preview.appendChild(div);
	}

	texOut.addEventListener('input', renderPreview);

	/* ------------------------------------------------------------ 识别 */

	var vocab = null;
	var engine = null;
	var loading = null;

	function setStatus(text) { status.textContent = text; }

	/* 把 .mjs读成文本再走blob, 这样服务器不配 .mjs的MIME也能用 */
	function setupOrt() {
		return fetch('vendor/ort/ort-wasm-simd-threaded.mjs')
			.then(function (r) { return r.text(); })
			.then(function (text) {
				var blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
				ort.env.wasm.numThreads = 1;
				ort.env.wasm.simd = true;
				ort.env.wasm.wasmPaths = {
					'ort-wasm-simd-threaded.mjs': blobUrl,
					'ort-wasm-simd-threaded.wasm': new URL('vendor/ort/ort-wasm-simd-threaded.wasm', location.href).href
				};
			});
	}

	function prepare() {
		if (engine) return Promise.resolve(engine);
		if (loading) return loading;

		loading = setupOrt().then(function () {
			return InkOn.loadVocab('models/vocab.json');
		}).then(function (v) {
			vocab = v;
			engine = new InkOn.InferenceEngine({
				encoderUrl: 'models/encoder_int8.onnx',
				decoderUrl: 'models/decoder_int8.onnx'
			});
			return engine.init();
		}).then(function () {
			return engine;
		}).catch(function (err) {
			loading = null;
			throw err;
		});

		return loading;
	}

	function recognize() {
		if (!strokes.length) {
			setStatus('先在黑板上写点东西。');
			return;
		}
		if (!InkOn || !ort) {
			setStatus('识别引擎没加载成功，检查vendor/ort和ink.js。');
			return;
		}

		btnRec.disabled = true;
		setStatus('正在加载模型…');

		prepare().then(function () {
			setStatus('识别中…');
			var pre = InkOn.preprocessStrokes(strokes);
			return engine.recognize(pre, vocab, modeSel.value);
		}).then(function (res) {
			texOut.value = res.latex || '';
			renderPreview();
			setStatus('识别完成 · ' + Math.round(res.totalMs) + ' ms（编码' + Math.round(res.encoderMs) +
				' ms，解码' + Math.round(res.decoderMs) + ' ms）');
		}).catch(function (err) {
			setStatus('识别失败：' + (err && err.message ? err.message : err));
		}).then(function () {
			btnRec.disabled = false;
		});
	}

	btnRec.addEventListener('click', recognize);

	btnUndo.addEventListener('click', function () {
		if (!strokes.length) return;
		strokes.pop();
		current = null;
		paint();
		setStatus('已撤销一笔，共 ' + strokes.length + ' 笔。');
	});

	btnClear.addEventListener('click', function () {
		strokes = [];
		current = null;
		paint();
		setStatus('已清空。');
	});

	btnCopy.addEventListener('click', function () {
		var text = texOut.value;
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

	resize();
	renderPreview();
})();
