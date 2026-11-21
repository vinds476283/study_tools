/* ==========================================================================
   有机分子结构式与名称
   - 画结构: JSME (BSD-3-Clause)
   - 识别 / 分子式 / 三维构象: OpenChemLib (BSD-3-Clause)
   - 三维渲染: 3Dmol.js (BSD-3-Clause) / NGL (MIT)
   全部计算都在浏览器本地完成, 不依赖任何服务器
   ========================================================================== */
(function () {
	'use strict';

	var DB = window.MOLECULES || [];
	var FORMULA_CHARS = /^[A-Za-z0-9]+$/;

	var state = {
		jsme: null,
		ocl: null,
		dbIndex: null,
		byFormula: null,
		smiles: '',
		formula: '',
		mw: 0,
		molblock: '',
		viewer3d: null,
		entry: null,
		busy: false
	};

	var el = {
		hint: document.getElementById('hint'),
		info: document.getElementById('info'),
		hits: document.getElementById('hits'),
		q: document.getElementById('q'),
		btnFind: document.getElementById('btn-find'),
		btnNetStruct: document.getElementById('btn-net-struct'),
		btnNetName: document.getElementById('btn-net-name'),
		btnCopy: document.getElementById('btn-copy'),
		netRow: document.getElementById('net-row'),
		btn3d: document.getElementById('btn-3d'),
		viewer: document.getElementById('viewer'),
		status3d: document.getElementById('r3d-status')
	};

	/* ------------------------------------------------------------ 小工具 */

	/* 页面地址 → 绝对URL。
	   有些环境（比如直接双击打开的本地文件）里相对路径 / import() 解析不到,
	   所以动态加载的脚本一律用绝对地址, 不依赖base URL。 */
	function vendorUrl(rel) {
		var href = String(location.href).split('#')[0].split('?')[0];
		var cut = href.lastIndexOf('/');
		var last = cut >= 0 ? href.slice(cut + 1) : href;
		var base;
		if (last === '') base = href;
		else if (last.indexOf('.') >= 0) base = href.slice(0, cut + 1);
		else base = href + '/';
		return base + rel;
	}

	var scriptCache = {};

	function loadScript(src) {
		if (scriptCache[src]) return scriptCache[src];
		scriptCache[src] = new Promise(function (resolve, reject) {
			var s = document.createElement('script');
			s.src = src;
			s.async = true;
			s.onload = function () { resolve(); };
			s.onerror = function () { reject(new Error('加载失败: ' + src)); };
			document.head.appendChild(s);
		});
		return scriptCache[src];
	}

	function setHint(text) { el.hint.textContent = text; }
	function setStatus(text) { el.status3d.textContent = text; }

	function fail(err) {
		var msg = err && err.message ? err.message : String(err);
		if (/没(能)?加载|加载失败|构象数据/.test(msg)) {
			setHint('结构库没能加载（' + msg + '）。建议用静态服务器（http://）打开这个页面，不要直接双击HTML文件。');
			return;
		}
		setHint('出错了：' + msg);
	}

	function themeBackground() { return document.documentElement.getAttribute('data-theme') === 'dark' ? '#000000' : '#ffffff'; }

	/* ------------------------------------------------------------ 依赖 */

	/* OpenChemLib用普通 <script> 加载 (暴露window.OCL), 不用import(),
	   这样在file:// 或者奇怪的嵌入环境里也不会出现模块说明符解析失败 */
	function ensureOCL() {
		if (window.OCL) return Promise.resolve(window.OCL);
		if (!state.ocl) {
			state.ocl = loadScript(vendorUrl('vendor/openchemlib/openchemlib.global.js')).then(function () {
				if (!window.OCL) throw new Error('OpenChemLib没能加载');
				return window.OCL;
			});
		}
		return state.ocl;
	}

	var resourcesDone = false;

	/* 三维构象需要OpenChemLib的静态资源; 这里用脚本形式而不是fetch,
	   免得本地文件打开时被CORS挡住 */
	function ensureResources(ocl) {
		if (resourcesDone) return Promise.resolve();
		return loadScript(vendorUrl('vendor/openchemlib/resources.js')).then(function () {
			if (!window.OCL_RESOURCES) throw new Error('构象数据没能加载');
			ocl.Resources.register(window.OCL_RESOURCES);
			resourcesDone = true;
		});
	}

	/* ------------------------------------------------------------ 名录索引 */

	/* 用OpenChemLib的IDCode做结构指纹: 同一个分子怎么画, 指纹都一样 */
	function buildIndex(ocl) {
		if (state.dbIndex) return state.dbIndex;
		var idx = Object.create(null);
		var byFormula = Object.create(null);
		for (var i = 0; i < DB.length; i++) {
			try {
				var m = ocl.Molecule.fromSmiles(DB[i][2]);
				idx[m.getIDCode()] = DB[i];
				var f = m.getMolecularFormula().formula;
				(byFormula[f] || (byFormula[f] = [])).push(DB[i]);
			} catch (e) { /* 单条数据有问题就跳过 */ }
		}
		state.dbIndex = idx;
		state.byFormula = byFormula;
		return idx;
	}

	function norm(s) {
		return String(s || '').toLowerCase().replace(/\s+/g, '');
	}

	function namesOf(entry) {
		return [entry[0], entry[1], entry[4]].concat(String(entry[3] || '').split('|'));
	}

	function searchByName(query) {
		var q = norm(query);
		if (!q) return [];
		var exact = [];
		var loose = [];
		for (var i = 0; i < DB.length; i++) {
			var list = namesOf(DB[i]);
			var hit = false;
			for (var j = 0; j < list.length; j++) {
				var n = norm(list[j]);
				if (n && n === q) { exact.push(DB[i]); hit = true; break; }
			}
			if (hit) continue;
			for (var k = 0; k < list.length; k++) {
				var n2 = norm(list[k]);
				if (n2 && (n2.indexOf(q) >= 0 || q.indexOf(n2) >= 0)) { loose.push(DB[i]); break; }
			}
		}
		return exact.length ? exact : loose;
	}

	function searchByFormula(query) {
		var q = String(query || '').replace(/\s+/g, '');
		if (!FORMULA_CHARS.test(q)) return [];
		var hit = state.byFormula && state.byFormula[q];
		return hit ? hit.slice() : [];
	}

	/* ------------------------------------------------------------ 信息面板 */

	function clearInfo() {
		el.info.hidden = true;
		el.info.innerHTML = '';
		el.hits.classList.add('hidden');
		el.hits.innerHTML = '';
		state.entry = null;
	}

	function row(term, value, mono, cls) {
		var div = document.createElement('div');
		if (cls) div.className = cls;
		var dt = document.createElement('dt');
		dt.textContent = term;
		var dd = document.createElement('dd');
		dd.textContent = value;
		if (mono) dd.className = 'mono';
		div.appendChild(dt);
		div.appendChild(dd);
		return div;
	}

	function renderInfo(entry) {
		clearInfo();
		state.entry = entry || null;
		el.info.appendChild(row('中文名', entry ? entry[0] : '未收录'));
		el.info.appendChild(row('英文名', entry ? entry[1] : '—'));
		/* 系统IUPAC名: 和常用英文名不一样时才多占一行 */
		if (entry && entry[4] && norm(entry[4]) !== norm(entry[1])) {
			el.info.appendChild(row('IUPAC名', entry[4], false, 'iupac-row'));
		}
		el.info.appendChild(row('分子式', state.formula));
		el.info.appendChild(row('相对分子质量', state.mw ? state.mw.toFixed(2) : '—'));
		el.info.appendChild(row('SMILES', state.smiles, true));
		el.info.hidden = false;
		if (entry) setHint('已识别：' + entry[0] + '（' + entry[1] + '）。');
		else setHint('这个结构不在本地名录里，只给出分子式与SMILES；可以点下面的「联网查IUPAC名」让服务器命名。');
	}

	/* 服务器返回的命名结果, 追加在信息面板最后 */
	function showServerName(data) {
		var old = el.info.querySelectorAll('.server-row');
		for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
		var added = 0;
		if (data.pin) {
			el.info.appendChild(row('IUPAC名（联网）', data.pin, false, 'server-row'));
			added++;
		}
		if (data.systematic && norm(data.systematic) !== norm(data.pin)) {
			el.info.appendChild(row('系统名（联网）', data.systematic, false, 'server-row'));
			added++;
		}
		el.info.hidden = false;
		return added;
	}

	/* ------------------------------------------------------------ 画布 */

	function readSmiles() {
		if (!state.jsme) return '';
		try {
			var s = state.jsme.smiles();
			return s ? String(s).trim() : '';
		} catch (e) {
			return '';
		}
	}

	function loadSmiles(smiles) {
		if (!state.jsme) return;
		try {
			state.jsme.readGenericMolecularInput(smiles);
		} catch (e) {
			setHint('这个结构没能放进画布。');
			return;
		}
		/* JSME是异步把结构放进画布的, 稍后再读一次 */
		setTimeout(onStructureChange, 300);
		setTimeout(onStructureChange, 900);
	}

	function onStructureChange() {
		var smiles = readSmiles();
		if (smiles === state.smiles) return;
		state.smiles = smiles;
		state.molblock = '';
		if (el.netRow) el.netRow.hidden = !smiles;
		if (!smiles) {
			clearInfo();
			setHint('');
			return;
		}
		analyze(smiles);
	}

	function analyze(smiles) {
		setHint('正在解析结构…');
		ensureOCL().then(function (ocl) {
			var mol;
			try {
				mol = ocl.Molecule.fromSmiles(smiles);
			} catch (e) {
				clearInfo();
				setHint('这个结构无法解析，检查一下化合价？');
				return;
			}
			var f = mol.getMolecularFormula();
			state.formula = f.formula;
			state.mw = f.relativeWeight;
			var idx = buildIndex(ocl);
			renderInfo(idx[mol.getIDCode()] || null);
		}).catch(fail);
	}

	/* ------------------------------------------------------------ 反向查结构 */

	function showHits(list) {
		el.hits.innerHTML = '';
		for (var i = 0; i < list.length; i++) {
			(function (entry) {
				var b = document.createElement('button');
				b.type = 'button';
				b.textContent = entry[0] + '（' + entry[1] + '）';
				b.addEventListener('click', function () {
					loadSmiles(entry[2]);
					el.hits.classList.add('hidden');
					setHint('已载入：' + entry[0]);
				});
				el.hits.appendChild(b);
			})(list[i]);
		}
		el.hits.classList.remove('hidden');
	}

	function tryLoadSmiles(text) {
		return ensureOCL().then(function (ocl) {
			try {
				var mol = ocl.Molecule.fromSmiles(text);
				if (!mol || !mol.getAllAtoms()) return false;
				loadSmiles(text);
				return true;
			} catch (e) {
				return false;
			}
		});
	}

	function find(query) {
		var q = String(query || '').trim();
		if (!q) { setHint('先输入点东西。'); return; }

		var hits = searchByName(q);
		if (hits.length === 1) { loadSmiles(hits[0][2]); setHint('已载入：' + hits[0][0]); return; }
		if (hits.length > 1) { showHits(hits); return; }

		var byFormula = searchByFormula(q);
		if (byFormula.length === 1) { loadSmiles(byFormula[0][2]); setHint('已载入：' + byFormula[0][0]); return; }
		if (byFormula.length > 1) { showHits(byFormula); return; }

		/* 最后当成SMILES试一次 */
		tryLoadSmiles(q).then(function (ok) {
			if (!ok) setHint('没有找到「' + q + '」。名录里只收常见分子，可以点「联网转换」交给服务器按IUPAC规则解析。');
		});
	}

	/* ------------------------------------------------------------ 联网转换
	   局域网里跑一个Python服务（server/iupac_server.py）:
	     结构 -> IUPAC名Orthonym(MIT)
	     名称 -> 结构OPSIN(MIT)
	   默认地址http://<当前主机>:8017，可用 ?api= 或localStorage('iupac_api') 覆盖 */

	var API_PORT = 8017;

	function apiBase() {
		try {
			var q = new URLSearchParams(location.search).get('api');
			if (q) return q.replace(/\/+$/, '');
			var saved = localStorage.getItem('iupac_api');
			if (saved) return saved.replace(/\/+$/, '');
		} catch (e) { /* 忽略 */ }
		var host = location.hostname || '127.0.0.1';
		return 'http://' + host + ':' + API_PORT;
	}

	/* 连不上时先探一下 /health, 好分清是"服务没启动"、"只听了本机"还是"被浏览器拦了" */
	function probeHealth(base) {
		/* no-cors: 只要服务有响应就算通, 不受跨域限制影响 */
		return fetch(base + '/health', { mode: 'no-cors', cache: 'no-store' })
			.then(function () { return true; }, function () { return false; });
	}

	function diagnoseNetwork(url, raw) {
		var base = apiBase();
		var host = base.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

		return probeHealth(base).then(function (reachable) {
			if (reachable) {
				return new Error('转换服务在跑，但这次请求被浏览器拦住了（跨域/预检）。'
					+ '换Chrome/Edge试试，或用 ?api=' + base + ' 访问本站。');
			}
			/* 当前地址不通时, 再试试本机, 区分"服务只监听了127.0.0.1" */
			if (host !== '127.0.0.1' && host !== 'localhost') {
				return probeHealth('http://127.0.0.1:' + API_PORT).then(function (localOk) {
					if (localOk) {
						return new Error('服务只监听了本机（127.0.0.1）。请用 --host 0.0.0.0重启服务，'
							+ '或者点下面的服务地址把它改成http://127.0.0.1:' + API_PORT + '。');
					}
					return new Error('连不上 ' + url + '（' + raw + '）。先在浏览器地址栏打开 '
						+ base + '/health试试：打不开就说明服务没启动。');
				});
			}
			if (location.protocol === 'https:') {
				return new Error('页面是https打开、服务是http，浏览器会拦截混合内容。'
					+ '请用http:// 访问本站，或者给服务加上https。');
			}
			return new Error('连不上 ' + url + '（' + raw + '）。先在浏览器地址栏打开 '
				+ base + '/health试试：打不开就说明服务没启动。');
		});
	}

	function apiPost(path, body, timeoutMs) {
		var url = apiBase() + path;
		var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
		var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 30000) : null;

		return fetch(url, {
			method: 'POST',
			/* text/plain属于"简单请求", 不触发预检, 少一类被拦的可能; 服务端照样按JSON解析 */
			headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
			body: JSON.stringify(body),
			mode: 'cors',
			credentials: 'omit',
			signal: ctrl ? ctrl.signal : undefined
		}).then(function (res) {
			if (timer) clearTimeout(timer);
			return res.json().catch(function () {
				throw new Error('服务返回的不是JSON（HTTP ' + res.status + '）');
			});
		}, function (err) {
			if (timer) clearTimeout(timer);
			if (err && err.name === 'AbortError') {
				return Promise.reject(new Error('转换超时（超过 ' + Math.round((timeoutMs || 30000) / 1000) + ' 秒）'));
			}
			return diagnoseNetwork(url, (err && err.message) || String(err)).then(function (e) { throw e; });
		}).then(function (data) {
			if (!data || !data.ok) throw new Error((data && data.error) || '转换失败');
			return data;
		});
	}

	function netStructure(query) {
		var q = String(query || '').trim();
		if (!q) { setHint('先在输入框里写上IUPAC名或常用名。'); return; }
		setHint('正在请服务器把「' + q + '」转成结构…');
		el.btnNetStruct.disabled = true;
		apiPost('/api/structure', { name: q }, 60000).then(function (data) {
			loadSmiles(data.smiles);
			/* 载入后analyze() 会改写提示语, 所以晚一点再报这次转换的结果 */
			setTimeout(function () {
				setHint('服务器解析成功：' + q + ' → ' + data.smiles);
			}, 1500);
		}).catch(function (err) {
			setHint('联网转换失败：' + err.message);
		}).then(function () { el.btnNetStruct.disabled = false; });
	}

	function netName() {
		var smiles = readSmiles();
		if (!smiles) { setHint('先画一个结构。'); return; }
		setHint('正在请服务器给这个结构命名…');
		el.btnNetName.disabled = true;
		el.btnNetStruct.disabled = true;
		apiPost('/api/name', { smiles: smiles }, 90000).then(function (data) {
			var n = showServerName(data);
			setHint(n ? '服务器命名完成。' : '服务器没能给出名字。');
		}).catch(function (err) {
			setHint('联网命名失败：' + err.message);
		}).then(function () {
			el.btnNetName.disabled = false;
			el.btnNetStruct.disabled = false;
		});
	}

	/* 一个按钮管两个方向:
	   输入框里写了东西 -> 名称转结构; 输入框是空的但有结构 -> 结构转名称 */
	function netConvert() {
		var q = String(el.q.value || '').trim();
		if (q) { netStructure(q); return; }
		if (readSmiles()) { netName(); return; }
		setHint('输入名称可以转成结构；或者在左边画出结构，再点这个按钮让服务器命名。');
	}

	/* ------------------------------------------------------------ 复制IUPAC名 */

	/* 取一个最靠谱的IUPAC名:
	   1) 服务器给的IUPAC名2) 本地名录里的IUPAC名3) 服务器给的系统名
	   4) 名录里的英文名（有些分子的英文名本身就是IUPAC名, 只是没单独显示一行） */
	function iupacName() {
		var order = ['IUPAC名（联网）', 'IUPAC名', '系统名（联网）'];
		var rows = el.info.querySelectorAll('div');
		var map = {};
		for (var i = 0; i < rows.length; i++) {
			var dt = rows[i].querySelector('dt');
			var dd = rows[i].querySelector('dd');
			if (dt && dd && dd.textContent) map[dt.textContent.trim()] = dd.textContent.trim();
		}
		for (var k = 0; k < order.length; k++) {
			if (map[order[k]]) return map[order[k]];
		}
		if (state.entry) return state.entry[4] || state.entry[1] || '';
		return '';
	}

	/* 局域网常常是http://192.168.x.x，不算安全上下文，navigator.clipboard用不了;
	   就算能用, 页面没焦点时它也会reject, 所以一律留一条execCommand的退路 */
	function legacyCopy(text) {
		return new Promise(function (resolve, reject) {
			var ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'fixed';
			ta.style.top = '-1000px';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			ta.setSelectionRange(0, text.length);
			var ok = false;
			try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
			document.body.removeChild(ta);
			ok ? resolve() : reject(new Error('浏览器不允许复制'));
		});
	}

	function copyText(text) {
		if (navigator.clipboard && window.isSecureContext && navigator.clipboard.writeText) {
			return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
		}
		return legacyCopy(text);
	}

	function copyIupacName() {
		var name = iupacName();
		if (!name) {
			setHint('还没拿到IUPAC名：点「联网查IUPAC名」让服务器命名，或者直接输入一个名录里的分子。');
			return;
		}
		copyText(name).then(function () {
			var old = el.btnCopy.textContent;
			el.btnCopy.textContent = '已复制';
			setTimeout(function () { el.btnCopy.textContent = old; }, 1500);
		}).catch(function (err) {
			setHint('复制失败：' + err.message);
		});
	}

	/* ------------------------------------------------------------ 三维 */

	function teardown3d() {
		if (state.viewer3d) {
			try { state.viewer3d.clear(); } catch (e) { /* 忽略 */ }
			state.viewer3d = null;
		}
		el.viewer.innerHTML = '';
	}

	function render3Dmol(block) {
		return loadScript(vendorUrl('vendor/3dmol/3Dmol-min.js')).catch(function () { /* 可能已经加载过 */ }).then(function () {
			if (!window.$3Dmol) throw new Error('3Dmol.js没能加载');
			var viewer = window.$3Dmol.createViewer(el.viewer, {
				backgroundColor: themeBackground(),
				backgroundAlpha: 1
			});
			viewer.addModel(block, 'sdf');
			viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.28 } });
			viewer.zoomTo();
			viewer.zoom(0.9);
			viewer.render();
			state.viewer3d = viewer;
		});
	}

	function render3D(block) {
		teardown3d();
		return render3Dmol(block).catch(function (err) {
			teardown3d();
			var note = document.createElement('div');
			note.className = 'viewer-fallback';
			note.textContent = '这个浏览器没能启动三维渲染（' + (err && err.message ? err.message : '未知原因') + '），可能是显卡/WebGL被禁用了。';
			el.viewer.appendChild(note);
			throw err;
		});
	}

	function make3D() {
		var smiles = readSmiles();
		if (!smiles) { setStatus('先在左边画出结构。'); return; }
		if (state.busy) return;
		state.busy = true;
		el.btn3d.disabled = true;
		setStatus('正在计算三维构象…');

		ensureOCL().then(function (ocl) {
			return ensureResources(ocl).then(function () {
				/* 让"计算中"先渲染出来, 构象生成本身是同步的 */
				return new Promise(function (resolve) { setTimeout(resolve, 40); });
			}).then(function () {
				var mol = ocl.Molecule.fromSmiles(smiles);
				var conf = new ocl.ConformerGenerator(0.5);
				var m3 = conf.getOneConformerAsMolecule(mol);
				if (!m3) throw new Error('无法生成三维构象');
				state.molblock = m3.toMolfile();
				return render3D(state.molblock).then(function () {
					setStatus('已渲染，可拖动旋转、滚轮缩放。');
				});
			});
		}).catch(function (err) {
			setStatus('生成失败：' + (err && err.message ? err.message : err));
		}).then(function () {
			state.busy = false;
			el.btn3d.disabled = false;
		});
	}

	/* ------------------------------------------------------------ 尺寸 */

	function resizeJsme() {
		if (!state.jsme) return;
		var host = document.getElementById('jsme-host');
		var w = host.clientWidth;
		var h = host.clientHeight;
		if (!w || !h) return;
		try {
			if (typeof state.jsme.setSize === 'function') state.jsme.setSize(w, h);
			else {
				if (typeof state.jsme.setWidth === 'function') state.jsme.setWidth(w);
				if (typeof state.jsme.setHeight === 'function') state.jsme.setHeight(h);
			}
		} catch (e) { /* 忽略 */ }
	}

	function resizeViewer() {
		if (state.viewer3d) {
			try { state.viewer3d.resize(); state.viewer3d.render(); } catch (e) { /* 忽略 */ }
		}
	}

	var resizeTimer = null;

	window.addEventListener('resize', function () {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(function () { resizeJsme(); resizeViewer(); }, 180);
	});

	/* ------------------------------------------------------------ 主题 */

	new MutationObserver(function () {
		if (state.molblock) render3D(state.molblock).catch(function () { /* 忽略 */ });
	}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

	/* ------------------------------------------------------------ 事件 */

	el.btnFind.addEventListener('click', function () { find(el.q.value); });
	el.q.addEventListener('keydown', function (ev) {
		if (ev.key === 'Enter') { ev.preventDefault(); find(el.q.value); }
	});

	el.btnNetStruct.addEventListener('click', netConvert);
	el.btnNetName.addEventListener('click', netName);
	el.btnCopy.addEventListener('click', copyIupacName);

	el.btn3d.addEventListener('click', make3D);

	/* ------------------------------------------------------------ JSME */

	window.jsmeOnLoad = function () {
		var host = document.getElementById('jsme-host');
		var w = Math.max(host.clientWidth, 240);
		var h = Math.max(host.clientHeight, 240);
		try {
			state.jsme = new window.JSApplet.JSME('jsme-host', w + 'px', h + 'px');
		} catch (e) {
			setHint('画布没能启动，请刷新页面重试。');
			return;
		}
		window.__jsme = state.jsme;
		setTimeout(onStructureChange, 300);
		/* 这个构建的 "结构变化" 回调会把页面卡死, 所以改成轮询: 每700ms读一次SMILES */
		setInterval(function () {
			if (document.hidden) return;
			onStructureChange();
		}, 700);
	};
})();
