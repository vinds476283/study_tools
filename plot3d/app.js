/* ==========================================================================
   3D 绘图
   - 函数曲面 z = f(x, y)、空间曲线 r(t)
   - 鼠标拖动旋转、滚轮缩放、右键平移
   - 视角：x± / y± / z± / 等轴 / 任意 hkl；正交与透视可切换
   - 测量：距离、向量、夹角、二面角、法向量、平面方程
   渲染用 three.js（MIT），没有构建步骤，全部离线可用。
   ========================================================================== */

import * as THREE from './vendor/three/three.module.min.js';

/* ------------------------------------------------------------ 小工具 */

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const PI = Math.PI;

function numOf(el, fallback) {
	const v = parseFloat(el.value);
	return Number.isFinite(v) ? v : fallback;
}


function vecText(v) {
	const one = (c) => { const e = exactForm(c); return e !== null ? e : String(Number(c.toFixed(3))); };
	return '(' + one(v.x) + ', ' + one(v.y) + ', ' + one(v.z) + ')';
}

/* ------------------------------------------------------------ 精确数字 */

function gcd(a, b) {
	a = Math.abs(a);
	b = Math.abs(b);
	while (b) {
		const t = a % b;
		a = b;
		b = t;
	}
	return a || 1;
}

/* 连分式找一个能整除的分数 p/q */
function toRational(x, tol, maxDen) {
	if (!Number.isFinite(x)) return null;
	if (Math.abs(x) < 1e-13) return [0, 1];

	const sign = x < 0 ? -1 : 1;
	x = Math.abs(x);

	let h1 = 1;
	let h0 = 0;
	let k1 = 0;
	let k0 = 1;
	let b = x;

	for (let i = 0; i < 40; i++) {
		const a = Math.floor(b);
		const h2 = a * h1 + h0;
		const k2 = a * k1 + k0;
		if (k2 > maxDen) break;
		h0 = h1;
		h1 = h2;
		k0 = k1;
		k1 = k2;
		if (k1 > 0 && Math.abs(x - h1 / k1) <= tol * Math.max(1, x)) break;
		const frac = b - a;
		if (frac < 1e-12) break;
		b = 1 / frac;
	}

	if (k1 === 0) return null;
	if (Math.abs(x - h1 / k1) > tol * Math.max(1, x) * 10) return null;
	return [sign * h1, k1];
}

/* n = s²·m，返回 [s, m] */
function squarePart(n) {
	if (!Number.isSafeInteger(n) || n <= 0) return null;
	if (n > 1e10) return null;
	let s = 1;
	let m = n;
	for (let i = 2; i * i <= m; i++) {
		while (m % (i * i) === 0) {
			m /= i * i;
			s *= i;
		}
	}
	return [s, m];
}

function rationalText(p, q) {
	if (q < 0) {
		p = -p;
		q = -q;
	}
	if (q === 1) return String(p);
	return p + '/' + q;
}

/* 精确形式：整数 / 分数 / 根式；实在不行返回 null */
function exactForm(v) {
	if (!Number.isFinite(v)) return null;
	if (Math.abs(v) < 5e-13) return '0';

	const r = toRational(v, 1e-12, 1000);
	if (r) return rationalText(r[0], r[1]);

	const r2 = toRational(v * v, 1e-9, 100000);
	if (!r2) return null;

	/* v = ±√(p/q) = ±√(p·q)/q */
	const root = squarePart(r2[0] * r2[1]);
	if (!root) return null;

	let s = root[0];
	let m = root[1];
	let q = r2[1];
	const g = gcd(s, q);
	s /= g;
	q /= g;

	const sign = v < 0 ? '-' : '';
	const head = s === 1 ? '' : String(s);

	if (m === 1) return sign + rationalText(s, q);
	if (q === 1) return sign + head + '√' + m;
	return sign + head + '√' + m + '/' + q;
}




/* 把一个向量化整：所有分量乘同一个数变成整数，再约掉公因数 */
function integerize(v) {
	const parts = [v.x, v.y, v.z].map((c) => (Math.abs(c) < 1e-12 ? [0, 1] : toRational(c, 1e-9, 1000)));
	if (parts.some((p) => !p)) return null;

	let lcm = 1;
	for (const [, q] of parts) lcm = (lcm * q) / gcd(lcm, q);

	const ints = parts.map(([p, q]) => Math.round((p * lcm) / q));
	const g = ints.reduce((acc, n) => gcd(acc, Math.abs(n)), 0) || 1;
	return ints.map((n) => n / g);
}
/* 给 KaTeX 用的精确写法 */
function fracLatex(p, q, suffix) {
	if (q < 0) {
		p = -p;
		q = -q;
	}
	const sfx = suffix || '';
	if (q === 1) return String(p) + sfx;
	return (p < 0 ? '-' : '') + '\\frac{' + Math.abs(p) + sfx + '}{' + q + '}';
}

function exactLatex(v, suffix) {
	const sfx = suffix || '';
	if (!Number.isFinite(v)) return '?';
	if (Math.abs(v) < 5e-13) return '0' + sfx;

	const r = toRational(v, 1e-12, 1000);
	if (r) return fracLatex(r[0], r[1], sfx);

	const r2 = toRational(v * v, 1e-9, 100000);
	if (r2) {
		const root = squarePart(r2[0] * r2[1]);
		if (root) {
			let s = root[0];
			const m = root[1];
			let q = r2[1];
			const g = gcd(s, q);
			s /= g;
			q /= g;
			const sign = v < 0 ? '-' : '';
			const rad = (s === 1 ? '' : String(s)) + '\\sqrt{' + m + '}';
			if (m === 1) return sign + fracLatex(s, q, sfx);
			if (q === 1) return sign + rad + sfx;
			return sign + '\\frac{' + rad + sfx + '}{' + q + '}';
		}
	}
	return String(Number(v.toFixed(3))) + sfx;
}

function vecLatex(v) {
	return '\\left(' + [v.x, v.y, v.z].map((c) => exactLatex(c)).join(',\\ ') + '\\right)';
}

function num4(x) {
	return String(Number(x.toFixed(4)));
}

/* 角度：五个数值（角度、弧度、sin、cos、tan） */
function angleParts(deg) {
	if (!Number.isFinite(deg)) return { latex: '\\text{--}', tail: '' };
	const rad = (deg * PI) / 180;
	const s = Math.sin(rad);
	const c = Math.cos(rad);
	const head = Number(deg.toFixed(2)) + '^{\\circ}=' + num4(rad) + '\\ \\mathrm{rad}';
	const trig = '\\sin=' + num4(s) + ',\\quad \\cos=' + num4(c);
	if (Math.abs(c) < 1e-9) return { latex: head + ',\\quad ' + trig, tail: '，tan 不存在' };
	return { latex: head + ',\\quad ' + trig + ',\\quad \\tan=' + num4(Math.tan(rad)), tail: '' };
}

function planeLatex(ints, P) {
	const names = ['x', 'y', 'z'];
	let s = '';
	for (let i = 0; i < 3; i++) {
		const c = ints[i];
		if (c === 0) continue;
		const mag = Math.abs(c) === 1 ? '' : String(Math.abs(c));
		const body = mag + names[i];
		if (s === '') s = (c < 0 ? '-' : '') + body;
		else s += (c < 0 ? '-' : '+') + body;
	}
	if (s === '') return '0=0';
	const d = ints[0] * P.x + ints[1] * P.y + ints[2] * P.z;
	return s + '=' + exactLatex(d);
}

/* 数值量：能写成简单分数就精确写，否则用 ≈ */
function approxLatex(v) {
	const r = toRational(v, 1e-9, 64);
	if (r) return '=' + fracLatex(r[0], r[1]);
	return '\\approx ' + Number(v.toFixed(3));
}

function renderMath(el, latex) {
	el.textContent = '';
	if (window.katex && typeof window.katex.renderToString === 'function') {
		try {
			el.innerHTML = window.katex.renderToString(latex, {
				throwOnError: false,
				displayMode: false,
				strict: false,
			});
			return;
		} catch (err) {
			/* 落到纯文本 */
		}
	}
	el.textContent = latex;
}
/* ------------------------------------------------------------ 表达式 */

const MATH_SCOPE = {
	PI: Math.PI, pi: Math.PI, E: Math.E, e: Math.E, TAU: Math.PI * 2,
	sin: Math.sin, cos: Math.cos, tan: Math.tan,
	asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
	sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
	exp: Math.exp, log: Math.log, ln: Math.log, lg: Math.log10, log10: Math.log10, log2: Math.log2,
	sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, pow: Math.pow, sign: Math.sign,
	floor: Math.floor, ceil: Math.ceil, round: Math.round, hypot: Math.hypot,
	min: Math.min, max: Math.max,
};

/* 把用户写的式子变成函数；^ 当乘方，π 当 PI */
function compileExpr(vars, expr) {
	const raw = String(expr || '').trim();
	if (!raw) throw new Error('式子是空的');

	const code = raw
		.replace(/\^/g, '**')
		.replace(/π/g, 'PI')
		.replace(/√/g, 'sqrt');

	let fn;
	try {
		fn = new Function('MATH', vars.join(','), 'with (MATH) { return (' + code + '); }');
	} catch (err) {
		throw new Error('式子写错了：' + err.message);
	}

	const probe = vars.map(() => 0.5);
	const test = fn(MATH_SCOPE, ...probe);
	if (typeof test !== 'number' && typeof test !== 'boolean') {
		throw new Error('式子算出来不是数字');
	}
	return (...args) => fn(MATH_SCOPE, ...args);
}

/* ------------------------------------------------------------ 状态 */

const S = {
	theta: -PI / 4,
	phi: PI / 3,
	radius: 18,
	target: new THREE.Vector3(0, 0, 0),
	ortho: true,
	oblique: false,
	colors: {},
	points: [],
	selected: [],
	dragging: null,
	moved: 0,
	surface: null,
	curve: null,
};

/* ------------------------------------------------------------ 场景 */

const canvas = $('p3-canvas');
let renderer = null;

try {
	renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (err) {
	$('measure').textContent = '这个浏览器不支持 WebGL，换个浏览器（Edge / Chrome）再试。';
	throw err;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
const camP = new THREE.PerspectiveCamera(45, 1, 0.05, 8000);
const camO = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 8000);

const gridGroup = new THREE.Group();
const axisGroup = new THREE.Group();
const contentGroup = new THREE.Group();
const pointGroup = new THREE.Group();
const helperGroup = new THREE.Group();
const buildGroup = new THREE.Group();
const builds = [];

scene.add(gridGroup, axisGroup, contentGroup, pointGroup, helperGroup, buildGroup);

scene.add(new THREE.AmbientLight(0xffffff, 0.75));

const light1 = new THREE.DirectionalLight(0xffffff, 0.9);
light1.position.set(6, -8, 12);
const light2 = new THREE.DirectionalLight(0xffffff, 0.35);
light2.position.set(-9, 6, -7);
scene.add(light1, light2);

/* ------------------------------------------------------------ 颜色 / 标签 */

function readColors() {
	const cs = getComputedStyle(document.documentElement);
	const pick = (name, fallback) => {
		const v = (cs.getPropertyValue(name) || '').trim();
		return v || fallback;
	};
	S.colors = {
		bg: pick('--c-bg', '#ffffff'),
		text: pick('--c-text', '#111111'),
		muted: pick('--c-muted', '#666666'),
		line: pick('--c-line', '#dddddd'),
		soft: pick('--c-soft', '#f5f5f5'),
		nav: pick('--c-nav', '#0088ff'),
	};
	scene.background = new THREE.Color(S.colors.bg);
}

function makeLabel(text, color, worldHeight, depthTest) {
	const size = 128;
	const pad = 12;
	const font = '600 84px system-ui, "Microsoft YaHei", sans-serif';

	const measure = document.createElement('canvas').getContext('2d');
	measure.font = font;
	const textWidth = Math.ceil(measure.measureText(text).width) + pad * 2;

	const c = document.createElement('canvas');
	c.width = Math.max(size, textWidth);
	c.height = size;

	const ctx = c.getContext('2d');
	ctx.font = font;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = color;
	ctx.fillText(text, c.width / 2, c.height / 2);

	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.minFilter = THREE.LinearFilter;

	const material = new THREE.SpriteMaterial({
		map: tex,
		transparent: true,
		depthTest: depthTest !== false,
		depthWrite: false,
	});
	const sprite = new THREE.Sprite(material);
	const h = worldHeight || 1;
	sprite.userData.aspect = c.width / c.height;
	sprite.scale.set(h * sprite.userData.aspect, h, 1);
	return sprite;
}

/* ------------------------------------------------------------ 相机 */

function camDir() {
	return new THREE.Vector3(
		Math.sin(S.phi) * Math.cos(S.theta),
		Math.sin(S.phi) * Math.sin(S.theta),
		Math.cos(S.phi)
	);
}

function applyCamera() {
	const dir = camDir();
	for (const cam of [camP, camO]) {
		cam.position.copy(S.target).addScaledVector(dir, S.radius);
		cam.up.set(0, 0, 1);
		cam.lookAt(S.target);
		cam.updateMatrixWorld();
	}
	const aspect = Math.max(0.2, canvas.clientWidth / Math.max(1, canvas.clientHeight));
	camP.aspect = aspect;
	camP.updateProjectionMatrix();

	const h = 2 * S.radius * Math.tan(THREE.MathUtils.degToRad(camP.fov / 2));
	const k = 0.5 * Math.SQRT1_2;

	/* 斜二测的错切会让整个画面平移 k·radius，所以把视锥往反方向挪回来 */
	const shift = S.oblique ? k * S.radius : 0;

	camO.left = (-h * aspect) / 2 + shift;
	camO.right = (h * aspect) / 2 + shift;
	camO.top = h / 2 + shift;
	camO.bottom = -h / 2 + shift;
	camO.updateProjectionMatrix();

	if (S.oblique) {
		const shear = new THREE.Matrix4().set(
			1, 0, -k, 0,
			0, 1, -k, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		);
		camO.projectionMatrix.multiply(shear);
		camO.projectionMatrixInverse.copy(camO.projectionMatrix).invert();
	}
}

function activeCamera() {
	return S.ortho ? camO : camP;
}

function render() {
	updatePointVisuals();
	applyCamera();
	renderer.render(scene, activeCamera());
}

/* 小球和标签按当前视野缩放，看起来始终差不多大 */
function updatePointVisuals() {
	const r = Math.max(1e-4, S.radius * 0.0075);
	const lh = Math.max(1e-4, S.radius * 0.019);
	for (const p of S.points) {
		const on = S.selected.includes(p);
		p.mesh.scale.setScalar(r * (on ? 1.45 : 1));
		const aspect = p.label.userData.aspect || 1;
		p.label.scale.set(lh * aspect, lh, 1);
		p.label.position.copy(p.pos).add(new THREE.Vector3(0, 0, r * (on ? 2.9 : 2.3)));
	}
}

/* ------------------------------------------------------------ 网格 / 坐标轴 */

function clearGroup(group) {
	for (let i = group.children.length - 1; i >= 0; i--) {
		const child = group.children[i];
		group.remove(child);
		child.traverse((obj) => {
			if (obj.geometry) obj.geometry.dispose();
			if (obj.material) {
				if (obj.material.map) obj.material.map.dispose();
				obj.material.dispose();
			}
		});
	}
}

/* 取 1、2、5 × 10^k 里最接近的那个刻度 */
function niceStep(target) {
	if (!(target > 0)) return 1;
	const exp = Math.pow(10, Math.floor(Math.log10(target)));
	const f = target / exp;
	const mult = f <= 1.5 ? 1 : f <= 3 ? 2 : f <= 7 ? 5 : 10;
	return mult * exp;
}

function buildFrame() {
	clearGroup(gridGroup);
	clearGroup(axisGroup);

	const range = Math.max(1, S.gridRange || 10);
	const step = niceStep(range / 8);
	const n = Math.round(range / step);
	const tickText = (v) => String(Number(v.toFixed(6)));

	const gridMat = new THREE.LineBasicMaterial({ color: S.colors.line, transparent: true, opacity: 0.9 });

	const pts = [];
	for (let k = -n; k <= n; k++) {
		const v = k * step;
		pts.push(v, -range, 0, v, range, 0);
		pts.push(-range, v, 0, range, v, 0);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
	gridGroup.add(new THREE.LineSegments(g, gridMat));

	const len = range * 1.12;
	const axisColor = { x: '#d9534f', y: '#2f9e44', z: '#1c7ed6' };

	for (const key of ['x', 'y', 'z']) {
		const dir = new THREE.Vector3(key === 'x' ? 1 : 0, key === 'y' ? 1 : 0, key === 'z' ? 1 : 0);
		const color = new THREE.Color(axisColor[key]);

		const lineGeo = new THREE.BufferGeometry().setFromPoints([
			dir.clone().multiplyScalar(-range),
			dir.clone().multiplyScalar(len),
		]);
		axisGroup.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })));

		const arrow = new THREE.ArrowHelper(dir, dir.clone().multiplyScalar(len * 0.86), len * 0.14, color, len * 0.05, len * 0.032);
		axisGroup.add(arrow);

		const label = makeLabel(key, axisColor[key], S.radius * 0.03, false);
		label.position.copy(dir).multiplyScalar(len * 1.03);
		axisGroup.add(label);
	}

	/* 三个轴上的刻度线 */
	const tickLen = range * 0.024;
	const tickMat = new THREE.LineBasicMaterial({ color: S.colors.muted, transparent: true, opacity: 0.75 });
	const tickPts = [];
	for (let k = -n; k <= n; k++) {
		const v = k * step;
		if (Math.abs(v) < 1e-9) continue;
		tickPts.push(v, -tickLen, 0, v, tickLen, 0);
		tickPts.push(-tickLen, v, 0, tickLen, v, 0);
		tickPts.push(-tickLen, 0, v, tickLen, 0, v);
	}
	const tg = new THREE.BufferGeometry();
	tg.setAttribute('position', new THREE.Float32BufferAttribute(tickPts, 3));
	axisGroup.add(new THREE.LineSegments(tg, tickMat));

	/* 正半轴写数字 */
	for (let k = 1; k <= n; k++) {
		const v = k * step;
		for (const key of ['x', 'y', 'z']) {
			const label = makeLabel(tickText(v), S.colors.muted, S.radius * 0.02);
			if (key === 'x') label.position.set(v, -range * 0.05, 0);
			if (key === 'y') label.position.set(-range * 0.05, v, 0);
			if (key === 'z') label.position.set(-range * 0.05, -range * 0.05, v);
			axisGroup.add(label);
		}
	}

	const origin = makeLabel('0', S.colors.muted, S.radius * 0.02);
	origin.position.set(-range * 0.05, -range * 0.05, 0);
	axisGroup.add(origin);
}

/* 让刻度是 1、2、5 × 10^k 那样的整数字 */
function niceCeil(v) {
	if (!(v > 0)) return 1;
	const exp = Math.pow(10, Math.floor(Math.log10(v)));
	const f = v / exp;
	const mult = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
	return mult * exp;
}
/* ------------------------------------------------------------ 视图操作 */

function setView(dir, upHint) {
	const v = dir.clone().normalize();
	const phi = Math.acos(clamp(v.z, -1, 1));
	const theta = Math.atan2(v.y, v.x);

	S.phi = clamp(phi, 0.06, PI - 0.06);
	S.theta = Number.isFinite(theta) ? theta : 0;
	if (upHint) S.theta = upHint;
	render();
}

function fitView() {
	const box = new THREE.Box3();
	box.expandByObject(contentGroup);
	box.expandByObject(pointGroup);
	for (const obj of builds) {
		if (obj.userData && obj.userData.skipFit) continue;
		box.expandByObject(obj);
	}

	if (box.isEmpty()) {
		S.target.set(0, 0, 0);
		S.radius = 18;
		S.gridRange = 10;
		return;
	}

	const center = box.getCenter(new THREE.Vector3());
	S.target.copy(center);

	/* 把八个角投到相机坐标系里，算出刚好装下要多远 */
	const dir = camDir();
	const right = new THREE.Vector3(-Math.sin(S.theta), Math.cos(S.theta), 0).normalize();
	const up = new THREE.Vector3().crossVectors(dir, right).normalize();

	const aspect = Math.max(0.5, canvas.clientWidth / Math.max(1, canvas.clientHeight));
	const halfV = THREE.MathUtils.degToRad(camP.fov / 2);
	const halfH = Math.atan(Math.tan(halfV) * aspect);
	const tanV = Math.tan(halfV);
	const tanH = Math.tan(halfH);

	let dist = 0;
	const corner = new THREE.Vector3();
	for (let i = 0; i < 8; i++) {
		corner.set(
			i & 1 ? box.max.x : box.min.x,
			i & 2 ? box.max.y : box.min.y,
			i & 4 ? box.max.z : box.min.z
		);
		corner.sub(center);
		const z = corner.dot(dir);
		const need = z + Math.max(Math.abs(corner.dot(right)) / tanH, Math.abs(corner.dot(up)) / tanV);
		if (need > dist) dist = need;
	}

	const size = box.getSize(new THREE.Vector3());
	S.radius = clamp(Math.max(dist, Math.min(size.length(), 1)) * 1.08, 0.8, 3000);

	const extent = Math.max(
		Math.abs(box.max.x), Math.abs(box.max.y), Math.abs(box.max.z),
		Math.abs(box.min.x), Math.abs(box.min.y), Math.abs(box.min.z)
	);
	S.gridRange = extent <= 20 ? Math.ceil(extent * 1.05) : niceCeil(extent * 1.05);
}function refreshAll() {
	buildFrame();
	render();
}

/* ------------------------------------------------------------ 曲面 */

function showNote(id, text, bad) {
	const el = $(id);
	el.textContent = text || '';
	el.className = 'p3-note' + (bad ? ' bad' : '');
}

function showVolume(prefix, latex) {
	const el = $('surface-volume');
	el.textContent = '';
	if (!prefix && !latex) {
		el.className = 'p3-note p3-math-line';
		return;
	}
	el.className = 'p3-note p3-math-line';
	if (prefix) el.appendChild(document.createTextNode(prefix + ' '));
	const m = document.createElement('span');
	el.appendChild(m);
	renderMath(m, latex);
}

function drawSurface() {
	if ($('fn-mode').value === 'f') drawImplicitSurface();
	else drawExplicitSurface();
}

/* ------------------------------------------------------------ 隐函数曲面（行进四面体） */

function compileImplicit(text) {
	const raw = String(text || '').trim();
	if (!raw) throw new Error('式子是空的');

	const eq = raw.indexOf('=');
	const body = eq >= 0 ? '(' + raw.slice(0, eq) + ') - (' + raw.slice(eq + 1) + ')' : '(' + raw + ')';
	return compileExpr(['x', 'y', 'z'], body);
}

function emitTet(tet, v, cx, cy, cz, out) {
	const inside = [];
	const outside = [];
	for (let q = 0; q < 4; q++) {
		const idx = tet[q];
		if (v[idx] < 0) inside.push(idx);
		else outside.push(idx);
	}
	if (inside.length === 0 || inside.length === 4) return;

	const cut = (a, b) => {
		const va = v[a];
		const vb = v[b];
		const t = Math.abs(va - vb) < 1e-12 ? 0.5 : va / (va - vb);
		return [
			cx[a] + (cx[b] - cx[a]) * t,
			cy[a] + (cy[b] - cy[a]) * t,
			cz[a] + (cz[b] - cz[a]) * t,
		];
	};

	if (inside.length === 1 || inside.length === 3) {
		const one = inside.length === 1 ? inside[0] : outside[0];
		const rest = inside.length === 1 ? outside : inside;
		const A = cut(one, rest[0]);
		const B = cut(one, rest[1]);
		const C = cut(one, rest[2]);
		out.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
		return;
	}

	const a = inside[0];
	const b = inside[1];
	const c = outside[0];
	const d = outside[1];
	const ac = cut(a, c);
	const ad = cut(a, d);
	const bd = cut(b, d);
	const bc = cut(b, c);
	out.push(ac[0], ac[1], ac[2], ad[0], ad[1], ad[2], bd[0], bd[1], bd[2]);
	out.push(ac[0], ac[1], ac[2], bd[0], bd[1], bd[2], bc[0], bc[1], bc[2]);
}

function buildImplicitGeometry(f, box, res) {
	const n = clamp(Math.round(res), 8, 80);
	const x0 = box.x0;
	const x1 = box.x1;
	const y0 = box.y0;
	const y1 = box.y1;
	const z0 = box.z0;
	const z1 = box.z1;

	const dx = (x1 - x0) / n;
	const dy = (y1 - y0) / n;
	const dz = (z1 - z0) / n;
	const gx = n + 1;
	const gy = n + 1;
	const gz = n + 1;

	const vals = new Float32Array(gx * gy * gz);
	for (let k = 0; k < gz; k++) {
		const z = z0 + dz * k;
		for (let j = 0; j < gy; j++) {
			const y = y0 + dy * j;
			for (let i = 0; i < gx; i++) {
				let v;
				try {
					v = f(x0 + dx * i, y, z);
				} catch (err) {
					v = NaN;
				}
				vals[(k * gy + j) * gx + i] = Number.isFinite(v) ? v : NaN;
			}
		}
	}

	const TETS = [
		[0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7],
		[0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7],
	];

	const positions = [];
	const cv = new Float32Array(8);
	const cx = new Float32Array(8);
	const cy = new Float32Array(8);
	const cz = new Float32Array(8);

	for (let k = 0; k < n; k++) {
		for (let j = 0; j < n; j++) {
			for (let i = 0; i < n; i++) {
				let ok = true;
				for (let b = 0; b < 8; b++) {
					const ii = i + (b & 1);
					const jj = j + ((b >> 1) & 1);
					const kk = k + ((b >> 2) & 1);
					const v = vals[(kk * gy + jj) * gx + ii];
					if (!Number.isFinite(v)) {
						ok = false;
						break;
					}
					cv[b] = v;
					cx[b] = x0 + dx * ii;
					cy[b] = y0 + dy * jj;
					cz[b] = z0 + dz * kk;
				}
				if (!ok) continue;

				for (let q = 0; q < 6; q++) emitTet(TETS[q], cv, cx, cy, cz, positions);
			}
		}
	}

	if (positions.length === 0) return null;

	/* 法向量用梯度算，曲面才光滑 */
	const e = Math.max(1e-6, Math.min(dx, dy, dz) * 0.5);
	const normals = new Float32Array(positions.length);
	for (let v = 0; v < positions.length; v += 3) {
		const px = positions[v];
		const py = positions[v + 1];
		const pz = positions[v + 2];
		let nx = 0;
		let ny = 0;
		let nz = 0;
		try {
			nx = (f(px + e, py, pz) - f(px - e, py, pz)) / (2 * e);
			ny = (f(px, py + e, pz) - f(px, py - e, pz)) / (2 * e);
			nz = (f(px, py, pz + e) - f(px, py, pz - e)) / (2 * e);
		} catch (err) {
			/* 保留 0 */
		}
		const len = Math.hypot(nx, ny, nz) || 1;
		normals[v] = nx / len;
		normals[v + 1] = ny / len;
		normals[v + 2] = nz / len;
	}

	/* 绕向要和法向量一致，否则双面材质的背面会翻法线，出现一块块的暗斑 */
	for (let v = 0; v < positions.length; v += 9) {
		const ux = positions[v + 3] - positions[v];
		const uy = positions[v + 4] - positions[v + 1];
		const uz = positions[v + 5] - positions[v + 2];
		const wx = positions[v + 6] - positions[v];
		const wy = positions[v + 7] - positions[v + 1];
		const wz = positions[v + 8] - positions[v + 2];

		const fx = uy * wz - uz * wy;
		const fy = uz * wx - ux * wz;
		const fz = ux * wy - uy * wx;

		const nx = normals[v] + normals[v + 3] + normals[v + 6];
		const ny = normals[v + 1] + normals[v + 4] + normals[v + 7];
		const nz = normals[v + 2] + normals[v + 5] + normals[v + 8];

		if (fx * nx + fy * ny + fz * nz < 0) {
			for (let c = 0; c < 3; c++) {
				const tmpP = positions[v + 3 + c];
				positions[v + 3 + c] = positions[v + 6 + c];
				positions[v + 6 + c] = tmpP;
				const tmpN = normals[v + 3 + c];
				normals[v + 3 + c] = normals[v + 6 + c];
				normals[v + 6 + c] = tmpN;
			}
		}
	}

	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	geo.computeBoundingSphere();
	return geo;
}

function drawImplicitSurface() {
	const text = ($('fn-expr').value || '').trim();
	if (!text) {
		showNote('surface-note', '先写一个式子。', true);
		return;
	}

	const x0 = numOf($('fn-x0'), -5);
	const x1 = numOf($('fn-x1'), 5);
	const y0 = numOf($('fn-y0'), -5);
	const y1 = numOf($('fn-y1'), 5);
	const z0 = numOf($('fn-z0'), -5);
	const z1 = numOf($('fn-z1'), 5);
	if (!(x1 > x0) || !(y1 > y0) || !(z1 > z0)) {
		showNote('surface-note', '范围不对：右边要比左边大。', true);
		return;
	}

	let f;
	try {
		f = compileImplicit(text);
	} catch (err) {
		showNote('surface-note', err.message, true);
		return;
	}

	const res = clamp(parseInt($('fn-res').value, 10) || 50, 8, 70);
	const geo = buildImplicitGeometry(f, { x0, x1, y0, y1, z0, z1 }, res);
	if (!geo) {
		showNote('surface-note', '这个范围里没找到曲面，换个范围或精度试试。', true);
		return;
	}

	if (S.surface) {
		contentGroup.remove(S.surface);
		S.surface.geometry.dispose();
		S.surface.material.dispose();
	}

	S.surface = new THREE.Mesh(
		geo,
		new THREE.MeshStandardMaterial({
			color: 0x4a9de0,
			roughness: 0.72,
			metalness: 0.02,
			side: THREE.DoubleSide,
		})
	);
	contentGroup.add(S.surface);

	fitView();
	buildFrame();
	showNote('surface-note', '绘制成功');
	showVolume('', '');
	render();
}
function drawExplicitSurface() {
	const exprEl = $('fn-expr');
	const x0 = numOf($('fn-x0'), -5);
	const x1 = numOf($('fn-x1'), 5);
	const y0 = numOf($('fn-y0'), -5);
	const y1 = numOf($('fn-y1'), 5);
	const res = clamp(parseInt($('fn-res').value, 10) || 50, 8, 160);

	if (!(x1 > x0) || !(y1 > y0)) {
		showNote('surface-note', '范围不对：右边要比左边大。', true);
		return;
	}

	let f;
	try {
		f = compileExpr(['x', 'y'], exprEl.value);
	} catch (err) {
		showNote('surface-note', err.message, true);
		return;
	}

	const nx = res;
	const ny = res;
	const zs = new Float32Array(nx * ny);
	let zMin = Infinity;
	let zMax = -Infinity;

	for (let j = 0; j < ny; j++) {
		const y = y0 + ((y1 - y0) * j) / (ny - 1);
		for (let i = 0; i < nx; i++) {
			const x = x0 + ((x1 - x0) * i) / (nx - 1);
			let z;
			try {
				z = f(x, y);
			} catch (err) {
				z = NaN;
			}
			zs[j * nx + i] = Number.isFinite(z) ? z : NaN;
			if (Number.isFinite(z)) {
				if (z < zMin) zMin = z;
				if (z > zMax) zMax = z;
			}
		}
	}

	if (!Number.isFinite(zMin) || !Number.isFinite(zMax)) {
		showNote('surface-note', '这个式子在给定范围里算不出数，换个范围试试。', true);
		return;
	}

	/* 太高的地方切掉，免得一根尖刺把整个场景撑爆 */
	const span = Math.max(x1 - x0, y1 - y0);
	const cut = zMin + span * 3.5;
	const zLo = Math.max(zMin, zMax - span * 7);

	const positions = new Float32Array(nx * ny * 3);
	const colors = new Float32Array(nx * ny * 3);
	const valid = new Uint8Array(nx * ny);
	const spanZ = Math.max(1e-6, zMax - Math.min(zMin, zLo));
	const color = new THREE.Color();

	for (let j = 0; j < ny; j++) {
		const y = y0 + ((y1 - y0) * j) / (ny - 1);
		for (let i = 0; i < nx; i++) {
			const x = x0 + ((x1 - x0) * i) / (nx - 1);
			const k = j * nx + i;
			let z = zs[k];
			if (!Number.isFinite(z)) {
				valid[k] = 0;
				positions[k * 3] = x;
				positions[k * 3 + 1] = y;
				positions[k * 3 + 2] = zLo;
				continue;
			}
			valid[k] = 1;
			z = clamp(z, zLo, cut);

			positions[k * 3] = x;
			positions[k * 3 + 1] = y;
			positions[k * 3 + 2] = z;

			const t = clamp((z - Math.min(zMin, zLo)) / spanZ, 0, 1);
			color.setHSL(0.66 - 0.66 * t, 0.62, 0.52);
			colors[k * 3] = color.r;
			colors[k * 3 + 1] = color.g;
			colors[k * 3 + 2] = color.b;
		}
	}

	const index = [];
	for (let j = 0; j < ny - 1; j++) {
		for (let i = 0; i < nx - 1; i++) {
			const a = j * nx + i;
			const b = a + 1;
			const c = a + nx;
			const d = c + 1;
			if (valid[a] && valid[b] && valid[c] && valid[d]) {
				index.push(a, b, d, a, d, c);
			}
		}
	}

	if (index.length === 0) {
		showNote('surface-note', '曲面没有有效的部分。', true);
		return;
	}

	/* 曲面与 z = 0 之间的体积（每个小格子按四角平均高 × 底面积） */
	const cellArea = ((x1 - x0) / (nx - 1)) * ((y1 - y0) / (ny - 1));
	let volumeZ = 0;
	let volumeAbs = 0;
	for (let j = 0; j < ny - 1; j++) {
		for (let i = 0; i < nx - 1; i++) {
			const a = j * nx + i;
			const b = a + 1;
			const c = a + nx;
			const d = c + 1;
			if (!(valid[a] && valid[b] && valid[c] && valid[d])) continue;
			const h = (zs[a] + zs[b] + zs[c] + zs[d]) / 4;
			volumeZ += h * cellArea;
			volumeAbs += Math.abs(h) * cellArea;
		}
	}

	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	geo.setIndex(index);
	geo.computeVertexNormals();
	geo.computeBoundingSphere();

	const mesh = new THREE.Mesh(
		geo,
		new THREE.MeshStandardMaterial({
			vertexColors: true,
			side: THREE.DoubleSide,
			roughness: 0.86,
			metalness: 0.0,
		})
	);

	if (S.surface) {
		contentGroup.remove(S.surface);
		S.surface.geometry.dispose();
		S.surface.material.dispose();
	}
	S.surface = mesh;
	contentGroup.add(mesh);

	fitView();
	buildFrame();
	render();

	showNote('surface-note', '绘制成功');
	showVolume('曲面与 z = 0 之间的体积', 'V' + approxLatex(volumeAbs));
}

function removeSurface() {
	if (S.surface) {
		contentGroup.remove(S.surface);
		S.surface.geometry.dispose();
		S.surface.material.dispose();
		S.surface = null;
		showNote('surface-note', '');
		showVolume('', '');
		render();
	}
}

/* ------------------------------------------------------------ 曲线 */

function drawCurve() {
	const t0 = numOf($('cv-t0'), 0);
	const t1 = numOf($('cv-t1'), PI * 2);
	if (!(t1 > t0)) {
		showNote('curve-note', 't 的范围不对：右边要比左边大。', true);
		return;
	}

	let fx;
	let fy;
	let fz;
	try {
		fx = compileExpr(['t'], $('cv-x').value);
		fy = compileExpr(['t'], $('cv-y').value);
		fz = compileExpr(['t'], $('cv-z').value);
	} catch (err) {
		showNote('curve-note', err.message, true);
		return;
	}

	const N = 900;
	const segments = [];
	let current = [];

	for (let i = 0; i <= N; i++) {
		const t = t0 + ((t1 - t0) * i) / N;
		let p = null;
		try {
			const x = fx(t);
			const y = fy(t);
			const z = fz(t);
			if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
				p = new THREE.Vector3(x, y, z);
			}
		} catch (err) {
			p = null;
		}

		if (p) {
			current.push(p);
		} else if (current.length > 1) {
			segments.push(current);
			current = [];
		} else {
			current = [];
		}
	}
	if (current.length > 1) segments.push(current);

	if (segments.length === 0) {
		showNote('curve-note', '这条曲线没有有效的部分。', true);
		return;
	}

	if (S.curve) {
		contentGroup.remove(S.curve);
		S.curve.traverse((obj) => {
			if (obj.geometry) obj.geometry.dispose();
			if (obj.material) obj.material.dispose();
		});
		S.curve = null;
	}

	const group = new THREE.Group();
	const radius = Math.max(0.012, S.radius * 0.004);

	for (const seg of segments) {
		let curve = null;
		if (seg.length >= 2) {
			curve = new THREE.CatmullRomCurve3(seg);
		}
		if (!curve) continue;

		const tubular = clamp(seg.length * 2, 16, 1600);
		let tube;
		try {
			tube = new THREE.TubeGeometry(curve, tubular, radius, 8, false);
		} catch (err) {
			tube = null;
		}
		if (tube) {
			group.add(
				new THREE.Mesh(
					tube,
					new THREE.MeshStandardMaterial({ color: 0x1c7ed6, roughness: 0.55, metalness: 0.05 })
				)
			);
		} else {
			const geo = new THREE.BufferGeometry().setFromPoints(seg);
			group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x1c7ed6 })));
		}
	}

	S.curve = group;
	contentGroup.add(group);

	fitView();
	buildFrame();
	render();

	showNote('curve-note', '绘制成功');
}

function removeCurve() {
	if (S.curve) {
		contentGroup.remove(S.curve);
		S.curve.traverse((obj) => {
			if (obj.geometry) obj.geometry.dispose();
			if (obj.material) obj.material.dispose();
		});
		S.curve = null;
		showNote('curve-note', '');
		render();
	}
}

/* ------------------------------------------------------------ 点 */

function nextName() {
	const used = new Set(S.points.map((p) => p.name));
	for (let i = 0; i < 26; i++) {
		const name = String.fromCharCode(65 + i);
		if (!used.has(name)) return name;
	}
	let n = 1;
	while (used.has('P' + n)) n++;
	return 'P' + n;
}

function addPoint(name, pos) {
	const mesh = new THREE.Mesh(
		new THREE.SphereGeometry(1, 20, 14),
		new THREE.MeshStandardMaterial({ color: 0x1c7ed6, roughness: 0.45 })
	);
	mesh.position.copy(pos);
	mesh.userData.pointIndex = S.points.length;

	const label = makeLabel(name, S.colors.text, 1, false);

	pointGroup.add(mesh, label);

	S.points.push({ name, pos: pos.clone(), mesh, label });
	updatePointVisuals();
}

const NAME_RE = /^\s*([A-Za-z]+)/;

function parsePointLine(line) {
	const text = line.trim();
	if (!text) return null;

	let name = '';
	const nameMatch = text.match(NAME_RE);
	if (nameMatch) name = nameMatch[1];

	const rest = nameMatch ? text.slice(nameMatch[0].length) : text;
	const nums = (rest.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g) || []).map(Number);

	if (nums.length !== 3) return null;
	return { name: name || nextName(), pos: new THREE.Vector3(nums[0], nums[1], nums[2]) };
}

function addPointsFromInput() {
	const raw = $('pt-input').value || '';
	const items = raw.split(/[;；\n]/).map((s) => s.trim()).filter(Boolean);
	if (items.length === 0) return;

	let added = 0;
	let bad = 0;

	for (const item of items) {
		const parsed = parsePointLine(item);
		if (!parsed) {
			bad++;
			continue;
		}
		if (S.points.some((p) => p.name === parsed.name)) {
			bad++;
			continue;
		}
		addPoint(parsed.name, parsed.pos);
		added++;
	}

	$('pt-input').value = '';
	refreshPoints();
	if (added > 0) {
		fitView();
		buildFrame();
	}
	render();

	if (bad > 0) {
		$('pt-input').placeholder = '有 ' + bad + ' 行格式不对，要写 A(1, 2, 3)';
	} else {
		$('pt-input').placeholder = 'A(1, 2, 3)';
	}
}

function refreshPoints() {
	const list = $('pt-list');
	list.textContent = '';
	for (const p of S.points) {
		const li = document.createElement('li');
		li.textContent = p.name + ' ' + vecText(p.pos);
		li.dataset.name = p.name;
		if (S.selected.includes(p)) li.classList.add('sel');
		li.addEventListener('click', () => toggleSelect(p));
		list.appendChild(li);
	}
	updateMeasure();
}

function clearPoints() {
	for (const p of S.points) {
		pointGroup.remove(p.mesh, p.label);
		p.mesh.geometry.dispose();
		p.mesh.material.dispose();
	}
	S.points = [];
	S.selected = [];
	clearGroup(helperGroup);
	refreshPoints();
	render();
}

/* ------------------------------------------------------------ 选择与测量 */

function toggleSelect(point) {
	const idx = S.selected.indexOf(point);
	if (idx >= 0) {
		S.selected.splice(idx, 1);
	} else {
		S.selected.push(point);
		while (S.selected.length > 4) S.selected.shift();
	}
	refreshSelection();
}

function clearSelection() {
	S.selected = [];
	refreshSelection();
}

function refreshSelection() {
	for (const p of S.points) {
		const on = S.selected.includes(p);
		p.mesh.material.color.set(on ? 0xd6336c : 0x1c7ed6);
	}
	refreshPoints();
	drawHelpers();
	render();
}

function drawHelpers() {
	clearGroup(helperGroup);
	const sel = S.selected;
	if (sel.length < 2) return;

	const scale = S.radius;
	const lineMat = new THREE.LineDashedMaterial({
		color: 0xd6336c,
		dashSize: scale * 0.02,
		gapSize: scale * 0.012,
	});

	for (let i = 0; i < sel.length - 1; i++) {
		const geo = new THREE.BufferGeometry().setFromPoints([sel[i].pos, sel[i + 1].pos]);
		const line = new THREE.Line(geo, lineMat.clone());
		line.computeLineDistances();
		helperGroup.add(line);
	}

	if (sel.length === 3) {
		const [a, b, c] = sel.map((p) => p.pos);
		const geo = new THREE.BufferGeometry().setFromPoints([a, b, c]);
		geo.setIndex([0, 1, 2]);
		geo.computeVertexNormals();
		const mat = new THREE.MeshBasicMaterial({
			color: 0xd6336c,
			transparent: true,
			opacity: 0.16,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		helperGroup.add(new THREE.Mesh(geo, mat));

		if (sel.length === 4) {
			const pts4 = sel.map((p) => p.pos);
			const faces = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
			const mat4 = new THREE.MeshBasicMaterial({
				color: 0xd6336c,
				transparent: true,
				opacity: 0.09,
				side: THREE.DoubleSide,
				depthWrite: false,
			});
			for (const f of faces) {
				const g4 = new THREE.BufferGeometry().setFromPoints([pts4[f[0]], pts4[f[1]], pts4[f[2]]]);
				g4.setIndex([0, 1, 2]);
				helperGroup.add(new THREE.Mesh(g4, mat4));
			}
		}

		const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
		if (n.lengthSq() > 1e-18) {
			n.normalize();
			const centroid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
			const arrow = new THREE.ArrowHelper(n, centroid, scale * 0.28, 0xd6336c, scale * 0.05, scale * 0.03);
			helperGroup.add(arrow);
		}
	}
}

function angleBetween(u, v) {
	const lu = u.length();
	const lv = v.length();
	if (lu < 1e-12 || lv < 1e-12) return NaN;
	const c = clamp(u.dot(v) / (lu * lv), -1, 1);
	return (Math.acos(c) * 180) / PI;
}


function updateMeasure() {
	const box = $('measure');
	box.textContent = '';
	const sel = S.selected;

	const addLine = (label, latex, tail) => {
		const p = document.createElement('p');
		p.className = 'p3-line';

		const l = document.createElement('span');
		l.className = 'p3-lbl';
		l.textContent = label;
		p.appendChild(l);

		const m = document.createElement('span');
		p.appendChild(m);
		renderMath(m, latex);

		if (tail) {
			const t = document.createElement('span');
			t.textContent = tail;
			p.appendChild(t);
		}

		box.appendChild(p);
	};

	if (sel.length === 0) {
		const p = document.createElement('p');
		p.className = 'p3-muted';
		p.textContent = '点上两个小球量距离，三个量夹角和法向量，四个量二面角。';
		box.appendChild(p);
		return;
	}

	const names = sel.map((p) => p.name);
	const head = document.createElement('p');
	head.className = 'p3-order';
	head.textContent = '已选：' + names.join(' → ');
	box.appendChild(head);

	if (sel.length === 1) {
		addLine('坐标', names[0] + '=' + vecLatex(sel[0].pos));
		return;
	}

	const A = sel[0].pos;
	const B = sel[1].pos;
	const AB = new THREE.Vector3().subVectors(B, A);
	const pair = names[0] + names[1];

	addLine('距离', '\\left|' + pair + '\\right|=' + exactLatex(AB.length()));
	addLine('向量', '\\overrightarrow{' + pair + '}=' + vecLatex(AB));

	if (sel.length === 2) return;

	const C = sel[2].pos;
	const BA = new THREE.Vector3().subVectors(A, B);
	const BC = new THREE.Vector3().subVectors(C, B);
	const ang = angleParts(angleBetween(BA, BC));
	addLine('∠' + pair + names[2] + '（以 ' + names[1] + ' 为顶点）', ang.latex, ang.tail);

	const nRaw = new THREE.Vector3()
		.subVectors(B, A)
		.cross(new THREE.Vector3().subVectors(C, A));
	const area = nRaw.length() / 2;
	addLine('面积', 'S_{\\triangle ' + pair + names[2] + '}=' + exactLatex(area));

	const ints = integerize(nRaw);
	if (ints) {
		addLine('法向量', '\\vec{n}=\\left(' + ints.join(',\\ ') + '\\right)');
		addLine('平面 ' + pair + names[2], planeLatex(ints, A));
	} else if (nRaw.lengthSq() > 1e-18) {
		addLine('法向量', '\\vec{n}=' + vecLatex(nRaw.clone().normalize()));
	}

	if (sel.length === 3) return;

	const D = sel[3].pos;
	const n1 = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, B));
	const n2 = new THREE.Vector3().subVectors(C, B).cross(new THREE.Vector3().subVectors(D, C));
	let dihedral = NaN;
	if (n1.lengthSq() > 1e-18 && n2.lengthSq() > 1e-18) {
		const c = clamp(n1.dot(n2) / (n1.length() * n2.length()), -1, 1);
		dihedral = (Math.acos(c) * 180) / PI;
	}
	const dih = angleParts(dihedral);
	addLine('二面角 ' + names.join('-'), dih.latex, dih.tail);

	const vol = Math.abs(
		new THREE.Vector3().subVectors(B, A)
			.cross(new THREE.Vector3().subVectors(C, A))
			.dot(new THREE.Vector3().subVectors(D, A))
	) / 6;
	addLine('体积', 'V_{' + names.join('') + '}=' + exactLatex(vol));
}
/* ------------------------------------------------------------ 作图：线段 / 直线 / 圆 */

const BUILD_COLOR = 0xe8590c;

function setBuildNote(text, latex, bad) {
	const el = $('build-note');
	el.textContent = '';
	el.className = 'p3-note' + (bad ? ' bad' : '');
	if (text) el.appendChild(document.createTextNode(text));
	if (latex) {
		const m = document.createElement('span');
		el.appendChild(m);
		renderMath(m, latex);
	}
}

function strokeTube(points, closed) {
	if (!points || points.length < 2) return null;
	const curve = new THREE.CatmullRomCurve3(points, !!closed);
	const radius = Math.max(1e-4, S.radius * 0.0032);
	const tubular = clamp(points.length * 6, 32, 1600);
	const geo = new THREE.TubeGeometry(curve, tubular, radius, 8, !!closed);
	return new THREE.Mesh(
		geo,
		new THREE.MeshStandardMaterial({ color: BUILD_COLOR, roughness: 0.6, metalness: 0.05 })
	);
}

function addBuild(obj, text, latex) {
	if (!obj) return;
	buildGroup.add(obj);
	builds.push(obj);
	fitView();
	buildFrame();
	setBuildNote(text || '绘制成功', latex || '');
	render();
}

function clearBuilds() {
	for (const obj of builds) {
		buildGroup.remove(obj);
		if (obj.geometry) obj.geometry.dispose();
		if (obj.material) obj.material.dispose();
	}
	builds.length = 0;
	setBuildNote('');
	render();
}

function requirePoints(n, what) {
	if (S.selected.length < n) {
		setBuildNote('先在画面里选中 ' + n + ' 个点，再' + what + '。', null, true);
		return null;
	}
	return S.selected.slice(0, n);
}

/* 圆所在平面的一组正交基 */
function circleBasis(normal) {
	const n = normal.clone().normalize();
	const helper = Math.abs(n.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
	const e1 = new THREE.Vector3().crossVectors(helper, n).normalize();
	const e2 = new THREE.Vector3().crossVectors(n, e1).normalize();
	return { n, e1, e2 };
}

function circlePointAt(center, radius, basis, ang) {
	return center
		.clone()
		.addScaledVector(basis.e1, radius * Math.cos(ang))
		.addScaledVector(basis.e2, radius * Math.sin(ang));
}

/* 三点外接圆：圆心、半径、法向量 */
function circumcircle(a, b, c) {
	const ab = new THREE.Vector3().subVectors(b, a);
	const ac = new THREE.Vector3().subVectors(c, a);
	const n = new THREE.Vector3().crossVectors(ab, ac);
	const n2 = n.lengthSq();
	if (n2 < 1e-16) return null;

	/* center = a + ( |ac|² (n × ab) + |ab|² (ac × n) ) / (2|n|²) */
	const term = new THREE.Vector3()
		.addScaledVector(new THREE.Vector3().crossVectors(n, ab), ac.lengthSq())
		.addScaledVector(new THREE.Vector3().crossVectors(ac, n), ab.lengthSq())
		.multiplyScalar(1 / (2 * n2));

	const center = a.clone().add(term);
	return { center, radius: center.distanceTo(a), normal: n.normalize() };
}

function buildSegment() {
	const pts = requirePoints(2, '画线段');
	if (!pts) return;
	const a = pts[0].pos;
	const b = pts[1].pos;
	if (a.distanceTo(b) < 1e-9) {
		setBuildNote('这两个点重合，画不出线段。', null, true);
		return;
	}
	addBuild(
		strokeTube([a.clone(), b.clone()], false),
		'线段 ' + pts[0].name + pts[1].name + ' 已画出，长度 ',
		exactLatex(a.distanceTo(b))
	);
}

function buildLine() {
	const pts = requirePoints(2, '画直线');
	if (!pts) return;
	const a = pts[0].pos;
	const d = new THREE.Vector3().subVectors(pts[1].pos, a);
	if (d.lengthSq() < 1e-18) {
		setBuildNote('这两个点重合，画不出直线。', null, true);
		return;
	}
	d.normalize();
	const L = Math.max(S.gridRange, S.radius) * 4;
	const lineObj = strokeTube([a.clone().addScaledVector(d, -L), a.clone().addScaledVector(d, L)], false);
	if (lineObj) lineObj.userData.skipFit = true;
	const dirInt = integerize(new THREE.Vector3().subVectors(pts[1].pos, a));
	const dirLatex = dirInt ? '\\left(' + dirInt.join(',\\ ') + '\\right)' : vecLatex(d);
	addBuild(lineObj, '过 ' + pts[0].name + ' ' + pts[1].name + ' 的直线已画出，方向向量 ', dirLatex);
}

function buildCircle3() {
	const pts = requirePoints(3, '画圆');
	if (!pts) return;
	const [A, B, C] = pts.map((p) => p.pos);
	const cc = circumcircle(A, B, C);
	if (!cc) {
		setBuildNote('三点共线，画不出圆。', null, true);
		return;
	}
	const basis = circleBasis(cc.normal);
	const ring = [];
	const N = 120;
	for (let i = 0; i < N; i++) ring.push(circlePointAt(cc.center, cc.radius, basis, (i / N) * PI * 2));
	addBuild(
		strokeTube(ring, true),
		'过 ' + pts.map((p) => p.name).join('') + ' 的圆：',
		'r=' + exactLatex(cc.radius) +
			',\\quad 2\\pi r=' + exactLatex(2 * cc.radius, '\\pi') +
			',\\quad \\pi r^{2}=' + exactLatex(cc.radius * cc.radius, '\\pi')
	);
}

function buildArc3() {
	const pts = requirePoints(3, '画圆弧');
	if (!pts) return;
	const [A, B, C] = pts.map((p) => p.pos);
	const cc = circumcircle(A, B, C);
	if (!cc) {
		setBuildNote('三点共线，画不出圆弧。', null, true);
		return;
	}
	const basis = circleBasis(cc.normal);
	const angOf = (p) => {
		const v = new THREE.Vector3().subVectors(p, cc.center);
		return Math.atan2(v.dot(basis.e2), v.dot(basis.e1));
	};
	const a0 = angOf(A);
	let sweep = angOf(C) - a0;
	while (sweep < 0) sweep += PI * 2;
	let mid = angOf(B) - a0;
	while (mid < 0) mid += PI * 2;
	if (mid > sweep) sweep -= PI * 2;

	const arc = [];
	const N = 96;
	for (let i = 0; i <= N; i++) arc.push(circlePointAt(cc.center, cc.radius, basis, a0 + (sweep * i) / N));
	addBuild(
		strokeTube(arc, false),
		'圆弧 ' + pts.map((p) => p.name).join('-') + '：',
		'r=' + exactLatex(cc.radius) +
			',\\quad \\theta=' + Number(Math.abs((sweep * 180) / PI).toFixed(2)) + '^{\\circ}'
	);
}

function buildCircle2() {
	const pts = requirePoints(2, '画圆');
	if (!pts) return;
	const center = pts[0].pos;
	const through = pts[1].pos;
	const dir = new THREE.Vector3().subVectors(through, center);
	const R = dir.length();
	if (R < 1e-9) {
		setBuildNote('圆心和圆上那一点重合了。', null, true);
		return;
	}

	/* 圆必须过这两点：两点同一高度时画水平圆，否则画竖直方向的圆 */
	let normal;
	if (Math.abs(dir.z) < R * 0.02) {
		normal = new THREE.Vector3(0, 0, 1);
	} else {
		normal = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1));
		if (normal.lengthSq() < 1e-16) normal.set(1, 0, 0);
	}

	const basis = circleBasis(normal);
	const ring = [];
	const N = 120;
	for (let i = 0; i < N; i++) ring.push(circlePointAt(center, R, basis, (i / N) * PI * 2));
	addBuild(
		strokeTube(ring, true),
		'以 ' + pts[0].name + ' 为圆心、过 ' + pts[1].name + ' 的圆：',
		'r=' + exactLatex(R) +
			',\\quad 2\\pi r=' + exactLatex(2 * R, '\\pi') +
			',\\quad \\pi r^{2}=' + exactLatex(R * R, '\\pi') +
			',\\quad \\tfrac{4}{3}\\pi r^{3}=' + exactLatex((4 / 3) * R * R * R, '\\pi')
	);
}

const BUILDERS = {
	segment: buildSegment,
	line: buildLine,
	circle3: buildCircle3,
	arc3: buildArc3,
	circle2: buildCircle2,
};

document.querySelectorAll('[data-build]').forEach((btn) => {
	btn.addEventListener('click', () => {
		const fn = BUILDERS[btn.dataset.build];
		if (fn) fn();
	});
});

$('btn-clear-build').addEventListener('click', clearBuilds);
/* ------------------------------------------------------------ 鼠标交互 */

let pointerDown = null;

canvas.addEventListener('pointerdown', (ev) => {
	canvas.setPointerCapture(ev.pointerId);
	pointerDown = { x: ev.clientX, y: ev.clientY, button: ev.button, shift: ev.shiftKey };
	S.moved = 0;
});

canvas.addEventListener('pointermove', (ev) => {
	if (!pointerDown) return;

	const dx = ev.clientX - pointerDown.x;
	const dy = ev.clientY - pointerDown.y;
	pointerDown.x = ev.clientX;
	pointerDown.y = ev.clientY;
	S.moved += Math.abs(dx) + Math.abs(dy);

	if (pointerDown.button === 2 || pointerDown.shift) {
		const cam = activeCamera();
		const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
		const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
		const k = S.radius * 0.0016;
		S.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
	} else {
		if (S.oblique) {
			S.oblique = false;
			$('btn-oblique').classList.remove('on');
		}
		S.theta -= dx * 0.008;
		S.phi = clamp(S.phi - dy * 0.008, 0.06, PI - 0.06);
	}

	render();
});

function endPointer(ev) {
	if (!pointerDown) return;

	const wasClick = S.moved < 6 && pointerDown.button === 0 && !pointerDown.shift;
	pointerDown = null;

	if (wasClick) pickAt(ev);

	try {
		canvas.releasePointerCapture(ev.pointerId);
	} catch (err) {
		/* 忽略 */
	}
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', () => {
	pointerDown = null;
});

canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

canvas.addEventListener(
	'wheel',
	(ev) => {
		ev.preventDefault();
		S.radius = clamp(S.radius * Math.pow(1.0012, ev.deltaY), 0.4, 5000);
		render();
	},
	{ passive: false }
);

function pickAt(ev) {
	if (S.points.length === 0) return;

	const rect = canvas.getBoundingClientRect();
	const ndc = new THREE.Vector2(
		((ev.clientX - rect.left) / rect.width) * 2 - 1,
		-((ev.clientY - rect.top) / rect.height) * 2 + 1
	);

	const ray = new THREE.Raycaster();
	ray.setFromCamera(ndc, activeCamera());

	const hits = ray.intersectObjects(S.points.map((p) => p.mesh), false);
	if (hits.length === 0) return;

	const mesh = hits[0].object;
	const point = S.points[mesh.userData.pointIndex];
	if (point) toggleSelect(point);
}

/* ------------------------------------------------------------ 按钮 */

function setActiveViewButton(name) {
	document.querySelectorAll('[data-view]').forEach((btn) => {
		btn.classList.toggle('on', btn.dataset.view === name);
	});
}

document.querySelectorAll('[data-view]').forEach((btn) => {
	btn.addEventListener('click', () => {
		const v = btn.dataset.view;
		const map = {
			'x+': [1, 0, 0],
			'x-': [-1, 0, 0],
			'y+': [0, 1, 0],
			'y-': [0, -1, 0],
			'z+': [0, 0, 1],
			'z-': [0, 0, -1],
		};
		S.oblique = false;
		$('btn-oblique').classList.remove('on');
		const d = map[v];
		if (!d) return;
		const dir = new THREE.Vector3(d[0], d[1], d[2]);
		if (v === 'z+' || v === 'z-') {
			S.theta = -PI / 2;
			S.phi = v === 'z+' ? 0.06 : PI - 0.06;
			render();
		} else {
			setView(dir);
		}
		setActiveViewButton(v);
	});
});

$('btn-oblique').addEventListener('click', () => {
	S.oblique = true;
	S.ortho = true;
	S.phi = PI / 2;
	S.theta = -PI / 2;
	$('opt-ortho').checked = true;
	setActiveViewButton(null);
	$('btn-oblique').classList.add('on');
	render();
});

$('btn-hkl').addEventListener('click', () => {
	S.oblique = false;
	$('btn-oblique').classList.remove('on');
	const raw = $('p3-hkl').value || '';
	const nums = (raw.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
	if (nums.length < 3 || nums.every((n) => n === 0)) {
		$('p3-hkl').value = '';
		$('p3-hkl').placeholder = '写三对数，如 1 1 1';
		return;
	}
	const dir = new THREE.Vector3(nums[0], nums[1], nums[2]).normalize();
	S.theta = Math.atan2(dir.y, dir.x);
	S.phi = clamp(Math.acos(clamp(dir.z, -1, 1)), 0.06, PI - 0.06);
	setActiveViewButton(null);
	render();
});

$('p3-hkl').addEventListener('keydown', (ev) => {
	if (ev.key === 'Enter') $('btn-hkl').click();
});

$('opt-ortho').addEventListener('change', (ev) => {
	S.ortho = ev.target.checked;
	render();
});

$('btn-reset').addEventListener('click', () => {
	fitView();
	buildFrame();
	setActiveViewButton(null);
	render();
});

$('fn-mode').addEventListener('change', () => {
	const implicit = $('fn-mode').value === 'f';
	$('fn-zrow').hidden = !implicit;
	$('fn-hint').textContent = implicit ? 'F(x, y, z) = 0' : 'z = f(x, y)';
	$('fn-key').textContent = implicit ? 'F =' : 'z =';
	$('fn-expr').placeholder = implicit ? '例如 x^2 + y^2 + z^2 - 1' : 'sin(x) * cos(y)';
});

$('btn-surface').addEventListener('click', drawSurface);
$('btn-del-surface').addEventListener('click', removeSurface);
$('btn-curve').addEventListener('click', drawCurve);
$('btn-del-curve').addEventListener('click', removeCurve);
$('btn-point').addEventListener('click', addPointsFromInput);
$('btn-del-points').addEventListener('click', clearPoints);

$('pt-input').addEventListener('keydown', (ev) => {
	if (ev.key === 'Enter') addPointsFromInput();
});

/* ------------------------------------------------------------ 尺寸 / 主题 */

function resize() {
	const w = canvas.clientWidth;
	const h = canvas.clientHeight;
	if (w === 0 || h === 0) return;
	renderer.setSize(w, h, false);
	render();
}

if (window.ResizeObserver) {
	new ResizeObserver(resize).observe(canvas.parentElement);
} else {
	window.addEventListener('resize', resize);
}

function applyTheme() {
	readColors();
	/* 已有的点标签和坐标轴文字要跟着换色，直接重建最省事 */
	buildFrame();
	for (const p of S.points) {
		p.label.material.map.dispose();
		p.label.material.dispose();
		pointGroup.remove(p.label);
		const label = makeLabel(p.name, S.colors.text, 1, false);
		p.label = label;
		pointGroup.add(label);
	}
	render();
}

new MutationObserver(applyTheme).observe(document.documentElement, {
	attributes: true,
	attributeFilter: ['data-theme'],
});

/* ------------------------------------------------------------ 启动 */

readColors();
buildFrame();
resize();

/* 默认什么都不画，进来就是一张空网格 */
