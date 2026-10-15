// 夹具 A：线路系统消息角色下拉「还原成自动」时的 unset 分支 —— 用真实 client.js 驱动
//
// 背景（覆盖缺口）：A 页的「线路系统消息角色」选回「自动」时要删掉
// `providers.<pid>.compat.supportsDeveloperRole`。但 client.js 里有一条更狠的分支：
// 如果该线路基线 compat 只剩 <= 1 个键（roleSolo），它就直接
// `unset ["providers", pid, "compat"]` —— 把整块 compat 删掉，而不是只删那一个叶子字段。
// 旧包的整套验证体系里这条分支零覆盖，本夹具把它钉住：
//
//   1) 基线 compat 有 2 个键（supportsDeveloperRole + maxTokensField）
//      → 选「自动」→ 保存 → **必须**只删叶子 ...compat.supportsDeveloperRole，不能整块删；
//   2) 基线 compat 只有 1 个键（supportsDeveloperRole）
//      → 同样操作 → 发出的是整块 unset（记录现状语义，守卫条件写的是 compatKeys.length <= 1）；
//   3) 两条线路一 2 键、一 1 键混在一起时，两条线路各自走各自的分支（边界按线路判定）。
//
// 全程只读：用假 bridge 收集真正会发给 settings.mutate 的 ops，不写任何文件、不碰 ~/.dsh。
//
// 用法：
//   node tools/verify-role-unset.mjs                    # 测本包 client.js
//   node tools/verify-role-unset.mjs <client.js 路径>    # 测指定版本（如 git show 出来的旧版）
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLIENT = process.argv[2] ?? join(HERE, '..', 'client', 'client.js')
const code = readFileSync(CLIENT, 'utf8')

// ── 最小 React 桩：useState 带重渲染、useEffect 只跑一次（够跑这个组件） ────────
const hookStore = new Map()
let hookIndex = 0
let dirty = false
const ReactStub = {
	createElement(type, props, ...children) {
		return { type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children } }
	},
	useState(init) {
		const key = 'hook#' + hookIndex++
		if (!hookStore.has(key)) hookStore.set(key, typeof init === 'function' ? init() : init)
		return [hookStore.get(key), (v) => { hookStore.set(key, typeof v === 'function' ? v(hookStore.get(key)) : v); dirty = true }]
	},
	useEffect(fn) { const key = 'effect#' + hookIndex++; if (!hookStore.has(key)) { hookStore.set(key, true); fn() } },
	useMemo(fn) { return fn() },
	useCallback(fn) { return fn },
	useRef(v) { return { current: v } }
}

// ── 渲染 / 遍历 ───────────────────────────────────────────────────────────────
function renderNode(node) {
	if (node === null || node === undefined || typeof node === 'boolean') return null
	if (typeof node === 'string' || typeof node === 'number') return String(node)
	if (Array.isArray(node)) return node.map(renderNode)
	if (typeof node.type === 'function') { hookIndex = 0; return renderNode(node.type(node.props)) }
	return { type: node.type, props: { ...node.props, children: renderNode(node.props.children) } }
}
function* walk(node) {
	if (node === null || node === undefined || typeof node === 'boolean') return
	if (typeof node === 'string' || typeof node === 'number') { yield String(node); return }
	if (Array.isArray(node)) { for (const c of node) yield* walk(c); return }
	if (node.props) { yield node; yield* walk(node.props.children) }
}
const textOf = (node) => [...walk(node)].filter((n) => typeof n === 'string').join(' ').replace(/\s+/g, ' ').trim()
const elements = (tree) => [...walk(tree)].filter((n) => n.props && typeof n.type === 'string')
const buttons = (tree, label) => elements(tree).filter((n) => n.type === 'button' && textOf(n) === label)
/** 最小且同时含两段文字的节点：用来把一行「线路角色」挑出来。 */
const nodeWith = (tree, ...needles) => [...walk(tree)]
	.filter((n) => n.props && typeof n.type === 'string')
	.filter((n) => needles.every((t) => textOf(n).includes(t)))
	.filter((n) => ![...walk(n)].some((c) => c !== n && c.props && needles.every((t) => textOf(c).includes(t))))

// ── 每份剧本都从零起步：新建假 ctx / 假 bridge，重新加载一次真实 client.js ──────
function makeEnv(providerMap) {
	const calls = { mutate: [] }
	const registrations = []
	const scoped = {
		slots: {
			inject: (_n, cb) => cb(),
			register: (spec, render) => {
				registrations.push({ slot: spec && spec.name, id: spec && spec.id, order: spec && spec.order })
				if (spec && spec.id === 'model-fit') scoped.render = render
				return () => {}
			}
		},
		connection: { rpc: { call: () => Promise.resolve({ ok: true, value: {} }) } },
		remote: {
			settings: {
				describe: () => Promise.resolve({ ok: true, value: { namespaces: [{ ns: 'llm-pi-ai', revision: 7, user: { providers: providerMap } }] } }),
				mutate: (ns, ops, revision) => { calls.mutate.push({ ns, ops, revision }); return Promise.resolve({ ok: true, value: {} }) }
			},
			session: { modelCatalog: () => Promise.resolve({ ok: true, value: { groups: [] } }) }
		}
	}
	const ctx = { inject: (_names, cb) => { cb(scoped); return () => {} } }
	const fakeWindow = {
		__ModuleLoader__: {
			load: ({ factory }) => {
				const mod = factory((name) => { if (name === 'react') return ReactStub; throw new Error('unexpected require: ' + name) })
				mod.apply(ctx)
			}
		}
	}
	return { calls, scoped, fakeWindow, registrations }
}

const settle = async (env) => {
	let tree = null
	for (let i = 0; i < 12; i++) {
		await new Promise((r) => setTimeout(r, 25))
		dirty = false
		tree = renderNode(env.scoped.render({}))
		if (!dirty) break
	}
	return tree
}

/** 加载 → 渲染 → 把指定线路的下拉改成「自动」→ 点保存，返回真正发出的 ops。 */
async function scenario(providerMap, displayNames) {
	hookStore.clear()
	hookIndex = 0
	dirty = false
	const env = makeEnv(providerMap)
	new Function('window', 'React', code)(env.fakeWindow, ReactStub)
	let tree = await settle(env)

	if (!env.registrations.some((r) => r.id === 'model-fit')) throw new Error('「模型能力管理」设置页没有注册（id=model-fit）')
	const baselineChoices = {}
	for (const displayName of [].concat(displayNames)) {
		const row = nodeWith(tree, displayName, '自动（交给 pi-ai 推断）')
		if (row.length !== 1) throw new Error('找不到唯一的线路角色行：' + displayName + '（找到 ' + row.length + ' 个）')
		const select = elements(row[0]).find((n) => n.type === 'select')
		if (!select) throw new Error('线路角色行里没有 select：' + displayName)
		baselineChoices[displayName] = select.props.value
		// 改下拉（真实 onChange 路径）→ 每次都重新渲染再找下一行
		select.props.onChange({ target: { value: 'auto' } })
		tree = await settle(env)
	}
	if (!buttons(tree, '保存')[0]) throw new Error('找不到保存按钮')

	const saveButton = buttons(tree, '保存')[0]
	saveButton.props.onClick()
	await settle(env)

	return { ops: (env.calls.mutate[0] || {}).ops ?? [], mutateCalls: env.calls.mutate.length, baselineChoices }
}

// ── 剧本数据 ─────────────────────────────────────────────────────────────────
const model = (id, name) => ({ id, name, contextWindow: 1000000 })
const mkTwoKeys = () => ({ 'cmd-01': { displayName: 'cmd-01', api: 'openai-completions', compat: { supportsDeveloperRole: false, maxTokensField: 'max_tokens' }, models: [model('deepseek/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash')] } })
const mkOneKey = () => ({ 'cmd-01': { displayName: 'cmd-01', api: 'openai-completions', compat: { supportsDeveloperRole: false }, models: [model('deepseek/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash')] } })
const mkMixed = () => ({
	'cmd-01': { displayName: 'cmd-01', api: 'openai-completions', compat: { supportsDeveloperRole: false, maxTokensField: 'max_tokens' }, models: [model('deepseek/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash')] },
	'og-01': { displayName: 'og-01', api: 'openai-responses', compat: { supportsDeveloperRole: false }, models: [model('opencode/zen-go', 'Zen Go')] }
})

let failed = 0
const check = (what, actual, expected) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expected)
	if (!ok) failed++
	console.log((ok ? '  ok   ' : '  FAIL ') + what + '  =>  ' + JSON.stringify(actual) + (ok ? '' : '   (期望 ' + JSON.stringify(expected) + ')'))
}

console.log('client 文件 :', CLIENT)

console.log('\n【线路 compat 有 2 个键：还原成自动，只删叶子，绝不整块删】')
{
	const r = await scenario(mkTwoKeys(), 'cmd-01')
	check('下拉基线状态是 system（compat 写了 false）', r.baselineChoices['cmd-01'], 'system')
	check('只发了一次 mutate', r.mutateCalls, 1)
	check('发出的 op 只有一条（没有连带改动模型列表）', r.ops.length, 1)
	check('op 是 unset 叶子 ...compat.supportsDeveloperRole', r.ops[0], { op: 'unset', path: ['providers', 'cmd-01', 'compat', 'supportsDeveloperRole'] })
	check('路径深度是 4（不是整块 compat）', (r.ops[0].path || []).join('.'), 'providers.cmd-01.compat.supportsDeveloperRole')
	check('没有整块 unset compat', r.ops.some((o) => o.op === 'unset' && o.path.join('.') === 'providers.cmd-01.compat'), false)
}

console.log('\n【线路 compat 只有 1 个键：现状语义 = 整块删 compat（记录用）】')
{
	const r = await scenario(mkOneKey(), 'cmd-01')
	check('下拉基线状态是 system', r.baselineChoices['cmd-01'], 'system')
	check('只发了一次 mutate', r.mutateCalls, 1)
	check('op 是整块 unset providers.cmd-01.compat', r.ops[0], { op: 'unset', path: ['providers', 'cmd-01', 'compat'] })
	check('不再是只删叶子（守卫 compatKeys.length <= 1）', r.ops.some((o) => o.path.join('.') === 'providers.cmd-01.compat.supportsDeveloperRole'), false)
}

console.log('\n【一 2 键 + 一 1 键并存：两条线路各走各的分支】')
{
	const r = await scenario(mkMixed(), ['cmd-01', 'og-01'])
	check('两条线路都改成自动', [r.baselineChoices['cmd-01'], r.baselineChoices['og-01']], ['system', 'system'])
	check('只发了一次 mutate', r.mutateCalls, 1)
	check('两条线路各一条 op', r.ops.length, 2)
	check('cmd-01（2 键）只删叶子', r.ops[0], { op: 'unset', path: ['providers', 'cmd-01', 'compat', 'supportsDeveloperRole'] })
	check('og-01（1 键）整块删 compat', r.ops[1], { op: 'unset', path: ['providers', 'og-01', 'compat'] })
}

console.log('\n' + (failed ? failed + ' 项不符' : '全部符合预期'))
process.exit(failed ? 1 : 0)
