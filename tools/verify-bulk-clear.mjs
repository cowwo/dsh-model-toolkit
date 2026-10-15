// 夹具 B：「清空能力」按钮的行为特征 —— 用真实 client.js 驱动
//
// ⚠️ 本夹具记录的是**已知风险行为**，不是期望行为；第二阶段若改语义，本夹具需同步更新。
//
// 现状（phase 1 的产品决策是「先记录、不改」）：工具条上的「清空能力」一次性对
// **所有线路、所有模型** delete input / delete reasoningEfforts / delete compat，
// 没有二次确认，点「保存」后不可逆。它砸掉的包括用户手写的 compat
// （thinkingFormat / maxTokensField 这类只认手工配置的开关）。
//
// 本夹具只记录现状、不评判：
//   1) 点「清空能力」后草稿里所有模型的三项都被删（含手写 thinkingFormat / maxTokensField）；
//   2) 范围是全局的——即使搜索框只显示 1 个模型，被隐藏的模型同样被清；
//   3) 保存前点「撤销修改」能全部恢复（说明只有保存才不可逆）；
//   4) 「清空能力」本身不发 mutate（不落盘），落盘只发生在点「保存」时。
//
// 全程只读：用假 bridge 收集真正会发给 settings.mutate 的 ops，不写任何文件、不碰 ~/.dsh。
//
// 用法：
//   node tools/verify-bulk-clear.mjs                    # 测本包 client.js
//   node tools/verify-bulk-clear.mjs <client.js 路径>    # 测指定版本
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLIENT = process.argv[2] ?? join(HERE, '..', 'client', 'client.js')
const code = readFileSync(CLIENT, 'utf8')

// ── 夹具基线：3 个模型，全部都带能力、其中 2 个带手写 compat ───────────────────
const CAPABILITY_KEYS = ['input', 'reasoningEfforts', 'compat']
const PROVIDERS = {
	'cmd-01': {
		displayName: 'cmd-01', api: 'openai-completions',
		compat: { supportsDeveloperRole: false, maxTokensField: 'max_tokens' },
		models: [
			{
				id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', contextWindow: 1000000,
				input: ['text', 'image'],
				reasoningEfforts: { off: null, high: 'high', max: 'max' },
				compat: { thinkingFormat: 'deepseek', maxTokensField: 'max_tokens' }
			},
			{ id: 'moonshotai/Kimi-K3', name: 'Kimi K3', contextWindow: 1000000, input: ['text'] }
		]
	},
	'og-01': {
		displayName: 'og-01', api: 'openai-responses',
		compat: { supportsDeveloperRole: false, maxTokensField: 'max_tokens' },
		models: [
			{
				id: 'opencode/zen-go', name: 'Zen Go', contextWindow: 200000,
				input: ['text', 'image'],
				reasoningEfforts: { off: null, low: 'low' },
				compat: { thinkingFormat: 'openai', maxTokensField: 'max_tokens' }
			}
		]
	}
}

// ── 最小 React 桩：useState 带重渲染、useEffect 只跑一次 ───────────────────────
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
const byType = (tree, type) => elements(tree).filter((n) => n.type === type)
/** 「compat·xxx」标签：直接证明草稿里还有手写的 compat.thinkingFormat。 */
const compatTags = (tree) => byType(tree, 'span').filter((n) => textOf(n).startsWith('compat·'))
/** 点亮的能力 chip：chipStyle(on) 的 on 分支用品牌色边框。 */
const onChips = (tree) => elements(tree).filter((n) => n.props && n.props.style && n.props.style.border === '1px solid var(--dsw-alias-brand-primary)')
const checkboxes = (tree) => byType(tree, 'input').filter((n) => n.props.type === 'checkbox')
const checkedBoxes = (tree) => checkboxes(tree).filter((n) => n.props.checked === true)
const banner = (tree) => (textOf(tree).match(/将修改 \d+ 个模型能力 · \d+ 条线路角色|没有未保存的修改/) ?? ['(未找到)'])[0]
const searchBox = (tree) => byType(tree, 'input').find((n) => n.props.placeholder === '搜索模型 / 供应商…')

// ── 假 ctx / 假 bridge：只实现 client.js 真正用到的那几个调用 ─────────────────
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
				describe: () => Promise.resolve({ ok: true, value: { namespaces: [{ ns: 'llm-pi-ai', revision: 3, user: { providers: providerMap } }] } }),
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

async function boot() {
	hookStore.clear()
	hookIndex = 0
	dirty = false
	const env = makeEnv(PROVIDERS)
	new Function('window', 'React', code)(env.fakeWindow, ReactStub)
	let tree = await settle(env)
	if (!env.registrations.some((r) => r.id === 'model-fit')) throw new Error('「模型能力管理」设置页没有注册（id=model-fit）')
	/** 点一个按钮 → 重新渲染 → 返回新树。 */
	const click = async (label) => {
		const b = buttons(tree, label)[0]
		if (!b) throw new Error('找不到按钮：' + label)
		b.props.onClick()
		tree = await settle(env)
		return tree
	}
	return { env, click, setQuery: async (v) => { searchBox(tree).props.onChange({ target: { value: v } }); tree = await settle(env); return tree } }
}

let failed = 0
const check = (what, actual, expected) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expected)
	if (!ok) failed++
	console.log((ok ? '  ok   ' : '  FAIL ') + what + '  =>  ' + JSON.stringify(actual) + (ok ? '' : '   (期望 ' + JSON.stringify(expected) + ')'))
}

console.log('client 文件 :', CLIENT)

console.log('\n【夹具基线自检：否则后面的断言没有意义】')
check('基线共 3 个模型', Object.values(PROVIDERS).reduce((n, p) => n + p.models.length, 0), 3)
check('基线确实手写了 thinkingFormat / maxTokensField', JSON.stringify(PROVIDERS).split('maxTokensField').length - 1 >= 3, true)

console.log('\n【清空能力：草稿里所有线路所有模型的 input / reasoningEfforts / compat 全被删】')
{
	const { env, click, setQuery } = await boot()
	let tree = await settle(env)
	check('基线：2 个手写 compat 标签（deepseek / openai）', compatTags(tree).map(textOf).sort(), ['compat·deepseek', 'compat·openai'])
	check('基线：5 个点亮的能力 chip', onChips(tree).length, 5)
	check('基线：2 个勾上的「图片」复选框', checkedBoxes(tree).length, 2)
	check('基线：3 张模型卡', buttons(tree, '继承自…').length, 3)
	check('基线：没有未保存的修改', banner(tree), '没有未保存的修改')

	// 先用搜索框把可见范围缩到 1 个模型——验证「清空」不吃筛选
	tree = await setQuery('Kimi K3')
	check('搜索框生效：只剩 1 张模型卡', buttons(tree, '继承自…').length, 1)

	tree = await click('清空能力')
	check('「清空能力」本身不落盘（0 次 mutate）', env.calls.mutate.length, 0)
	check('清空后仍只剩 1 张卡（草稿范围没被筛选影响）', buttons(tree, '继承自…').length, 1)

	// 放开筛选再看：被隐藏的模型同样被清空 → 范围是全局的
	tree = await setQuery('')
	check('清空后：3 张模型卡都还在', buttons(tree, '继承自…').length, 3)
	check('清空后：compat 标签全没了（含手写 thinkingFormat）', compatTags(tree).length, 0)
	check('清空后：点亮的能力 chip 全没了（含手写推理等级）', onChips(tree).length, 0)
	check('清空后：图片复选框全不勾了', checkedBoxes(tree).length, 0)
	check('清空后：变更统计是 3 个模型能力 · 0 条线路角色（含被筛掉的 deepseek）', banner(tree), '将修改 3 个模型能力 · 0 条线路角色')

	await click('保存')
	check('保存发了 1 次 mutate', env.calls.mutate.length, 1)
	const ops = (env.calls.mutate[0] || {}).ops ?? []
	check('ops 是两条 set（cmd-01 / og-01 的模型列表），没有线路角色 op', ops.map((o) => o.op + ' ' + o.path.join('.')), ['set providers.cmd-01.models', 'set providers.og-01.models'])
	const saved = {}
	for (const pid of ['cmd-01', 'og-01']) {
		const op = ops.find((o) => o.path.join('.') === 'providers.' + pid + '.models')
		saved[pid] = (op && op.value) || []
	}
	check('cmd-01 两个模型都提交了', saved['cmd-01'].map((m) => m.id).sort(), ['deepseek/deepseek-v4.1-flash', 'moonshotai/Kimi-K3'])
	check('og-01 的模型也提交了（全局范围）', saved['og-01'].map((m) => m.id), ['opencode/zen-go'])
	const leftovers = []
	for (const [pid, models] of Object.entries(saved)) {
		for (const m of models) for (const k of CAPABILITY_KEYS) if (k in m) leftovers.push(pid + '/' + m.id + '.' + k)
	}
	check('落盘值里没有任何 input / reasoningEfforts / compat 残留', leftovers, [])
	check('落盘值里没有手写的 thinkingFormat / maxTokensField 残留', [...JSON.stringify(saved).matchAll(/thinkingFormat|maxTokensField/g)].length, 0)
}

console.log('\n【保存前点「撤销修改」：全部恢复（只有保存才不可逆）】')
{
	const { env, click } = await boot()
	let tree = await settle(env)
	await click('清空能力')
	tree = await settle(env)
	check('清空后 compat 标签为 0', compatTags(tree).length, 0)
	check('清空后 chip 为 0', onChips(tree).length, 0)
	check('清空后复选框全不勾', checkedBoxes(tree).length, 0)
	check('清空后变更统计 3 个模型能力', banner(tree), '将修改 3 个模型能力 · 0 条线路角色')
	check('「撤销修改」此时可用（有改动）', buttons(tree, '撤销修改')[0].props.disabled, false)

	tree = await click('撤销修改')
	check('撤销后：仍一次 mutate 都没发（撤销不等于落盘）', env.calls.mutate.length, 0)
	check('撤销后：2 个手写 compat 标签回来了', compatTags(tree).map(textOf).sort(), ['compat·deepseek', 'compat·openai'])
	check('撤销后：5 个 chip 回来了', onChips(tree).length, 5)
	check('撤销后：2 个图片复选框重新勾上', checkedBoxes(tree).length, 2)
	check('撤销后：变更统计归零', banner(tree), '没有未保存的修改')
	check('撤销后：「撤销修改」按钮变灰（无改动可撤）', buttons(tree, '撤销修改')[0].props.disabled, true)
}

console.log('\n' + (failed ? failed + ' 项不符' : '全部符合预期（记录的是现状，不是期望）'))
process.exit(failed ? 1 : 0)
