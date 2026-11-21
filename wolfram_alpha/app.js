/* ==========================================================================
   Wolfram|Alpha 页面
   页面本身不接触 App ID：只把 token 和要算的内容发给局域网里的代理服务，
   由服务去调 Wolfram|Alpha，并记录每个 token 每天的次数。
   ========================================================================== */
(function () {
	'use strict';

	var el = {
		token: document.getElementById('token'),
		query: document.getElementById('query'),
		run: document.getElementById('btn-run'),
		clear: document.getElementById('btn-clear'),
		output: document.getElementById('output'),
		quota: document.getElementById('quota'),
		ping: document.getElementById('btn-ping'),
		pingNote: document.getElementById('ping-note')
	};

	var state = {
		quota: null,     /* {ok, remaining, used, limit} */
		ping: null,      /* {ok, ms} —— 连通性测试结果 */
		pingBusy: false,
		busy: false,
		timer: null
	};

	/* ------------------------------------------------------------ 服务地址 */

	function apiBase() {
		var fromQuery = '';
		try {
			fromQuery = new URLSearchParams(location.search).get('api') || '';
		} catch (e) { /* 忽略 */ }

		if (fromQuery) {
			try { localStorage.setItem('wa_api', fromQuery); } catch (e) { /* 忽略 */ }
			return fromQuery.replace(/\/+$/, '');
		}

		var saved = '';
		try { saved = localStorage.getItem('wa_api') || ''; } catch (e) { /* 忽略 */ }
		if (saved) return saved.replace(/\/+$/, '');

		var host = location.hostname || '127.0.0.1';
		return 'http://' + host + ':8018';
	}

	var BASE = apiBase();

	function post(path, body) {
		return fetch(BASE + path, {
			method: 'POST',
			headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
			body: JSON.stringify(body),
			cache: 'no-store'
		}).then(function (res) {
			return res.text().then(function (text) {
				var data;
				try {
					data = JSON.parse(text);
				} catch (e) {
					throw new Error('服务返回的不是 JSON（HTTP ' + res.status + '）');
				}
				return data;
			});
		});
	}

	/* ------------------------------------------------------------ 界面状态 */

	function setQuota(text, kind) {
		el.quota.textContent = text;
		el.quota.className = 'wa-note' + (kind ? ' ' + kind : '');
	}

	function setOutput(text, bad) {
		el.output.textContent = text || '';
		el.output.className = 'wa-output' + (bad ? ' bad' : '');
	}

	function canRun() {
		return !state.busy &&
			!!state.ping && state.ping.ok === true &&
			!!state.quota && state.quota.ok === true && state.quota.remaining > 0 &&
			el.token.value.trim() !== '' &&
			el.query.value.trim() !== '';
	}

	function syncButton() {
		el.run.disabled = !canRun();
	}

	function applyQuota(data) {
		state.quota = data && data.ok ? data : null;

		if (!data) return;

		if (data.ok) {
			setQuota('今天还剩 ' + data.remaining + ' / ' + data.limit + ' 次', 'good');
		} else {
			setQuota(data.error || 'token 不可用', 'bad');
		}
		syncButton();
	}

	/* ------------------------------------------------------------ 查余额 */

	function refreshQuota() {
		var token = el.token.value.trim();
		state.quota = null;
		syncButton();

		if (!token) {
			setQuota('每个 token 每天可以计算 5 次。');
			return;
		}

		post('/api/quota', { token: token })
			.then(applyQuota)
			.catch(function () {
				state.quota = null;
				setQuota('连不上计算服务（' + BASE + '），请确认服务已启动。', 'bad');
			});
	}

	/* ------------------------------------------------------------ 计算 */

	function run() {
		if (!canRun()) return;

		var token = el.token.value.trim();
		var input = el.query.value.trim();

		state.busy = true;
		syncButton();
		el.run.textContent = '计算中…';
		setOutput('正在问 Wolfram|Alpha …', false);

		post('/api/query', { token: token, input: input })
			.then(function (data) {
				if (data && typeof data.remaining === 'number') {
					applyQuota({
						ok: true,
						remaining: data.remaining,
						limit: data.limit,
						used: data.used
					});
				}

				if (data && data.ok) {
					setOutput(data.result, false);
				} else {
					setOutput((data && data.error) ? data.error : '计算失败，稍后再试。', true);
				}
			})
			.catch(function (err) {
				setOutput('连不上计算服务（' + BASE + '）。\n' + (err && err.message ? err.message : ''), true);
			})
			.then(function () {
				state.busy = false;
				el.run.textContent = '计算';
				syncButton();
			});
	}

	/* ------------------------------------------------------------ 连通性测试 */

	function setPingNote(text, kind) {
		el.pingNote.textContent = text;
		el.pingNote.className = 'wa-hint' + (kind ? ' ' + kind : '');
	}

	/* 失败时红色文字本身就是链接，点开是服务端的 /test 诊断页 */
	function setPingFail(text) {
		el.pingNote.className = 'wa-hint bad';
		el.pingNote.textContent = '';

		var link = document.createElement('a');
		link.href = BASE + '/test';
		link.target = '_blank';
		link.rel = 'noopener';
		link.textContent = text;
		link.title = '打开请求诊断页';

		el.pingNote.appendChild(link);
	}

	function ping() {
		/* 测试通过之后就不再让点了 */
		if (state.pingBusy || (state.ping && state.ping.ok)) return;

		state.pingBusy = true;
		state.ping = null;
		syncButton();
		el.ping.disabled = true;
		setPingNote('测试中… 最多等 30 秒', '');

		post('/api/ping', {})
			.then(function (data) {
				if (data && data.ok) {
					state.ping = { ok: true, ms: data.ms };
					setPingNote('测试成功，耗时：' + data.ms + 'ms。', 'good');
				} else {
					state.ping = null;
					setPingFail('测试失败: ' + ((data && data.error) ? data.error : '原因不明'));
				}
			})
			.catch(function (err) {
				state.ping = null;
				setPingFail('连不上计算服务（' + BASE + '）');
			})
			.then(function () {
				state.pingBusy = false;
				/* 成功了就把按钮锁死；失败了还能再试 */
				el.ping.disabled = !!(state.ping && state.ping.ok);
				syncButton();
			});
	}

	/* ------------------------------------------------------------ 事件 */

	el.ping.addEventListener('click', ping);

	el.token.addEventListener('input', function () {
		try { localStorage.setItem('wa_token', el.token.value.trim()); } catch (e) { /* 忽略 */ }
		clearTimeout(state.timer);
		state.timer = setTimeout(refreshQuota, 350);
		syncButton();
	});

	el.query.addEventListener('input', syncButton);

	el.query.addEventListener('keydown', function (e) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			run();
		}
	});

	el.run.addEventListener('click', run);

	el.clear.addEventListener('click', function () {
		el.query.value = '';
		setOutput('', false);
		syncButton();
		el.query.focus();
	});

	/* 打开页面时把上次的 token 填回去 */
	try {
		var saved = localStorage.getItem('wa_token') || '';
		if (saved) el.token.value = saved;
	} catch (e) { /* 忽略 */ }

	if (el.token.value) refreshQuota();
	syncButton();
})();
