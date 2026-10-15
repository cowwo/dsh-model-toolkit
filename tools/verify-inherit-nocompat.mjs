// 「继承自…」只写 input + reasoningEfforts、不写 compat —— 用真实 client.js 跑通
// 「点继承 → 选来源 → 点保存」全链路，捕获真正会发给 settings.mutate 的 ops，
// 再用 dsh-llm-pi-ai 自己的 COMPAT_GATES 判定这份 ops 会不会被设置层拒绝。
//
// 用法：
//   node verify-inherit-nocompat.mjs                      # 测当前 client.js
//   node verify-inherit-nocompat.mjs <client.js 路径>      # 测指定版本（如 git show 出来的旧版）
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// 默认指向本包自己的 client.js（相对脚本自身定位，不写死绝对路径）。
const CLIENT = process.argv[2] ?? join(HERE, '..', 'client', 'client.js')
const DSH_PI_AI = '/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js'

// ── 真实目录数据：moonshotai.kimi-k3（就是当初把保存搞挂的那份 compat） ──────────
const SOURCE = {
	input: ['text', 'image'],
	levels: ['off', 'low', 'high', 'max'],
	wire: { off: null, low: 'low', high: 'high', max: 'max' },
	compat: {
		supportsStore: false, supportsDeveloperRole: false, supportsReasoningEffort: true,
		maxTokensField: 'max_tokens', supportsStrictMode: false, thinkingFormat: 'openai',
		requiresReasoningContentOnAssistantMessages: true,
		supportsMidConvoSystemMessages: true, supportsMidConvoToolAdditions: true
	},
	exact: true
}

// ── 目标线路的现状（cmd-01，api=openai-completions；Kimi 行还没有任何能力） ──────
const DEEPSEEK_COMPAT = {
	supportsStore: false, supportsDeveloperRole: false, maxTokensField: 'max_tokens',
	requiresReasoningContentOnAssistantMessages: true, thinkingFormat: 'deepseek', supportsStrictMode: true
}
const DESCRIBE = {
	ok: true,
	value: {
		namespaces: [{
			ns: 'llm-pi-ai', revision: 7,
			user: {
				providers: {
					'cmd-01': {
						displayName: 'cmd-01', api: 'openai-completions',
						compat: { supportsDeveloperRole: false },
						models: [
							{
								id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash',
								contextWindow: 1000000, input: ['text', 'image'],
								reasoningEfforts: { off: null, low: 'low', high: 'high', max: 'max' },
								compat: DEEPSEEK_COMPAT
							},
							{ id: 'deepseek/deepseek-v4.1-flash-fast', name: 'DeepSeek V4.1 Flash Fast', contextWindow: 1000000 },
							{ id: 'moonshotai/Kimi-K3', name: 'Kimi K3', contextWindow: 1000000 }
						]
					}
				}
			}
		}]
	}
}
const CATALOG = { ok: true, value: { groups: [{ id: 'moonshotai', name: 'Moonshot AI', models: [{ id: 'kimi-k3', name: 'Kimi K3', reasoning: true }] }] } }

// ── 最小 React 桩：够跑这个组件（useState 带重渲染、useEffect 只跑一次） ─────────
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

// ── 假 ctx / bridge：只实现 client.js 真正用到的那几个调用 ─────────────────────
const calls = { source: [], mutate: [] }
const settings = {
	describe: () => Promise.resolve(DESCRIBE),
	mutate: (ns, ops, revision) => { calls.mutate.push({ ns, ops, revision }); return Promise.resolve({ ok: true, value: {} }) }
}
const registrations = []
const scoped = {
	// 合并后一个 bundle 会注册多个槽位（模型能力管理 model-fit / 提供商徽章与设置页 provider-info）：
	// 这里只把「模型能力管理」那张设置页（id=model-fit）当作待渲染组件，其余槽位只登记不渲染。
	slots: { inject: (_n, cb) => cb(), register: (spec, render) => { registrations.push({ slot: spec && spec.name, id: spec && spec.id, order: spec && spec.order }); if (spec && spec.id === 'model-fit') scoped.render = render; return () => {} } },
	connection: { rpc: { call: (_p, endpoint, payload) => { calls.source.push({ endpoint, payload }); return Promise.resolve({ ok: true, value: SOURCE }) } } },
	remote: { settings, session: { modelCatalog: () => Promise.resolve(CATALOG) } }
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

// ── 渲染 / 遍历 / 点击 ────────────────────────────────────────────────────────
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
/** 最小且同时含两段文字的节点：用来把「Kimi K3」这张卡片挑出来。 */
const cardWith = (tree, ...needles) => [...walk(tree)]
	.filter((n) => n.props && typeof n.type === 'string')
	.filter((n) => needles.every((t) => textOf(n).includes(t)))
	.filter((n) => ![...walk(n)].some((c) => c !== n && c.props && needles.every((t) => textOf(c).includes(t))))

let tree = null
const settle = async () => {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 25))
		dirty = false
		tree = renderNode(scoped.render({}))
		if (!dirty) break
	}
	return tree
}

// ── 跑：加载 → 找到 Kimi 行 → 继承 → 保存 ─────────────────────────────────────
const code = readFileSync(CLIENT, 'utf8')
new Function('window', 'React', code)(fakeWindow, ReactStub)
await settle()

const kimiCard = cardWith(tree, 'Kimi K3', '继承自…')
if (kimiCard.length !== 1) {
	console.log('DEBUG render 存在 :', typeof scoped.render)
	console.log('DEBUG 按钮        :', JSON.stringify(elements(tree).filter((n) => n.type === 'button').map((n) => textOf(n)).slice(0, 12)))
	console.log('DEBUG 页面文本    :', textOf(tree).slice(0, 700))
	throw new Error('找不到唯一的 Kimi K3 卡片，找到 ' + kimiCard.length + ' 个')
}
buttons(kimiCard[0], '继承自…')[0].props.onClick()
await settle()

const chip = buttons(tree, 'Kimi K3')[0]
if (!chip) throw new Error('继承弹窗里没有 Kimi K3 这个来源')
chip.props.onClick()
await settle()

const banner = textOf(tree)
const saveButton = buttons(tree, '保存')[0]
if (!saveButton) throw new Error('找不到保存按钮')
saveButton.props.onClick()
await settle()

// ── 断言 ─────────────────────────────────────────────────────────────────────
// 断言只针对 modelCapability/source 这一个端点。
// 阶段 2 起插件挂载时会额外读设置总开关（A、B 各一次 providerBadge/settings），
// 那是预期行为，不该被算进「继承只抓一次来源」这条断言里。
const sourceCalls = calls.source.filter((c) => c.endpoint === 'modelCapability/source')
if (sourceCalls.length !== 1) {
	throw new Error(
		'modelCapability/source 调用次数异常：' + sourceCalls.length +
		'（本次全部 rpc 调用：' + JSON.stringify(calls.source.map((c) => c.endpoint)) + '）',
	)
}
if (calls.mutate.length !== 1) throw new Error('mutate 调用次数异常：' + calls.mutate.length)
const { ops, revision } = calls.mutate[0]
const modelsOp = ops.find((op) => op.path.join('.') === 'providers.cmd-01.models')
const kimi = modelsOp.value.find((m) => m.id === 'moonshotai/Kimi-K3')
const deepseek = modelsOp.value.find((m) => m.id === 'deepseek/deepseek-v4.1-flash')

// 用 dsh-llm-pi-ai 自己的 gate 表判定：这份 ops 里的 compat 会不会被设置层拒绝
const src = readFileSync(DSH_PI_AI, 'utf8')
const gates = new Function(src.slice(src.indexOf('const COMPLETIONS_COMPAT_GATE'), src.indexOf('function compatGate'))
	+ '; return { COMPAT_GATES }')().COMPAT_GATES
const offered = (api, field) => gates[api]?.[field] === 'offer'
const refused = (api, compat) => Object.keys(compat ?? {}).filter((k) => !offered(api, k))
const api = 'openai-completions'

console.log('client 文件     :', CLIENT)
console.log('注册槽位        :', JSON.stringify(registrations))
console.log('source RPC      :', sourceCalls[0].endpoint, JSON.stringify(sourceCalls[0].payload.args.request))
console.log('mutate          : ns=' + calls.mutate[0].ns, 'revision=' + String(revision), 'ops=' + ops.length + '（' + ops.map((o) => o.op + ' ' + o.path.join('.')).join('; ') + '）')
console.log('Kimi 条目       :', JSON.stringify(kimi))
console.log('deepseek 条目   : compat 保持原样 =', JSON.stringify(deepseek.compat) === JSON.stringify(DEEPSEEK_COMPAT))
console.log('来源 compat 含被拒字段:', JSON.stringify(refused(api, SOURCE.compat)))
console.log('写入 compat 被拒字段  :', JSON.stringify(refused(api, kimi.compat)))
console.log('横幅            :', (banner.match(/已从[^。]*。[^。]*。/) ?? ['(未找到)'])[0])

const problems = []
if (!kimi.input || !kimi.input.includes('image')) problems.push('Kimi 未写入图片输入')
if (JSON.stringify(kimi.reasoningEfforts) !== JSON.stringify({ off: null, low: 'low', high: 'high', max: 'max' })) problems.push('Kimi 思考等级不对：' + JSON.stringify(kimi.reasoningEfforts))
if ('compat' in kimi) problems.push('Kimi 仍被写入 compat：' + JSON.stringify(kimi.compat))
if (refused(api, kimi.compat).length > 0) problems.push('写入的 compat 会被设置层拒绝')
if (JSON.stringify(deepseek.compat) !== JSON.stringify(DEEPSEEK_COMPAT)) problems.push('deepseek 的 compat 被改动')
if (ops.length !== 1) problems.push('除模型列表外还产生了额外 ops')

console.log('\nVERDICT:', problems.length === 0 ? 'PASS —— 继承只写图片+等级，compat 干净，保存不会被拒' : 'FAIL —— ' + problems.join(' / '))
process.exit(problems.length === 0 ? 0 : 1)
