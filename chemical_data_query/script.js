/*
MIT License

Copyright (c) 2026 [vinds](https://y.vinds.top)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/* ==========================================================================
   化学数据查询 —— 每个表格一个子页面, 由 <body data-json="..."> 指定数据文件
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
	const body = document.body
	const jsonUrl = body.getAttribute('data-json')
	const themeBtn = document.getElementById('b')

	/* ---------------------------------------------------------- 主题 */

	if (themeBtn) {
		themeBtn.addEventListener('click', () => {
			const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
			const next = isDark ? 'light' : 'dark'
			document.documentElement.setAttribute('data-theme', next)
			themeBtn.setAttribute('aria-label', next === 'dark' ? '切换到白天模式' : '切换到夜间模式')
			try { localStorage.setItem('theme', next) } catch (e) { /* 忽略 */ }
		})
	}

	/* ---------------------------------------------------------- 表格 */

	if (!jsonUrl) return

	const input = document.getElementById('c')
	const clearBtn = document.getElementById('d')
	const tbody = document.getElementById('f')
	const emptyBox = document.getElementById('g')
	const thead = document.getElementById('tableHeader')

	let rows = []
	let shown = []
	let columns = []

	/* 去掉标签、下标字符, 统一小写, 方便搜索 */
	const normalize = (value) => {
		if (value === undefined || value === null) return ''
		let text = String(value)
		text = text.replace(/<[^>]*>/g, '')
		text = text.replace(/[~_]/g, '')
		text = text.replace(/[\u2080-\u2089]/g, (ch) => {
			const map = { '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3', '\u2084': '4', '\u2085': '5', '\u2086': '6', '\u2087': '7', '\u2088': '8', '\u2089': '9' }
			return map[ch] || ch
		})
		return text.toLowerCase()
	}

	const paint = () => {
		if (shown.length === 0) {
			emptyBox.style.display = 'block'
			tbody.innerHTML = ''
			return
		}
		emptyBox.style.display = 'none'
		const frag = document.createDocumentFragment()
		for (let r = 0; r < shown.length; r++) {
			const row = shown[r]
			const tr = document.createElement('tr')
			for (let c = 0; c < columns.length; c++) {
				const td = document.createElement('td')
				const v = row[columns[c].key]
				td.innerHTML = (v === undefined || v === null) ? '' : v
				tr.appendChild(td)
			}
			frag.appendChild(tr)
		}
		tbody.innerHTML = ''
		tbody.appendChild(frag)
	}

	const applyFilter = (raw) => {
		const q = normalize(raw)
		if (!q) {
			shown = rows.slice()
		} else {
			shown = rows.filter((row) => {
				for (let i = 0; i < columns.length; i++) {
					const v = row[columns[i].key]
					if (v !== undefined && v !== null && normalize(v).includes(q)) return true
				}
				return false
			})
		}
		paint()
	}

	fetch(jsonUrl)
		.then((res) => {
			if (!res.ok) throw new Error()
			return res.json()
		})
		.then((data) => {
			if (!Array.isArray(data) || data.length === 0) throw new Error()

			const head = data[0]
			columns = Object.keys(head)
				.filter((key) => key !== 'thebibliography')
				.map((key) => ({ key: key, label: head[key] || key }))

			rows = data.slice(1)
			shown = rows.slice()

			thead.innerHTML = ''
			const tr = document.createElement('tr')
			for (let i = 0; i < columns.length; i++) {
				const th = document.createElement('th')
				th.textContent = columns[i].label
				tr.appendChild(th)
			}
			thead.appendChild(tr)

			paint()
		})
		.catch(() => {
			emptyBox.textContent = '数据没能加载，刷新页面再试试。'
			emptyBox.style.display = 'block'
		})

	if (input && clearBtn) {
		input.addEventListener('input', (ev) => {
			let value = ev.target.value
			if (value.length > 200) {
				value = value.slice(0, 200)
				input.value = value
			}
			clearBtn.style.display = value.length > 0 ? 'flex' : 'none'
			applyFilter(value)
		})

		clearBtn.addEventListener('click', () => {
			input.value = ''
			clearBtn.style.display = 'none'
			applyFilter('')
			input.focus()
		})

		clearBtn.style.display = 'none'
	}
})
