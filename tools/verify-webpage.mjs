#!/usr/bin/env node
/**
 * 离线验收脚本 —— dsh-model-toolkit「独立整页设置页」v1
 * 契约：_spec/webpage-v1.md（§1 路由含 2026-10-16 修订 / §2 安全 / §3 §4 数据形状 / §6 验收标准）
 *
 * 怎么跑：
 *   node tools/verify-webpage.mjs                # 只跑断言，退出码 0=全过 / 1=有失败
 *   node tools/verify-webpage.mjs --dump <目录>   # 额外把真实数据的 state/quota 落盘
 *   node tools/verify-webpage.mjs --self-test     # 负向对照：故意改坏被测代码，证明断言会失败
 *
 * 设计原则（谁是"被测真代码"）：
 *   - 用**真 cordis Context** 造一个最小假 ctx（webServer / connection / settings / llm /
 *     credentials 全是假的），再调插件自己的 `apply(ctx)`。所以被测的是**插件真代码**：
 *     真的 Service 构造、真的 registerWebRoutes、真的 handler、真读 web/ 静态文件。
 *     只有"外部世界"（上游服务、网络、DSH 配置文件）是假的。
 *   - 路由分发（exact 表优先、prefix 表最长匹配优先）按 dsh-host-webserver/lib/index.js:322-332
 *     的语义在脚本内复刻；这是唯一一处复刻，不是被测代码。
 *
 * 不联网：credentials.resolve 一律返回"没有密钥"，所以 quota 走 no-api-key 失败分支；
 * 另有 fetch 哨兵，一旦真出网就把该项记为失败并在汇总里报出来。
 *
 * 本脚本只读：不写 lib/、web/、package.json、client/、_spec/。- --dump 是唯一写操作。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* ============================== 常量与路径 ============================== */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG_DIR = path.resolve(HERE, '..')
const PKG_ENTRY = path.join(PKG_DIR, 'lib', 'index.js')
const WEB_DIR = path.join(PKG_DIR, 'web')
const BASE = '/dsh-model-toolkit'
const PI_AI_NS = 'llm-pi-ai'

// 契约 §2.2 / §2.3 的期望头值（逐字）
const EXPECT_CSP =
	"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'"
const EXPECT_NOSNIFF = 'nosniff'
const EXPECT_REFERRER = 'no-referrer'

// §3 prefs 的 8 个键（冻结）
const PREFS_KEYS = [
	'capabilityEditor',
	'badgeAndQuota',
	'hoverRefresh',
	'autoRefreshOn',
	'autoRefreshMin',
	'showMore',
	'fontSize',
	'language'
]

// reasoningEfforts 允许的等级名（与 lib/index.js 的 REASONING_LEVELS 逐字对齐）
const REASONING_LEVELS_EXPECT = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
// /api/catalog 的候选上限（与 lib/index.js 的 CATALOG_MAX_MODELS 对齐）
const CATALOG_MAX_EXPECT = 500

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const PATCH_YML = path.join(DSH_HOME, 'profiles', 'web', 'cordis.patch.yml')
const PREFS_JSON = path.join(DSH_HOME, 'dsh-provider-info.json')
const CREDS_YAML = path.join(DSH_HOME, '.credentials.yaml')

/* ============================== 小工具 ============================== */

const argv = process.argv.slice(2)
const DUMP_FLAG = argv.indexOf('--dump')
const DUMP_DIR = DUMP_FLAG >= 0 ? argv[DUMP_FLAG + 1] : null

/** 没有真实配置时的兜底输入，只为让脚本在任何机器上都跑得通。 */
const FIXTURE_PI_AI = {
	providers: {
		demo: {
			displayName: 'Demo',
			apiKeyEnv: 'DEMO_API_KEY',
			baseURL: 'https://api.deepseek.com',
			compat: { supportsDeveloperRole: false },
			models: [
				{ id: 'demo-v1', name: 'Demo V1', input: ['text', 'image'], reasoningEfforts: { off: null, high: 'high' } },
				{ id: 'demo-v1-fast', name: 'Demo V1 Fast', input: ['text'] }
			]
		}
	}
}

/** §9.2 P0-1 专用夹具：profile.api 与 model.api 不同值 + 重复值 + 缺值，用来验「并集去重」。 */
const API_FIXTURE_PI_AI = {
	providers: {
		'fixture-api': {
			displayName: 'Fixture API',
			apiKeyEnv: 'FIXTURE_API_KEY',
			baseURL: 'https://api.deepseek.com',
			api: 'openai-completions',
			compat: { supportsDeveloperRole: true },
			models: [
				{ id: 'fx-a', api: 'openai-responses' },
				{ id: 'fx-b', api: 'openai-responses' }, // 与上一条重复 → 必须去重
				{ id: 'fx-c' }, // 没有 api → 不贡献
				{ id: 'fx-d', api: 'openai-completions' } // 与 profile.api 重复 → 必须去重
			]
		},
		'fixture-no-api': {
			displayName: 'Fixture No API',
			baseURL: 'https://api.example.invalid',
			models: [{ id: 'fx-e' }]
		}
	}
}

/** 上面夹具对应的 provider 目录（state 的 providers[] 从这条目录来）。 */
const API_FIXTURE_ROUTES = [
	{ id: 'fixture-api', name: 'Fixture API' },
	{ id: 'fixture-no-api', name: 'Fixture No API' }
]

/** 夹具 harness 的统一入口：settings 只有 llm-pi-ai 一条，目录固定两条。 */
function apiFixtureRows() {
	return [{ ns: 'ui-chat', value: {}, revision: 1 }, { ns: PI_AI_NS, value: API_FIXTURE_PI_AI, revision: 5 }]
}

const API_FIXTURE_OPTS = {
	settingsRows: apiFixtureRows,
	registeredRoutes: API_FIXTURE_ROUTES,
	configurable: API_FIXTURE_ROUTES.map((r) => ({ provider: r.id, displayName: r.name, settingsNs: PI_AI_NS, settingsPath: ['providers', r.id] }))
}

function readYamlModule() {
	// yaml 是 CommonJS 包。优先从插件自己的 node_modules 解析，
	// 再退到 DSH 安装目录（本机实测在 /usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/yaml）。
	const tries = [
		() => createRequire(path.join(PKG_DIR, 'package.json')).resolve('yaml'),
		() => createRequire(path.join(HERE, 'noop.js')).resolve('yaml'),
		() => createRequire('/usr/local/lib/node_modules/@deepseek-ai/dsh/package.json').resolve('yaml')
	]
	for (const t of tries) {
		try {
			return t()
		} catch {
			/* 试下一个落点 */
		}
	}
	return null
}

async function loadYaml() {
	const resolved = readYamlModule()
	if (!resolved) return null
	const mod = await import(pathToFileURL(resolved).href)
	const api = mod && typeof mod.parse === 'function' ? mod : mod && mod.default
	return api && typeof api.parse === 'function' ? api : null
}

/** 从 profile 补丁层里取某条 loader entry 的 config（同 id 多条时取最后一条生效的）。 */
function pickPatchEntry(doc, id) {
	if (!Array.isArray(doc)) return null
	let found = null
	for (const entry of doc) {
		if (entry && entry.id === id && entry.config && typeof entry.config === 'object') found = entry.config
	}
	return found
}

/** 递归收集 YAML 文档里所有"看起来像密钥"的标量字符串值（>=8 字符）。 */
function collectSecretValues(node, out = []) {
	if (typeof node === 'string') {
		if (node.length >= 8) out.push(node)
		return out
	}
	if (Array.isArray(node)) {
		for (const item of node) collectSecretValues(item, out)
		return out
	}
	if (node && typeof node === 'object') {
		for (const value of Object.values(node)) collectSecretValues(value, out)
	}
	return out
}

/* ============================== 断言收集器 ============================== */

const results = []
const notes = []

async function check(id, title, fn) {
	let outcome
	try {
		outcome = await fn()
	} catch (err) {
		outcome = { ok: false, detail: '断言自身抛错: ' + (err && err.message ? err.message : String(err)) }
	}
	const ok = !!(outcome && outcome.ok)
	const detail = outcome && outcome.detail ? String(outcome.detail) : ''
	results.push({ id, title, ok, detail })
	const tag = ok ? 'PASS' : 'FAIL'
	console.log(`${ok ? '  ' : '!!'}[${String(id).padStart(2, ' ')}] ${tag}  ${title}`)
	if (detail) for (const line of detail.split('\n')) console.log(`        ${line}`)
	return ok
}

function skip(id, title, detail) {
	results.push({ id, title, ok: null, detail })
	console.log(`  [${String(id).padStart(2, ' ')}] SKIP  ${title}`)
	if (detail) for (const line of String(detail).split('\n')) console.log(`        ${line}`)
}

/* ============================== 假 req / 假 res ============================== */

const ABSENT = Symbol('absent-service')

/**
 * 假 res：模仿 node:http ServerResponse 里被测代码真正用到的那一面。
 * 头名统一小写（node 的 getHeaderNames()/裸对象存取在实际服务里就是小写）。
 */
function makeRes() {
	const headers = new Map()
	const state = { statusCode: 200, writableEnded: false, headers, body: '' }
	return {
		get statusCode() {
			return state.statusCode
		},
		set statusCode(v) {
			state.statusCode = v
		},
		get writableEnded() {
			return state.writableEnded
		},
		setHeader(name, value) {
			headers.set(String(name).toLowerCase(), value)
		},
		getHeader(name) {
			return headers.get(String(name).toLowerCase())
		},
		getHeaderNames() {
			return [...headers.keys()]
		},
		end(chunk) {
			state.body = chunk === undefined || chunk === null ? '' : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
			state.writableEnded = true
		},
		_result() {
			return { status: state.statusCode, headers, body: state.body, ended: state.writableEnded }
		}
	}
}

/* ============================== 被测 harness ============================== */

/**
 * 建一条 harness。mode='apply' 走插件真正的入口 apply(ctx)；
 * mode='direct' 直接 new ProviderBadgeService（只在"connection 服务缺失"这一条上必须如此，
 * 因为 static inject 里有 connection，apply() 那条路在缺服务时根本不会实例化）。
 */
async function buildHarness(opts) {
	const o = opts || {}
	const { Context } = await import(pathToFileURL(path.join(PKG_DIR, 'node_modules', '@deepseek-ai', 'cordis', 'lib', 'index.js')).href)
	const plugin = await import(pathToFileURL(PKG_ENTRY).href)

	const routes = []
	const calls = { register: 0, requestRejection: 0, describe: 0, mutate: 0 }
	const mutateCalls = []
	const ctx = new Context()

	const webServer = {
		register(route) {
			calls.register += 1
			if (!route || typeof route.path !== 'string' || typeof route.handler !== 'function') {
				throw new Error('webServer.register: 收到畸形 route')
			}
			routes.push(route)
			return () => {
				const i = routes.indexOf(route)
				if (i >= 0) routes.splice(i, 1)
			}
		}
	}
	ctx.provide('webServer', webServer)

	// connection：ABSENT 表示"服务缺失"，用来验失败关闭。
	const connection = o.connection === undefined ? { requestRejection: () => undefined } : o.connection
	if (connection !== ABSENT) {
		// 负向对照：把信任校验改成"永远放行"，用来证明断言 9 不是空过。
		ctx.provide('connection', process.env.VW_MUTATE === 'trust-ignore' ? { requestRejection: () => undefined } : connection)
	}

	const settingsRows = typeof o.settingsRows === 'function' ? o.settingsRows : () => o.settingsRows || []
	const settingsService = {
		describe() {
			calls.describe += 1
			return settingsRows()
		}
	}
	// 写接口（契约 §7）需要 mutate。默认桩只记账；具体行为由 o.mutate 决定（可配置成抛 conflict 错）。
	// o.noMutate=true 可以模拟"服务没有 mutate 方法"。
	if (o.noMutate !== true) {
		settingsService.mutate = async (ns, ops, revision) => {
			calls.mutate += 1
			mutateCalls.push({ ns, ops: JSON.parse(JSON.stringify(ops)), revision })
			if (typeof o.mutate === 'function') return o.mutate(ns, ops, revision)
			return undefined
		}
	}
	ctx.provide('settings', settingsService)

	ctx.provide('llm', {
		listProviders: () => o.registeredRoutes || [],
		listConfigurableProviders: () => o.configurable || [],
		resolveModelInfo: async () => null
	})

	ctx.provide('credentials', {
		resolve: async (name) => {
			if (o.credentialsResolve) return o.credentialsResolve(name)
			// 默认：一律"没有密钥" —— quota 因此走失败分支，绝不联网。
			return { value: null }
		}
	})

	let service = null
	let driver = ''
	if (o.mode === 'direct') {
		service = new plugin.ProviderBadgeService(ctx, {})
		driver = 'direct-new ProviderBadgeService'
	} else {
		await ctx.plugin(plugin.default)
		service = ctx.providerBadge
		driver = 'apply(ctx)'
	}

	if (!service) throw new Error('harness: 服务未实例化')

	// 路由分发：复刻 dsh-host-webserver 的 match()（exact 表优先，prefix 表最长优先）。
	const exact = new Map()
	const prefixes = new Map()
	for (const r of routes) (r.kind === 'exact' ? exact : prefixes).set(r.path, r)
	function match(pathname) {
		const hit = exact.get(pathname)
		if (hit !== undefined) return hit
		let best
		for (const [prefix, route] of prefixes) {
			if (pathname !== prefix && !pathname.startsWith(prefix + '/')) continue
			if (best === undefined || prefix.length > best.path.length) best = route
		}
		return best
	}

	/**
	 * 假 req：模仿 node:http IncomingMessage 里被测代码用到的那一面（url/method/headers + 流）。
	 * spec.body 存在时按微任务吐出 data/end 事件——写接口要从流里读请求体。
	 */
	function makeReq(spec) {
		const listeners = new Map()
		const req = {
			url: spec.url,
			method: spec.method || 'GET',
			headers: spec.headers || {},
			on(event, cb) {
				if (!listeners.has(event)) listeners.set(event, [])
				listeners.get(event).push(cb)
				return req
			},
			removeListener() {
				return req
			},
			destroy() {
				return req
			}
		}
		const chunks = spec.body === undefined ? [] : Array.isArray(spec.body) ? spec.body : [spec.body]
		queueMicrotask(() => {
			for (const c of chunks) {
				const buf = Buffer.isBuffer(c) ? c : Buffer.from(String(c), 'utf8')
				for (const cb of listeners.get('data') || []) cb(buf)
			}
			for (const cb of listeners.get('end') || []) cb()
		})
		return req
	}

	async function doRequest(spec) {
		const url = spec.url
		const pathname = new URL(url, 'http://x').pathname
		const route = match(pathname)
		const res = makeRes()
		if (route === undefined) {
			// webserver 在没有任何路由命中且无 fallback 时的行为：裸 404。
			res.statusCode = 404
			res.end()
			return res._result()
		}
		await route.handler(makeReq(spec), res)
		return res._result()
	}
	let dispatch = doRequest
	// 只有 --self-test 的负向对照会设这个环境变量；正常跑永远是空。
	if (process.env.VW_MUTATE) dispatch = applyMutation(process.env.VW_MUTATE, service, doRequest)

	return {
		ctx,
		service,
		routes,
		calls,
		mutateCalls,
		request: (spec) => dispatch(spec),
		driver,
		dispose: async () => {
			try {
				await ctx.stop?.()
			} catch {
				/* 收尾尽力而为 */
			}
		}
	}
}

/* ---------------- 负向对照用的"故意改坏"注入（只在 --self-test 下启用）---------------- */

function pathOf(req) {
	return new URL(String(req.url || '/'), 'http://localhost').pathname
}

/**
 * 把被测服务（或 harness 的 request 层）故意改坏一处，用来证明对应断言**真的会失败**。
 * 只在 `--self-test` 的隔离子进程里生效（VW_MUTATE=<名字>），正常跑不会碰。
 */
function applyMutation(name, svc, baseRequest) {
	const patchPage = (make) => {
		const orig = svc.servePage.bind(svc)
		svc.servePage = make(orig)
	}
	switch (name) {
		case 'trust-ignore':
			// 这一处不在 service 上改，而是在 buildHarness 里把 connection 假服务换成"永远放行"。
			return baseRequest
		case 'absolute-location':
			patchPage((orig) => async (req, res) => {
				if (pathOf(req) === BASE) {
					res.statusCode = 308
					res.setHeader('location', '/dsh-model-toolkit/')
					res.end()
					return
				}
				return orig(req, res)
			})
			return baseRequest
		case 'redirect-body':
			patchPage((orig) => async (req, res) => {
				if (pathOf(req) === BASE) {
					res.statusCode = 308
					res.setHeader('location', 'dsh-model-toolkit/')
					res.end('moved')
					return
				}
				return orig(req, res)
			})
			return baseRequest
		case 'no-308':
			patchPage((orig) => async (req, res) =>
				pathOf(req) === BASE ? svc.serveAsset(req, res, 'index.html', 'text/html; charset=utf-8') : orig(req, res)
			)
			return baseRequest
		case 'unknown-200':
			patchPage(() => async (req, res) => {
				const p = pathOf(req)
				if (p === BASE || p === BASE + '/') {
					res.statusCode = 200
					res.end('<html>mutated</html>')
					return
				}
				res.statusCode = 200
				res.end('mutated')
			})
			return baseRequest
		case 'css-plain': {
			const orig = svc.serveAsset.bind(svc)
			svc.serveAsset = async (req, res, file, ct) => orig(req, res, file, file === 'style.css' ? 'text/plain; charset=utf-8' : ct)
			return baseRequest
		}
		case 'quota-rethrow': {
			const orig = svc.quotaItem.bind(svc)
			svc.quotaItem = async (entry, warnings) => {
				await orig(entry, warnings)
				throw new Error('mutated: quota item failure escapes')
			}
			return baseRequest
		}
		case 'no-csp':
			return async (spec) => {
				const r = await baseRequest(spec)
				r.headers.delete('content-security-policy')
				return r
			}
		case 'strip-nosniff':
			return async (spec) => {
				const r = await baseRequest(spec)
				r.headers.delete('x-content-type-options')
				return r
			}
		case 'drop-field':
			return async (spec) => {
				const r = await baseRequest(spec)
				if (r.status === 200 && String(r.headers.get('content-type') || '').startsWith('application/json') && r.body.includes('"devRole"')) {
					const payload = JSON.parse(r.body)
					for (const prov of payload.providers || []) for (const m of prov.models || []) delete m.devRole
					r.body = JSON.stringify(payload)
				}
				return r
			}
		case 'leak-secret': {
			const secret = process.env.VW_MUTATE_SECRET || 'MUTATED-SECRET-VALUE'
			return async (spec) => {
				const r = await baseRequest(spec)
				if (r.status === 200) r.body += secret
				return r
			}
		}
		case 'drop-apis':
			// 故意让 /api/state 不再返回 providers[].apis，用来证明断言 5 / 5b 不是空过。
			return async (spec) => {
				const r = await baseRequest(spec)
				if (r.status === 200 && String(r.headers.get('content-type') || '').startsWith('application/json') && r.body.includes('"apis"')) {
					const payload = JSON.parse(r.body)
					for (const prov of payload.providers || []) delete prov.apis
					r.body = JSON.stringify(payload)
				}
				return r
			}
		case 'state-drop-efforts':
			// 故意让 models[] 不再带 reasoningEfforts，用来证明断言 5c / 6d 不是空过。
			return async (spec) => {
				const r = await baseRequest(spec)
				if (r.status === 200 && String(r.headers.get('content-type') || '').startsWith('application/json') && r.body.includes('"reasoningEfforts"')) {
					const payload = JSON.parse(r.body)
					for (const prov of payload.providers || []) for (const m of prov.models || []) delete m.reasoningEfforts
					for (const m of payload.models || []) delete m.reasoningEfforts
					r.body = JSON.stringify(payload)
				}
				return r
			}
		case 'catalog-uncaught':
			// 故意让目录取数抛错逃出 serveCatalog 的兜底（变成 500），用来证明断言 6e 不是空过。
			{
				const origServe = svc.serveCatalog.bind(svc)
				svc.serveCatalog = async (req, res) => {
					svc.catalogEntries() // 原实现会 catch 成 200 + warnings；这里故意放出去
					return origServe(req, res)
				}
				return baseRequest
			}
		case 'quota-force-ignored': {
			// 故意把 serveQuota 传下来的 force 丢掉，用来证明断言 6c 不是空过。
			const orig = svc.quotaItem.bind(svc)
			svc.quotaItem = async (entry, warnings) => orig(entry, warnings)
			return baseRequest
		}
		default:
			throw new Error('unknown VW_MUTATE: ' + name)
	}
}

/* ============================== 真实数据装载 ============================== */

async function loadRealData() {
	const info = { piAi: null, prefs: null, secrets: null, sources: [], warnings: [] }

	// ---- llm-pi-ai config（真值来自本机 profile 补丁层）----
	try {
		const yaml = await loadYaml()
		if (!yaml) {
			info.warnings.push('未找到 yaml 包，无法解析 ' + PATCH_YML)
		} else if (fs.existsSync(PATCH_YML)) {
			const doc = yaml.parse(fs.readFileSync(PATCH_YML, 'utf8'))
			const cfg = pickPatchEntry(doc, PI_AI_NS)
			if (cfg && cfg.providers && typeof cfg.providers === 'object') {
				info.piAi = cfg
				info.sources.push(PATCH_YML)
			} else {
				info.warnings.push(PATCH_YML + ' 里没找到可用的 ' + PI_AI_NS + ' → providers')
			}
		} else {
			info.warnings.push(PATCH_YML + ' 不存在')
		}
	} catch (err) {
		info.warnings.push('读取 ' + PATCH_YML + ' 失败: ' + (err && err.message ? err.message : String(err)))
	}
	if (!info.piAi) {
		info.piAi = FIXTURE_PI_AI
		info.warnings.push('llm-pi-ai 配置回落内置 fixture（不是本机真实配置）')
	}

	// ---- 插件偏好（插件自己去读这个文件，这里只做存在性报告）----
	info.prefsPath = PREFS_JSON
	info.prefsExists = fs.existsSync(PREFS_JSON)
	if (info.prefsExists) info.sources.push(PREFS_JSON)

	// ---- 密钥值（用于 §6-4 / 断言 10）----
	try {
		const yaml = await loadYaml()
		if (yaml && fs.existsSync(CREDS_YAML)) {
			const doc = yaml.parse(fs.readFileSync(CREDS_YAML, 'utf8'))
			info.secrets = [...new Set(collectSecretValues(doc))]
			info.credsPath = CREDS_YAML
		}
	} catch (err) {
		info.warnings.push('读取 ' + CREDS_YAML + ' 失败: ' + (err && err.message ? err.message : String(err)))
	}

	// ---- 已注册路由 / configurable 目录（从 llm-pi-ai config 的 provider 键推演）----
	const ids = Object.keys(info.piAi.providers || {})
	info.registeredRoutes = ids.map((id) => {
		const p = info.piAi.providers[id] || {}
		return { id, name: typeof p.displayName === 'string' && p.displayName ? p.displayName : id }
	})
	info.configurable = ids.map((id) => {
		const p = info.piAi.providers[id] || {}
		return {
			provider: id,
			displayName: typeof p.displayName === 'string' && p.displayName ? p.displayName : id,
			settingsNs: PI_AI_NS,
			settingsPath: ['providers', id]
		}
	})
	return info
}

function settingsRowsFor(data, revision = 12) {
	return [
		{ ns: 'ui-chat', value: { transcriptView: 'compact' }, revision: 3 },
		{ ns: PI_AI_NS, value: data.piAi, revision }
	]
}

/* ============================== 主流程 ============================== */

console.log('=== dsh-model-toolkit · 独立整页设置页 v1 · 离线验收 ===')
console.log('插件包   : ' + PKG_DIR)
console.log('契约     : _spec/webpage-v1.md')

const data = await loadRealData()
console.log('数据来源 : ' + (data.sources.length ? data.sources.join(' ; ') : '(无，全部使用内置 fixture)'))
for (const w of data.warnings) console.log('数据提示 : ' + w)

const harness = await buildHarness({
	settingsRows: settingsRowsFor(data),
	registeredRoutes: data.registeredRoutes,
	configurable: data.configurable
})
console.log('驱动方式 : ' + harness.driver + '（真 cordis Context + 假外部服务）')
console.log('注册路由 : ' + harness.routes.length + ' 条 —— ' + harness.routes.map((r) => `${r.kind} ${r.path}`).join(' | '))
console.log('')

// 出网哨兵：整个断言期间 fetch 都被盯着，真正出网就记账（不改变被测代码行为，只是记账 + 抛错）。
const realFetch = globalThis.fetch
const net = { attempted: [] }
globalThis.fetch = (...args) => {
	net.attempted.push(String(args[0]))
	throw new Error('offline-verify: network disabled (' + String(args[0]) + ')')
}

try {
	/* -------------------- 1. 无尾斜杠 → 308 相对跳转 -------------------- */
	await check(1, `GET ${BASE} → 308 + 相对 Location: ${BASE.slice(1)}/ + 空响应体`, async () => {
		const r = await harness.request({ url: BASE })
		const loc = r.headers.get('location')
		const relative = typeof loc === 'string' && !loc.startsWith('/') && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(loc)
		const want = BASE.slice(1) + '/'
		const problems = []
		if (r.status !== 308) problems.push(`status 期望 308，实际 ${r.status}`)
		if (loc !== want) problems.push(`location 期望 "${want}"，实际 ${JSON.stringify(loc)}`)
		if (!relative) problems.push('location 不是相对写法（不许以 / 开头、不许带 scheme）')
		if (r.body !== '') problems.push(`响应体期望为空，实际 ${r.body.length} 字节: ${JSON.stringify(r.body.slice(0, 80))}`)
		return { ok: problems.length === 0, detail: `status=${r.status} location=${JSON.stringify(loc)} body=${r.body.length}B` + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- 2. 带尾斜杠 → 200 HTML -------------------- */
	await check(2, `GET ${BASE}/ → 200 text/html，含 ./style.css 与 ./app.js`, async () => {
		const r = await harness.request({ url: BASE + '/' })
		const ct = String(r.headers.get('content-type') || '')
		const problems = []
		if (r.status !== 200) problems.push(`status 期望 200，实际 ${r.status}`)
		if (!ct.startsWith('text/html')) problems.push(`content-type 期望以 text/html 开头，实际 ${JSON.stringify(ct)}`)
		if (!r.body.includes('./style.css')) problems.push('body 里没有 ./style.css')
		if (!r.body.includes('./app.js')) problems.push('body 里没有 ./app.js')
		return { ok: problems.length === 0, detail: `status=${r.status} content-type=${JSON.stringify(ct)} body=${r.body.length}B` + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- 3. style.css -------------------- */
	await check(3, `GET ${BASE}/style.css → 200 text/css`, async () => {
		const r = await harness.request({ url: BASE + '/style.css' })
		const ct = String(r.headers.get('content-type') || '')
		const problems = []
		if (r.status !== 200) problems.push(`status 期望 200，实际 ${r.status}`)
		if (!ct.startsWith('text/css')) problems.push(`content-type 期望以 text/css 开头，实际 ${JSON.stringify(ct)}`)
		if (!r.body.length) problems.push('响应体为空')
		return { ok: problems.length === 0, detail: `status=${r.status} content-type=${JSON.stringify(ct)} body=${r.body.length}B` + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- 4. app.js -------------------- */
	await check(4, `GET ${BASE}/app.js → 200 text/javascript`, async () => {
		const r = await harness.request({ url: BASE + '/app.js' })
		const ct = String(r.headers.get('content-type') || '')
		const problems = []
		if (r.status !== 200) problems.push(`status 期望 200，实际 ${r.status}`)
		if (!ct.startsWith('text/javascript')) problems.push(`content-type 期望以 text/javascript 开头，实际 ${JSON.stringify(ct)}`)
		if (!r.body.length) problems.push('响应体为空')
		return { ok: problems.length === 0, detail: `status=${r.status} content-type=${JSON.stringify(ct)} body=${r.body.length}B` + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- 5. /api/state 形状（§3 逐字段） -------------------- */
	await check(5, `GET ${BASE}/api/state → 200 application/json，逐字段符合 §3`, async () => {
		const r = await harness.request({ url: BASE + '/api/state' })
		const ct = String(r.headers.get('content-type') || '')
		const problems = []
		if (r.status !== 200) problems.push(`status 期望 200，实际 ${r.status}`)
		if (!ct.startsWith('application/json')) problems.push(`content-type 期望以 application/json 开头，实际 ${JSON.stringify(ct)}`)
		let payload = null
		try {
			payload = JSON.parse(r.body)
		} catch (err) {
			problems.push('响应体不是合法 JSON: ' + err.message)
		}
		const stats = []
		if (payload) {
			// 顶层
			if (payload.ok !== true) problems.push(`ok 期望 true，实际 ${JSON.stringify(payload.ok)}`)
			if (typeof payload.generatedAt !== 'string' || Number.isNaN(Date.parse(payload.generatedAt))) {
				problems.push(`generatedAt 期望可解析的 ISO 字符串，实际 ${JSON.stringify(payload.generatedAt)}`)
			}
			if (typeof payload.revision !== 'number') problems.push(`revision 期望 number，实际 ${JSON.stringify(payload.revision)}`)
			if (!Array.isArray(payload.providers)) problems.push(`providers 期望数组，实际 ${typeof payload.providers}`)
			if (!payload.prefs || typeof payload.prefs !== 'object' || Array.isArray(payload.prefs)) {
				problems.push(`prefs 期望对象，实际 ${JSON.stringify(payload.prefs)}`)
			} else {
				const missing = PREFS_KEYS.filter((k) => !(k in payload.prefs))
				if (missing.length) problems.push('prefs 缺键: ' + missing.join(', '))
			}
			if (payload.warnings !== undefined && !Array.isArray(payload.warnings)) problems.push('warnings 存在时必须为数组')
			// providers[]
			const providers = Array.isArray(payload.providers) ? payload.providers : []
			if (!providers.length) problems.push('providers 为空数组（取数失败或配置为空）')
			let modelCount = 0
			providers.forEach((p, i) => {
				if (!p || typeof p !== 'object') return problems.push(`providers[${i}] 不是对象`)
				for (const k of ['id', 'displayName', 'baseURL', 'apiKeyEnv', 'apis']) {
					if (!(k in p)) problems.push(`providers[${i}] 缺字段 ${k}`)
				}
				if (typeof p.id !== 'string' || !p.id.length) problems.push(`providers[${i}].id 期望非空字符串，实际 ${JSON.stringify(p.id)}`)
				for (const k of ['displayName', 'baseURL', 'apiKeyEnv']) {
					if (p[k] !== null && typeof p[k] !== 'string') problems.push(`providers[${i}].${k} 期望 string|null，实际 ${JSON.stringify(p[k])}`)
				}
				// 契约 §9.2 P0-1：apis 必须是字符串数组（允许空数组），且不许有重复项。
				if (!Array.isArray(p.apis) || p.apis.some((x) => typeof x !== 'string')) {
					problems.push(`providers[${i}].apis 期望字符串数组（允许空数组），实际 ${JSON.stringify(p.apis)}`)
				} else if (new Set(p.apis).size !== p.apis.length) {
					problems.push(`providers[${i}].apis 有重复项: ${JSON.stringify(p.apis)}`)
				}
				if (!Array.isArray(p.models)) problems.push(`providers[${i}].models 期望数组，实际 ${typeof p.models}`)
				const models = Array.isArray(p.models) ? p.models : []
				modelCount += models.length
				models.forEach((m, j) => {
					if (!m || typeof m !== 'object') return problems.push(`providers[${i}].models[${j}] 不是对象`)
					for (const k of ['id', 'name', 'image', 'reasoning', 'devRole']) {
						if (!(k in m)) problems.push(`providers[${i}].models[${j}] 缺字段 ${k}`)
					}
					if (typeof m.id !== 'string' || !m.id.length) problems.push(`providers[${i}].models[${j}].id 期望非空字符串`)
					if (typeof m.name !== 'string') problems.push(`providers[${i}].models[${j}].name 期望字符串，实际 ${JSON.stringify(m.name)}`)
					if (typeof m.image !== 'boolean') problems.push(`providers[${i}].models[${j}].image 期望 boolean，实际 ${JSON.stringify(m.image)}`)
					if (!Array.isArray(m.reasoning) || m.reasoning.some((x) => typeof x !== 'string')) {
						problems.push(`providers[${i}].models[${j}].reasoning 期望字符串数组，实际 ${JSON.stringify(m.reasoning)}`)
					}
					if (typeof m.devRole !== 'string' || !['auto', 'system', 'developer'].includes(m.devRole)) {
						problems.push(`providers[${i}].models[${j}].devRole 期望 'auto'|'system'|'developer'，实际 ${JSON.stringify(m.devRole)}`)
					}
				})
			})
			stats.push(`providers=${providers.length} models=${modelCount} revision=${payload.revision} prefs键=${Object.keys(payload.prefs || {}).length}`)
			stats.push('sample=' + JSON.stringify(providers[0] && { id: providers[0].id, baseURL: providers[0].baseURL, apiKeyEnv: providers[0].apiKeyEnv, models: (providers[0].models || []).length }))
			stats.push('apis=' + providers.map((p) => `${p.id}:${JSON.stringify(p.apis)}`).join(' '))
		}
		return { ok: problems.length === 0, detail: `${ct} body=${r.body.length}B\n${stats.join('\n')}` + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- 5b. apis 并集去重（§9.2 P0-1 夹具） -------------------- */
	await check('5b', '夹具：profile.api ∪ model.api 去重后进 providers[].apis；取不到给 []', async () => {
		const fh = await buildHarness(API_FIXTURE_OPTS)
		try {
			const r = await fh.request({ url: BASE + '/api/state' })
			const problems = []
			if (r.status !== 200) problems.push(`status 期望 200，实际 ${r.status}`)
			let payload = null
			try {
				payload = JSON.parse(r.body)
			} catch (err) {
				problems.push('响应体不是合法 JSON: ' + err.message)
			}
			const byId = new Map(((payload && payload.providers) || []).map((p) => [p && p.id, p]))
			const withApi = byId.get('fixture-api')
			const noApi = byId.get('fixture-no-api')
			if (!withApi) problems.push('providers 里缺 fixture-api')
			if (!noApi) problems.push('providers 里缺 fixture-no-api')
			// profile.api='openai-completions'；models 里 openai-responses×2（重复）+ 无值 + openai-completions（重复）
			const want = ['openai-completions', 'openai-responses']
			if (withApi) {
				const got = withApi.apis
				if (!Array.isArray(got)) problems.push(`fixture-api.apis 期望数组，实际 ${JSON.stringify(got)}`)
				else {
					if (new Set(got).size !== got.length) problems.push(`fixture-api.apis 没去重: ${JSON.stringify(got)}`)
					if (got.length !== want.length) problems.push(`fixture-api.apis 期望恰好 ${want.length} 个协议（去重后），实际 ${JSON.stringify(got)}`)
					for (const v of want) if (!got.includes(v)) problems.push(`fixture-api.apis 缺 ${v}（实际 ${JSON.stringify(got)}）`)
					if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`fixture-api.apis 期望 ${JSON.stringify(want)}，实际 ${JSON.stringify(got)}`)
				}
			}
			if (noApi && (!Array.isArray(noApi.apis) || noApi.apis.length !== 0)) {
				problems.push(`fixture-no-api.apis 期望 []（一条 api 都取不到），实际 ${JSON.stringify(noApi.apis)}`)
			}
			return {
				ok: problems.length === 0,
				detail: `fixture-api.apis=${JSON.stringify(withApi && withApi.apis)} fixture-no-api.apis=${JSON.stringify(noApi && noApi.apis)}` + (problems.length ? '\n' + problems.join('\n') : '')
			}
		} finally {
			await fh.dispose()
		}
	})

	/* -------------------- 5c. /api/state 的完整 reasoningEfforts 映射（§7.1 补充） -------------------- */
	await check('5c', `GET ${BASE}/api/state 每个模型都有 reasoningEfforts 对象（可为空）；off 存在时必为 null`, async () => {
		const r = await harness.request({ url: BASE + '/api/state' })
		const problems = []
		if (r.status !== 200) problems.push(`status 期望 200，实际 ${r.status}`)
		let payload = null
		try {
			payload = JSON.parse(r.body)
		} catch (err) {
			problems.push('响应体不是合法 JSON: ' + err.message)
		}
		const providers = (payload && payload.providers) || []
		let modelCount = 0
		let withLevels = 0
		let wireCount = 0
		for (const p of providers) {
			for (const m of (p && p.models) || []) {
				modelCount += 1
				const label = `${p.id}/${m && m.id}`
				const eff = m && m.reasoningEfforts
				if (!eff || typeof eff !== 'object' || Array.isArray(eff)) {
					problems.push(`${label}: reasoningEfforts 期望普通对象，实际 ${JSON.stringify(eff)}`)
					continue
				}
				if (Object.prototype.hasOwnProperty.call(eff, 'off') && eff.off !== null) {
					problems.push(`${label}: off 存在时值必须是 null，实际 ${JSON.stringify(eff.off)}`)
				}
				for (const [level, value] of Object.entries(eff)) {
					if (!REASONING_LEVELS_EXPECT.includes(level)) problems.push(`${label}: reasoningEfforts 含非法等级名 ${JSON.stringify(level)}`)
					if (value !== null && typeof value !== 'string') problems.push(`${label}: ${level} 的值期望 string|null，实际 ${JSON.stringify(value)}`)
					if (typeof value === 'string') wireCount += 1
				}
				// reasoning（等级键数组）与 reasoningEfforts 同一份来源，键必须逐个一致
				if (JSON.stringify(Object.keys(eff)) !== JSON.stringify(m.reasoning)) {
					problems.push(`${label}: reasoningEfforts 键 ${JSON.stringify(Object.keys(eff))} 与 reasoning ${JSON.stringify(m.reasoning)} 不一致`)
				}
				if (Object.keys(eff).length) withLevels += 1
			}
		}
		if (!modelCount) problems.push('providers[].models 一个都没有，无法验证 reasoningEfforts')
		if (!withLevels) problems.push('没有任何模型带思考等级（本机配置里应当至少有一个，否则 wire 值没法验）')
		return {
			ok: problems.length === 0,
			detail: `models=${modelCount} 带思考等级=${withLevels} 非 null 的 wire 值=${wireCount}` + (problems.length ? '\n' + problems.join('\n') : '')
		}
	})

	/* -------------------- 6. /api/quota 形状 + 单项失败不影响 200 -------------------- */
	await check(6, `GET ${BASE}/api/quota → 200 application/json，含 ok 与 items[]；单项失败整体仍 200`, async () => {
		const r = await harness.request({ url: BASE + '/api/quota' })
		const ct = String(r.headers.get('content-type') || '')
		const problems = []
		let itemLine = ''
		if (r.status !== 200) problems.push(`status 期望 200，实际 ${r.status}`)
		if (!ct.startsWith('application/json')) problems.push(`content-type 期望以 application/json 开头，实际 ${JSON.stringify(ct)}`)
		let payload = null
		try {
			payload = JSON.parse(r.body)
		} catch (err) {
			problems.push('响应体不是合法 JSON: ' + err.message)
		}
		if (payload) {
			if (payload.ok !== true) problems.push(`ok 期望 true，实际 ${JSON.stringify(payload.ok)}`)
			if (!Array.isArray(payload.items)) problems.push(`items 期望数组，实际 ${typeof payload.items}`)
			if (!Array.isArray(payload.warnings)) problems.push(`warnings 期望数组，实际 ${typeof payload.warnings}`)
			const items = Array.isArray(payload.items) ? payload.items : []
			items.forEach((it, i) => {
				for (const k of ['provider', 'displayName', 'supported', 'recognized', 'family', 'error', 'balance', 'windows', 'period']) {
					if (!(k in it)) problems.push(`items[${i}] 缺字段 ${k}`)
				}
				if (typeof it.supported !== 'boolean') problems.push(`items[${i}].supported 期望 boolean`)
				if (typeof it.recognized !== 'boolean') problems.push(`items[${i}].recognized 期望 boolean`)
				// 失败的项：error 必须是一句人话，且不能因为失败就把整体搞成非 200
				if (it.error !== null && typeof it.error !== 'string') problems.push(`items[${i}].error 期望 string|null`)
			})
			if (items.length) {
				const failed = items.filter((it) => it.error !== null || it.supported === false)
				itemLine = 'items: ' + items.map((it) => `${it.provider}(${it.error || (it.supported ? 'ok' : 'unsupported')})`).join(', ')
				if (!failed.length) notes.push('quota：本机数据没有出现失败项（全部查询成功或全部未识别）')
			}
		}
		return { ok: problems.length === 0, detail: `${ct} body=${r.body.length}B warnings=${payload && Array.isArray(payload.warnings) ? payload.warnings.length : '?'}` + (itemLine ? '\n' + itemLine : '') + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* --- 6b. 故障注入：单家 balance() 抛错，整体仍须 200 且该项 error 非空 --- */
	await check('6b', `故障注入：单家 balance() 抛错 → 该项 error 非空，整体仍 200 + warnings`, async () => {
		const svc = harness.service
		const original = svc.balance
		const target = String((data.registeredRoutes[0] && data.registeredRoutes[0].id) || 'demo')
		svc.balance = async function patched(request) {
			if (request && request.provider === target) throw new Error('injected-quota-failure')
			return original.call(this, request)
		}
		try {
			const r = await harness.request({ url: BASE + '/api/quota' })
			const payload = JSON.parse(r.body)
			const item = (payload.items || []).find((it) => it.provider === target)
			const problems = []
			if (r.status !== 200) problems.push(`status 期望 200（单项失败不许拖垮整体），实际 ${r.status}`)
			if (!item) problems.push(`items 里找不到被注入失败的 provider ${target}`)
			else {
				if (item.supported !== false) problems.push(`失败项 supported 期望 false，实际 ${JSON.stringify(item.supported)}`)
				if (!item.error || typeof item.error !== 'string') problems.push(`失败项 error 期望非空字符串，实际 ${JSON.stringify(item.error)}`)
				if (!String(item.error).includes('injected-quota-failure')) problems.push(`失败项 error 应带上原因，实际 ${JSON.stringify(item.error)}`)
			}
			if (!Array.isArray(payload.warnings) || !payload.warnings.some((w) => String(w).includes(target))) {
				problems.push(`warnings 应记录 ${target} 的失败，实际 ${JSON.stringify(payload.warnings)}`)
			}
			return { ok: problems.length === 0, detail: `status=${r.status} item=${JSON.stringify(item && { provider: item.provider, supported: item.supported, error: item.error })}` + (problems.length ? '\n' + problems.join('\n') : '') }
		} finally {
			svc.balance = original
		}
	})

	/* --- 6c. ?force=1 必须一路传到 balance()（§9.2 P0-2） --- */
	await check('6c', `GET ${BASE}/api/quota?force=1 → balance() 收到 force=true；不带 force → force 为假`, async () => {
		const fh = await buildHarness(API_FIXTURE_OPTS)
		const seen = []
		const original = fh.service.balance
		fh.service.balance = async function patched(request) {
			seen.push({ provider: (request && request.provider) || null, force: request ? request.force : undefined })
			// 形状无关紧要：这里只看 force 有没有传下来。
			return { supported: true, recognized: true, family: 'deepseek', error: null, balance: { currency: 'USD', total: 1 }, windows: null, period: null }
		}
		try {
			seen.length = 0
			const plain = await fh.request({ url: BASE + '/api/quota' })
			const plainSeen = seen.slice()
			seen.length = 0
			const forced = await fh.request({ url: BASE + '/api/quota?force=1' })
			const forcedSeen = seen.slice()
			const problems = []
			if (plain.status !== 200) problems.push(`不带 force：status 期望 200，实际 ${plain.status}`)
			if (forced.status !== 200) problems.push(`force=1：status 期望 200，实际 ${forced.status}`)
			if (!plainSeen.length) problems.push('不带 force 时 balance() 一次都没被调用（夹具目录为空？）')
			if (forcedSeen.length !== plainSeen.length) problems.push(`两次请求调用 balance() 次数不一致：${plainSeen.length} vs ${forcedSeen.length}`)
			const badPlain = plainSeen.filter((c) => c.force !== false)
			if (badPlain.length) problems.push('不带 force 时 balance() 收到的 force 应严格为假(false)，实际 ' + JSON.stringify(plainSeen))
			const badForced = forcedSeen.filter((c) => c.force !== true)
			if (badForced.length) problems.push('force=1 时 balance() 收到的 force 应严格为真(true)，实际 ' + JSON.stringify(forcedSeen))
			const ids = (list) => [...new Set(list.map((c) => c.provider))].sort().join(',')
			if (ids(plainSeen) !== ids(forcedSeen)) problems.push(`两次请求查的 provider 集合不一致：${ids(plainSeen)} vs ${ids(forcedSeen)}`)
			return {
				ok: problems.length === 0,
				detail: `不带 force → force=${JSON.stringify([...new Set(plainSeen.map((c) => c.force))])}（${plainSeen.length} 次 balance 调用）; force=1 → force=${JSON.stringify([...new Set(forcedSeen.map((c) => c.force))])}（${forcedSeen.length} 次）` + (problems.length ? '\n' + problems.join('\n') : '')
			}
		} finally {
			fh.service.balance = original
			await fh.dispose()
		}
	})

	/* -------------------- 6d. /api/catalog 目录候选（§7.1 补充） -------------------- */
	await check('6d', `GET ${BASE}/api/catalog → 200 + 目录模型（图片或思考等级至少一项）+ 统一安全头 + 信任校验`, async () => {
		const problems = []
		const lines = []
		const r = await harness.request({ url: BASE + '/api/catalog' })
		const ct = String(r.headers.get('content-type') || '')
		lines.push(`status=${r.status} content-type=${JSON.stringify(ct)} body=${r.body.length}B`)
		if (r.status !== 200) problems.push(`status 期望 200，实际 ${r.status} body=${r.body.slice(0, 160)}`)
		if (!ct.startsWith('application/json')) problems.push(`content-type 期望 application/json，实际 ${JSON.stringify(ct)}`)
		if (String(r.headers.get('content-security-policy') || '') !== EXPECT_CSP) problems.push('缺统一 CSP 头（应与其它接口一致）')
		if (String(r.headers.get('x-content-type-options') || '') !== EXPECT_NOSNIFF) problems.push('缺 nosniff 头')
		let payload = null
		try {
			payload = JSON.parse(r.body)
		} catch (err) {
			problems.push('响应体不是合法 JSON: ' + err.message)
		}
		if (payload) {
			if (payload.ok !== true) problems.push(`ok 期望 true，实际 ${JSON.stringify(payload.ok)}`)
			if (!Array.isArray(payload.models)) problems.push(`models 期望数组，实际 ${typeof payload.models}`)
			const models = Array.isArray(payload.models) ? payload.models : []
			lines.push(`models=${models.length} truncated=${JSON.stringify(payload.truncated)} warnings=${JSON.stringify(payload.warnings)}`)
			if (!models.length) problems.push('models 为空数组（目录取数不对，或走了失败分支）')
			if (models.length > CATALOG_MAX_EXPECT) problems.push(`models 超过上限 ${CATALOG_MAX_EXPECT}，实际 ${models.length}`)
			if (payload.truncated === true && models.length !== CATALOG_MAX_EXPECT) problems.push(`truncated:true 时 models 必须恰好 ${CATALOG_MAX_EXPECT} 条，实际 ${models.length}`)
			if (payload.truncated !== undefined && payload.truncated !== true) problems.push(`truncated 只该为 true（截断时）或根本不出现，实际 ${JSON.stringify(payload.truncated)}`)
			if (payload.warnings !== undefined && !Array.isArray(payload.warnings)) problems.push('warnings 存在时必须为数组')
			const seen = new Set()
			let imageCount = 0
			let levelCount = 0
			models.forEach((m, i) => {
				const tag = `models[${i}]`
				if (!m || typeof m !== 'object' || Array.isArray(m)) {
					problems.push(`${tag} 不是对象`)
					return
				}
				for (const k of ['provider', 'model', 'name', 'image', 'reasoningEfforts']) {
					if (!(k in m)) problems.push(`${tag} 缺字段 ${k}`)
				}
				if ('compat' in m) problems.push(`${tag} 不该带 compat（目录 compat 含设置层拒收的开关）`)
				if (typeof m.provider !== 'string' || !m.provider) problems.push(`${tag}.provider 期望非空字符串`)
				if (typeof m.model !== 'string' || !m.model) problems.push(`${tag}.model 期望非空字符串`)
				if (typeof m.name !== 'string' || !m.name) problems.push(`${tag}.name 期望非空字符串`)
				if (typeof m.image !== 'boolean') problems.push(`${tag}.image 期望 boolean，实际 ${JSON.stringify(m.image)}`)
				const eff = m.reasoningEfforts
				if (!eff || typeof eff !== 'object' || Array.isArray(eff)) {
					problems.push(`${tag}.reasoningEfforts 期望普通对象，实际 ${JSON.stringify(eff)}`)
				} else {
					if (Object.keys(eff).length > 20) problems.push(`${tag}.reasoningEfforts 键数量超过 20`)
					if (Object.prototype.hasOwnProperty.call(eff, 'off') && eff.off !== null) problems.push(`${tag}.reasoningEfforts.off 必须是 null`)
					for (const [level, value] of Object.entries(eff)) {
						if (!REASONING_LEVELS_EXPECT.includes(level)) problems.push(`${tag}.reasoningEfforts 含非法等级名 ${JSON.stringify(level)}`)
						if (value !== null && typeof value !== 'string') problems.push(`${tag}.reasoningEfforts.${level} 期望 string|null，实际 ${JSON.stringify(value)}`)
					}
				}
				// 「无值的条目不出现」：每项必须至少有图片能力或有思考等级
				const hasLevels = !!eff && typeof eff === 'object' && !Array.isArray(eff) && Object.keys(eff).length > 0
				if (m.image !== true && !hasLevels) problems.push(`${tag} 既没有图片能力也没有思考等级（不该出现在候选表里）`)
				if (m.image === true) imageCount += 1
				if (hasLevels) levelCount += 1
				const key = `${m.provider}\u0000${m.model}`
				if (seen.has(key)) problems.push(`${tag} 重复条目 ${m.provider}/${m.model}`)
				seen.add(key)
			})
			lines.push(`image=true ${imageCount} 条 / 有思考等级 ${levelCount} 条 / 去重后 ${seen.size} 条`)
			if (!imageCount) problems.push('没有任何 image=true 的候选（图片能力没取到）')
			if (!levelCount) problems.push('没有任何带思考等级的候选（wire 值没取到）')
		}
		// 与其它接口同一道信任闸：不通过必须拒绝且不吐数据
		const denied = await buildHarness({ connection: { requestRejection: () => 403 } })
		try {
			const rr = await denied.request({ url: BASE + '/api/catalog' })
			lines.push(`无信任 → status=${rr.status} body=${rr.body.length}B`)
			if (rr.status !== 403) problems.push(`无信任时 status 期望 403，实际 ${rr.status}`)
			if (rr.body !== '') problems.push('无信任时响应体必须为空')
		} finally {
			await denied.dispose()
		}
		return { ok: problems.length === 0, detail: lines.join('\n') + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* --- 6e. 故障注入：目录取数抛错 → 200 + 空数组 + warnings（不许 500） --- */
	await check('6e', '故障注入：/api/catalog 取数抛错 → 200 + models:[] + warnings（不是 500）', async () => {
		const fh = await buildHarness(API_FIXTURE_OPTS)
		const original = fh.service.catalogEntries
		fh.service.catalogEntries = () => {
			throw new Error('injected-catalog-failure')
		}
		try {
			const r = await fh.request({ url: BASE + '/api/catalog' })
			const ct = String(r.headers.get('content-type') || '')
			const problems = []
			let payload = null
			try {
				payload = JSON.parse(r.body)
			} catch (err) {
				problems.push('响应体不是合法 JSON: ' + err.message)
			}
			if (r.status !== 200) problems.push(`status 期望 200（取数失败不许 500），实际 ${r.status} body=${r.body.slice(0, 160)}`)
			if (!ct.startsWith('application/json')) problems.push(`content-type 期望 application/json，实际 ${JSON.stringify(ct)}`)
			if (!payload || payload.ok !== true) problems.push(`ok 期望 true，实际 ${JSON.stringify(payload && payload.ok)}`)
			if (!payload || !Array.isArray(payload.models) || payload.models.length !== 0) {
				problems.push(`models 期望空数组，实际 ${JSON.stringify(payload && payload.models)}`)
			}
			if (!payload || !Array.isArray(payload.warnings) || !payload.warnings.some((w) => String(w).includes('injected-catalog-failure'))) {
				problems.push(`warnings 应记录失败原因，实际 ${JSON.stringify(payload && payload.warnings)}`)
			}
			return {
				ok: problems.length === 0,
				detail: `status=${r.status} models=${payload && Array.isArray(payload.models) ? payload.models.length : '?'} warnings=${JSON.stringify(payload && payload.warnings)}` + (problems.length ? '\n' + problems.join('\n') : '')
			}
		} finally {
			fh.service.catalogEntries = original
			await fh.dispose()
		}
	})

	/* -------------------- 7. 未注册子路径 → 404 -------------------- */
	await check(7, `GET ${BASE}/nope → 404`, async () => {
		const r = await harness.request({ url: BASE + '/nope' })
		const ct = String(r.headers.get('content-type') || '')
		const problems = []
		if (r.status !== 404) problems.push(`status 期望 404，实际 ${r.status}`)
		if (!ct.startsWith('text/plain')) problems.push(`content-type 期望以 text/plain 开头，实际 ${JSON.stringify(ct)}`)
		return { ok: problems.length === 0, detail: `status=${r.status} content-type=${JSON.stringify(ct)} body=${JSON.stringify(r.body.slice(0, 40))}` + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- 8. 非 GET → 405 + Allow: GET -------------------- */
	await check(8, `POST ${BASE}/api/state → 405 + allow 含 GET`, async () => {
		const r = await harness.request({ url: BASE + '/api/state', method: 'POST' })
		const allow = String(r.headers.get('allow') || '')
		const problems = []
		if (r.status !== 405) problems.push(`status 期望 405，实际 ${r.status}`)
		if (!/\bGET\b/.test(allow)) problems.push(`allow 期望含 GET，实际 ${JSON.stringify(allow)}`)
		return { ok: problems.length === 0, detail: `status=${r.status} allow=${JSON.stringify(allow)}` + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- 9. 信任校验：403 / 401 / 抛错 / 服务缺失 -------------------- */
	await check(9, '信任校验不通过 → 对应拒绝状态，且响应体不含任何业务数据', async () => {
		const probes = [
			{ name: 'requestRejection → 403', build: () => buildHarness({ settingsRows: settingsRowsFor(data), connection: { requestRejection: () => 403 } }), want: 403 },
			{ name: 'requestRejection → 401', build: () => buildHarness({ settingsRows: settingsRowsFor(data), connection: { requestRejection: () => 401 } }), want: 401 },
			{ name: 'requestRejection 抛错 → 失败关闭', build: () => buildHarness({ settingsRows: settingsRowsFor(data), connection: { requestRejection: () => { throw new Error('boom') } } }), want: 403 },
			{
				name: 'connection 服务缺失 → 失败关闭',
				build: () => buildHarness({ mode: 'direct', connection: ABSENT, settingsRows: settingsRowsFor(data) }),
				want: 403,
				direct: true
			}
		]
		const problems = []
		const lines = []
		for (const probe of probes) {
			const h = await probe.build()
			try {
				const r = await h.request({ url: BASE + '/api/state' })
				const leaked = /\bproviders\b|apiKeyEnv|\bprefs\b/.test(r.body)
				lines.push(`- ${probe.name}: status=${r.status} body=${r.body.length}B`)
				if (r.status !== probe.want) problems.push(`${probe.name}: status 期望 ${probe.want}，实际 ${r.status}`)
				if (r.body !== '' || leaked) problems.push(`${probe.name}: 响应体必须为空/不含业务数据，实际 ${JSON.stringify(r.body.slice(0, 120))}`)
			} finally {
				await h.dispose()
			}
		}
		return { ok: problems.length === 0, detail: lines.join('\n') + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- 10. 六个 200 响应里都不含真实密钥值 -------------------- */
	await check(10, '六个 200 响应里都不出现 .credentials.yaml 中的任何密钥值', async () => {
		if (!data.secrets) return { ok: true, detail: '（密钥清单不可用，本条随后降级为 SKIP）' }
		const urls = [BASE + '/', BASE + '/style.css', BASE + '/app.js', BASE + '/api/state', BASE + '/api/catalog', BASE + '/api/quota']
		const bodies = {}
		for (const url of urls) {
			const r = await harness.request({ url })
			if (r.status !== 200) throw new Error(`${url} 期望 200，实际 ${r.status}（无法据此判断泄漏）`)
			bodies[url] = r.body
		}
		const problems = []
		for (const [url, body] of Object.entries(bodies)) {
			data.secrets.forEach((secret, i) => {
				if (body.includes(secret)) problems.push(`${url}: 命中第 ${i + 1} 个密钥值（值本身不打印）`)
			})
			if (/\bsk-[A-Za-z0-9_-]{12,}/.test(body)) problems.push(`${url}: 出现 sk- 形态的疑似密钥`)
		}
		return {
			ok: problems.length === 0,
			detail: `检查 ${Object.keys(bodies).length} 个 200 响应 × ${data.secrets.length} 个已知密钥值` + (problems.length ? '\n' + problems.join('\n') : ''),
			skip: false
		}
	})

	/* -------------------- 11. CSP / nosniff / referrer-policy -------------------- */
	await check(11, 'CSP / x-content-type-options / referrer-policy 在 200 响应里都存在且值符合 §2', async () => {
		const urls = [BASE + '/', BASE + '/style.css', BASE + '/app.js', BASE + '/api/state', BASE + '/api/catalog', BASE + '/api/quota']
		const problems = []
		const lines = []
		for (const url of urls) {
			const r = await harness.request({ url })
			const csp = String(r.headers.get('content-security-policy') || '')
			const nosniff = String(r.headers.get('x-content-type-options') || '')
			const ref = String(r.headers.get('referrer-policy') || '')
			lines.push(`- ${url}: csp=${csp ? 'ok' : 'MISSING'} nosniff=${nosniff || 'MISSING'} referrer=${ref || 'MISSING'}`)
			if (csp !== EXPECT_CSP) problems.push(`${url}: CSP 不符，实际 ${JSON.stringify(csp)}`)
			if (nosniff !== EXPECT_NOSNIFF) problems.push(`${url}: x-content-type-options 期望 ${EXPECT_NOSNIFF}，实际 ${JSON.stringify(nosniff)}`)
			if (ref !== EXPECT_REFERRER) problems.push(`${url}: referrer-policy 期望 ${EXPECT_REFERRER}，实际 ${JSON.stringify(ref)}`)
		}
		return { ok: problems.length === 0, detail: lines.join('\n') + (problems.length ? '\n' + problems.join('\n') : '') }
	})
	// 密钥文件缺失时把第 10 条降级成 SKIP（契约要求：跳过并注明）
	if (!data.secrets) {
		const idx = results.findIndex((r) => r.id === 10)
		if (idx >= 0) {
			results[idx].ok = null
			results[idx].detail = CREDS_YAML + ' 不存在或无法解析 → 跳过（本机没有可比对的密钥值）'
		}
	}
} finally {
	globalThis.fetch = realFetch
	await harness.dispose()
}

/* ============================== 写接口断言（契约 §7） ============================== */

const cloneJson = (v) => JSON.parse(JSON.stringify(v))

/** 按 path 落一个值（只给假 settings 桩用，模拟 mutate 真的写进设置）。 */
function setPathDeep(obj, pathArr, value) {
	let cur = obj
	for (let i = 0; i < pathArr.length - 1; i++) {
		if (!cur[pathArr[i]] || typeof cur[pathArr[i]] !== 'object') cur[pathArr[i]] = {}
		cur = cur[pathArr[i]]
	}
	cur[pathArr[pathArr.length - 1]] = value
}
function unsetPathDeep(obj, pathArr) {
	let cur = obj
	for (let i = 0; i < pathArr.length - 1; i++) {
		cur = cur[pathArr[i]]
		if (!cur || typeof cur !== 'object') return
	}
	delete cur[pathArr[pathArr.length - 1]]
}
function applyOpsTo(target, ops) {
	for (const op of ops) {
		if (!op || !Array.isArray(op.path)) continue
		if (op.op === 'unset') unsetPathDeep(target, op.path)
		else if (op.op === 'set') setPathDeep(target, op.path, cloneJson(op.value))
	}
}

// 写接口测试专用的模型配置：带"未提及字段"与既有 wire 映射，用来验合并不会覆盖/丢失。
const SAVE_PI_AI = {
	providers: {
		demo: {
			displayName: 'Demo',
			apiKeyEnv: 'DEMO_API_KEY',
			baseURL: 'https://api.deepseek.com',
			compat: { supportsDeveloperRole: true, extraFlag: 'keep-me' },
			models: [
				{
					id: 'demo-v1',
					name: 'Demo V1',
					input: ['text', 'image'],
					contextWindow: 111111,
					maxTokens: 2222,
					reasoningEfforts: { off: null, high: 'high-wire' },
					extra: { keep: true }
				},
				{ id: 'demo-v1-fast', name: 'Demo V1 Fast', input: ['text'], reasoningEfforts: { off: null, max: 'max' } },
				{ id: 'demo-v1-untouched', name: 'Demo V1 Untouched', input: ['text', 'image'], reasoningEfforts: { off: null, low: 'low' } }
			]
		},
		other: { displayName: 'Other', models: [{ id: 'o-1', name: 'O1', input: ['text'] }] }
	}
}

/**
 * 写接口专用 harness：state 是可变设置快照，mutate 桩校验 revision、应用 ops、revision+1。
 * 这样既能断言"记录到的 ops 形状"，又能验"设置真的变了 / 响应拿到新 revision"。
 */
async function buildSaveHarness(opts) {
	const o = opts || {}
	const state = {
		revision: o.revision === undefined ? 12 : o.revision,
		piAi: cloneJson(o.piAi || SAVE_PI_AI)
	}
	const h = await buildHarness({
		mode: o.mode,
		settingsRows: () => [
			{ ns: 'ui-chat', value: { transcriptView: 'compact' }, revision: 3 },
			{ ns: PI_AI_NS, value: state.piAi, revision: state.revision }
		],
		registeredRoutes: [],
		configurable: [],
		connection: o.connection,
		mutate: async (ns, ops, revision) => {
			if (o.rejectAll) throw new Error('mutated: mutate disabled')
			if (revision !== state.revision) {
				const err = new Error('revision mismatch: current=' + state.revision + ' expected=' + revision)
				err.code = 'conflict'
				throw err
			}
			applyOpsTo(state.piAi, ops)
			state.revision += 1
		}
	})
	return { h, state }
}

console.log('')
console.log('=== 写接口 POST /api/save（契约 §7）离线断言 ===')

// 写接口会真的落插件偏好文件：把 DSH_HOME 指到临时目录，绝不碰用户真实 dsh-provider-info.json。
const writeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-save-'))
const savedHome = process.env.DSH_HOME
process.env.DSH_HOME = writeHome
const prefFilesSeen = () => {
	const p = path.join(writeHome, 'dsh-provider-info.json')
	return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null
}
const saveBodies = []

/** 收集写接口响应文本，供最后的"不含密钥"断言统一检查。 */
async function saveRequest(h, spec) {
	const r = await h.request(spec)
	saveBodies.push({ url: spec.url, method: spec.method || 'GET', status: r.status, body: r.body })
	return r
}
const jsonBody = (obj) => JSON.stringify(obj)

try {
	/* -------------------- W1. 正常保存：合并规则 + 一次 mutate + 200 -------------------- */
	await check('W1', '正常保存 → 200 + revision 更新 + 单次 mutate + ops 形状正确（未提及字段保留）', async () => {
		const { h, state } = await buildSaveHarness({})
		try {
			const r = await saveRequest(h, {
				url: BASE + '/api/save',
				method: 'POST',
				body: jsonBody({
					revision: 12,
					models: [
						{ provider: 'demo', model: 'demo-v1', image: false, reasoning: ['off', 'high', 'max'] },
						{ provider: 'demo', model: 'demo-v1-fast', image: true }
					],
					roles: [{ provider: 'demo', devRole: 'developer' }],
					prefs: { hoverRefresh: false },
					futureFlag: 'ignored-unknown-top-level'
				})
			})
			const problems = []
			const payload = r.body ? JSON.parse(r.body) : null
			const ct = String(r.headers.get('content-type') || '')
			if (r.status !== 200) problems.push(`status 期望 200，实际 ${r.status} body=${r.body.slice(0, 200)}`)
			if (!ct.startsWith('application/json')) problems.push(`content-type 期望 application/json，实际 ${JSON.stringify(ct)}`)
			if (!payload || payload.ok !== true) problems.push(`ok 期望 true，实际 ${JSON.stringify(payload)}`)
			if (!payload || payload.revision !== 13) problems.push(`revision 期望 13（写入后重新 describe），实际 ${JSON.stringify(payload && payload.revision)}`)
			if (!payload || !Array.isArray(payload.warnings) || payload.warnings.length !== 0) problems.push(`warnings 期望空数组，实际 ${JSON.stringify(payload && payload.warnings)}`)
			if (h.calls.mutate !== 1) problems.push(`mutate 期望恰好调用 1 次，实际 ${h.calls.mutate}`)
			if (h.mutateCalls.length !== 1) problems.push(`记录的 mutate 调用期望 1 条，实际 ${h.mutateCalls.length}`)
			const call = h.mutateCalls[0] || {}
			if (call.ns !== PI_AI_NS) problems.push(`mutate ns 期望 ${PI_AI_NS}，实际 ${JSON.stringify(call.ns)}`)
			if (call.revision !== 12) problems.push(`mutate revision 期望 12，实际 ${JSON.stringify(call.revision)}`)
			const ops = call.ops || []
			if (ops.length !== 2) problems.push(`ops 期望 2 条（同一 provider 的两次模型改动必须合成一次 set + 角色一次），实际 ${ops.length}: ${JSON.stringify(ops).slice(0, 300)}`)
			const modelOp = ops[0]
			if (!modelOp || modelOp.op !== 'set') problems.push(`ops[0] 期望 op:set，实际 ${JSON.stringify(modelOp && modelOp.op)}`)
			if (!modelOp || JSON.stringify(modelOp.path) !== JSON.stringify(['providers', 'demo', 'models'])) {
				problems.push(`ops[0].path 期望 ["providers","demo","models"]，实际 ${JSON.stringify(modelOp && modelOp.path)}`)
			}
			const value = (modelOp && modelOp.value) || []
			if (value.length !== 3) problems.push(`合并后 models 期望 3 个（未点名的模型必须原样留着），实际 ${value.length}`)
			const merged = value[0] || {}
			if (JSON.stringify(merged.input) !== JSON.stringify(['text'])) problems.push(`image:false → input 期望 ["text"]，实际 ${JSON.stringify(merged.input)}`)
			if (merged.contextWindow !== 111111 || merged.maxTokens !== 2222) problems.push(`未提及字段被覆盖：contextWindow=${JSON.stringify(merged.contextWindow)} maxTokens=${JSON.stringify(merged.maxTokens)}`)
			if (merged.name !== 'Demo V1') problems.push(`name 被覆盖：${JSON.stringify(merged.name)}`)
			if (JSON.stringify(merged.extra) !== JSON.stringify({ keep: true })) problems.push('extra 字段丢了')
			// reasoning：既有 high 的 wire 值必须沿用，缺失的 max 用键名本身，off 用 null
			if (JSON.stringify(merged.reasoningEfforts) !== JSON.stringify({ off: null, high: 'high-wire', max: 'max' })) {
				problems.push(`reasoningEfforts 期望 {off:null,high:"high-wire",max:"max"}，实际 ${JSON.stringify(merged.reasoningEfforts)}`)
			}
			// 同一 provider 的第二个改动合进同一次 set，且不碰它的 reasoningEfforts
			const second = value[1] || {}
			if (JSON.stringify(second.input) !== JSON.stringify(['text', 'image'])) problems.push(`第二个模型 image:true → input 期望 ["text","image"]，实际 ${JSON.stringify(second.input)}`)
			if (second.name !== 'Demo V1 Fast') problems.push('第二个模型的 name 被覆盖')
			if (JSON.stringify(second.reasoningEfforts) !== JSON.stringify({ off: null, max: 'max' })) problems.push('第二个模型没点名 reasoning，它的 reasoningEfforts 不该动')
			// 完全没点名的第三个模型必须逐字保留
			if (JSON.stringify(value[2]) !== JSON.stringify(SAVE_PI_AI.providers.demo.models[2])) problems.push('未点名的第三个模型被改动了')
			const roleOp = ops[1]
			if (!roleOp || roleOp.op !== 'set' || JSON.stringify(roleOp.path) !== JSON.stringify(['providers', 'demo', 'compat', 'supportsDeveloperRole']) || roleOp.value !== true) {
				problems.push(`devRole developer → 期望 set true 到 compat.supportsDeveloperRole，实际 ${JSON.stringify(roleOp)}`)
			}
			// 设置真的变了（假桩应用了 ops）
			if (JSON.stringify(state.piAi.providers.demo.models[0].input) !== JSON.stringify(['text'])) problems.push('设置里的 input 没变成 ["text"]')
			if (state.piAi.providers.demo.compat.supportsDeveloperRole !== true) problems.push('设置里的 compat 没变')
			if (state.piAi.providers.demo.compat.extraFlag !== 'keep-me') problems.push('compat 里未提及的 extraFlag 被弄丢了')
			// 偏好真的落盘
			const prefs = prefFilesSeen()
			if (!prefs || prefs.hoverRefresh !== false) problems.push(`偏好文件里 hoverRefresh 期望 false，实际 ${JSON.stringify(prefs)}`)
			return {
				ok: problems.length === 0,
				detail: `status=${r.status} revision=${payload && payload.revision} mutate=${h.calls.mutate} ops=${ops.length} prefs=${JSON.stringify(prefs && prefs.hoverRefresh)}` + (problems.length ? '\n' + problems.join('\n') : '')
			}
		} finally {
			await h.dispose()
		}
	})

	/* -------------------- W2. 合并细分：wire 沿用 + devRole 三取值 -------------------- */
	await check('W2', 'reasoning wire 值沿用 + devRole auto/system/developer 三种 op 正确', async () => {
		const problems = []
		const lines = []
		const run = async (roles, bodyExtra, wantOp) => {
			const { h } = await buildSaveHarness({})
			try {
				const body = { revision: 12, ...bodyExtra, roles }
				const r = await saveRequest(h, { url: BASE + '/api/save', method: 'POST', body: jsonBody(body) })
				if (r.status !== 200) problems.push(`${JSON.stringify(roles)}/${JSON.stringify(bodyExtra)}: status 期望 200，实际 ${r.status} ${r.body.slice(0, 160)}`)
				const ops = (h.mutateCalls[0] && h.mutateCalls[0].ops) || []
				const roleOp = ops.find((o) => Array.isArray(o.path) && o.path[2] === 'compat') || null
				if (wantOp !== null) {
					lines.push(`- ${JSON.stringify(roles)} → ${JSON.stringify(roleOp)}`)
					if (JSON.stringify(roleOp) !== JSON.stringify(wantOp)) problems.push(`roles=${JSON.stringify(roles)}: op 期望 ${JSON.stringify(wantOp)}，实际 ${JSON.stringify(roleOp)}`)
				}
				return ops
			} finally {
				await h.dispose()
			}
		}
		await run([{ provider: 'demo', devRole: 'auto' }], {}, { op: 'unset', path: ['providers', 'demo', 'compat', 'supportsDeveloperRole'] })
		await run([{ provider: 'demo', devRole: 'system' }], {}, { op: 'set', path: ['providers', 'demo', 'compat', 'supportsDeveloperRole'], value: false })
		await run([{ provider: 'demo', devRole: 'developer' }], {}, { op: 'set', path: ['providers', 'demo', 'compat', 'supportsDeveloperRole'], value: true })

		// 只留 high + 新增 max：high 的 wire 值不能被丢
		const ops = await run([], { models: [{ provider: 'demo', model: 'demo-v1', reasoning: ['high', 'max'] }] }, null)
		const value = (ops[0] && ops[0].value) || []
		const efforts = value[0] && value[0].reasoningEfforts
		lines.push('- reasoning ["high","max"] → ' + JSON.stringify(efforts))
		if (JSON.stringify(efforts) !== JSON.stringify({ high: 'high-wire', max: 'max' })) {
			problems.push(`reasoning 重建期望 {high:"high-wire",max:"max"}（high 沿用现有 wire 值），实际 ${JSON.stringify(efforts)}`)
		}
		// 清空：空数组 → 空对象
		const ops2 = await run([], { models: [{ provider: 'demo', model: 'demo-v1', reasoning: [] }] }, null)
		const efforts2 = ops2[0] && ops2[0].value && ops2[0].value[0] && ops2[0].value[0].reasoningEfforts
		lines.push('- reasoning [] → ' + JSON.stringify(efforts2))
		if (JSON.stringify(efforts2) !== JSON.stringify({})) problems.push(`reasoning:[] 期望清空成 {}，实际 ${JSON.stringify(efforts2)}`)
		return { ok: problems.length === 0, detail: lines.join('\n') + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- W3. revision 冲突 → 409 conflict -------------------- */
	await check('W3', 'revision 不匹配 → 409 + code=conflict + 提示刷新；偏好不落盘', async () => {
		const problems = []
		// 场景一：桩按 revision 校验（页面 revision 过期）；偏好文件内容必须原封不动
		const a = await buildSaveHarness({})
		try {
			const prefsBefore = JSON.stringify(prefFilesSeen())
			const r = await saveRequest(a.h, {
				url: BASE + '/api/save',
				method: 'POST',
				body: jsonBody({ revision: 11, models: [{ provider: 'demo', model: 'demo-v1', image: true }], prefs: { hoverRefresh: true } })
			})
			const payload = r.body ? JSON.parse(r.body) : null
			const prefsAfter = JSON.stringify(prefFilesSeen())
			if (r.status !== 409) problems.push(`status 期望 409，实际 ${r.status} body=${r.body.slice(0, 200)}`)
			if (!payload || payload.ok !== false || payload.code !== 'conflict') problems.push(`期望 {ok:false,code:"conflict"}，实际 ${JSON.stringify(payload)}`)
			if (!payload || typeof payload.message !== 'string' || !payload.message.includes('刷新')) problems.push(`message 应提示刷新，实际 ${JSON.stringify(payload && payload.message)}`)
			if (prefsAfter !== prefsBefore) problems.push('409 之后偏好文件内容不该变化')
		} finally {
			await a.h.dispose()
		}
		// 场景二：mutate 因**非版本**原因失败（revision 一致）→ 必须 500 server，不能谎报冲突
		const b = await buildSaveHarness({ rejectAll: true })
		try {
			const r = await saveRequest(b.h, { url: BASE + '/api/save', method: 'POST', body: jsonBody({ revision: 12, models: [{ provider: 'demo', model: 'demo-v1', image: true }], prefs: { showMore: false } }) })
			const payload = r.body ? JSON.parse(r.body) : null
			if (r.status !== 500 || !payload || payload.code !== 'server') problems.push(`mutate 非冲突失败：期望 500 server，实际 ${r.status} ${r.body.slice(0, 160)}`)
			if (payload && payload.message && payload.message.length > 200) problems.push('500 message 过长')
		} finally {
			await b.h.dispose()
		}
		return { ok: problems.length === 0, detail: `stale-revision mutate 次数=${a.h.calls.mutate}; prefs=${JSON.stringify(prefFilesSeen())}` + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- W4. 请求体级 400 -------------------- */
	await check('W4', '畸形/空/非对象/缺 revision/超长请求体 → 一律 400 bad-request', async () => {
		const { h } = await buildSaveHarness({})
		try {
			const cases = [
				{ name: '畸形 JSON', body: '{not json' },
				{ name: '空 body', body: '' },
				{ name: '非对象 JSON', body: '[1,2,3]' },
				{ name: '缺 revision', body: jsonBody({ models: [{ provider: 'demo', model: 'demo-v1', image: true }] }) },
				{ name: 'revision 是字符串', body: jsonBody({ revision: '12', prefs: { showMore: false } }) },
				{ name: 'revision 是 NaN', body: jsonBody({ revision: NaN, prefs: { showMore: false } }) },
				{ name: '无可写字段', body: jsonBody({ revision: 12 }) },
				{ name: '超长 body(>256KB)', body: jsonBody({ revision: 12, prefs: { showMore: false }, padding: 'x'.repeat(300 * 1024) }) }
			]
			const problems = []
			const lines = []
			for (const c of cases) {
				const r = await saveRequest(h, { url: BASE + '/api/save', method: 'POST', body: c.body })
				const payload = r.body ? JSON.parse(r.body) : null
				lines.push(`- ${c.name}: status=${r.status} code=${payload && payload.code}`)
				if (r.status !== 400) problems.push(`${c.name}: status 期望 400，实际 ${r.status} body=${r.body.slice(0, 160)}`)
				if (!payload || payload.ok !== false || payload.code !== 'bad-request') problems.push(`${c.name}: 期望 {ok:false,code:"bad-request"}，实际 ${JSON.stringify(payload)}`)
			}
			return { ok: problems.length === 0, detail: lines.join('\n') + (problems.length ? '\n' + problems.join('\n') : '') }
		} finally {
			await h.dispose()
		}
	})

	/* -------------------- W5. 字段级 400 -------------------- */
	await check('W5', '非法 image / reasoning / devRole / prefs / 未知 provider·model → 400（不静默兜底）', async () => {
		const { h } = await buildSaveHarness({})
		try {
			const base = { revision: 12 }
			const cases = [
				{ name: 'models 非数组', body: { ...base, models: {} } },
				{ name: '缺 provider', body: { ...base, models: [{ model: 'demo-v1' }] } },
				{ name: '缺 model', body: { ...base, models: [{ provider: 'demo' }] } },
				{ name: 'image 非 boolean', body: { ...base, models: [{ provider: 'demo', model: 'demo-v1', image: 'yes' }] } },
				{ name: 'reasoning 非数组', body: { ...base, models: [{ provider: 'demo', model: 'demo-v1', reasoning: 'high' }] } },
				{ name: 'reasoning 含非字符串', body: { ...base, models: [{ provider: 'demo', model: 'demo-v1', reasoning: [1, 2] }] } },
				{ name: 'roles 非法 devRole', body: { ...base, roles: [{ provider: 'demo', devRole: 'on' }] } },
				{ name: 'roles 缺 provider', body: { ...base, roles: [{ devRole: 'auto' }] } },
				{ name: 'prefs 非对象', body: { ...base, prefs: [] } },
				{ name: 'prefs 未知键', body: { ...base, prefs: { notAKey: true } } },
				{ name: 'prefs 布尔位给字符串', body: { ...base, prefs: { hoverRefresh: 'yes' } } },
				{ name: 'prefs.autoRefreshMin = 0', body: { ...base, prefs: { autoRefreshMin: 0 } } },
				{ name: 'prefs.autoRefreshMin 非数字', body: { ...base, prefs: { autoRefreshMin: '15' } } },
				{ name: 'prefs.fontSize 越界', body: { ...base, prefs: { fontSize: 'huge' } } },
				{ name: 'prefs.language 越界', body: { ...base, prefs: { language: 'fr' } } },
				{ name: '未知 provider', body: { ...base, models: [{ provider: 'nope', model: 'demo-v1', image: true }] } },
				{ name: '未知 model', body: { ...base, models: [{ provider: 'demo', model: 'nope-v9', image: true }] } },
				{ name: 'roles 未知 provider', body: { ...base, roles: [{ provider: 'nope', devRole: 'auto' }] } }
			]
			const problems = []
			const lines = []
			for (const c of cases) {
				const r = await saveRequest(h, { url: BASE + '/api/save', method: 'POST', body: jsonBody(c.body) })
				const payload = r.body ? JSON.parse(r.body) : null
				lines.push(`- ${c.name}: status=${r.status} code=${payload && payload.code}`)
				if (r.status !== 400) problems.push(`${c.name}: status 期望 400，实际 ${r.status} body=${r.body.slice(0, 160)}`)
				if (!payload || payload.ok !== false || payload.code !== 'bad-request') problems.push(`${c.name}: 期望 bad-request，实际 ${JSON.stringify(payload)}`)
			}
			if (h.calls.mutate !== 0) problems.push(`400 的请求都不该调 mutate，实际调了 ${h.calls.mutate} 次`)
			return { ok: problems.length === 0, detail: lines.join('\n') + (problems.length ? '\n' + problems.join('\n') : '') }
		} finally {
			await h.dispose()
		}
	})

	/* -------------------- W10. 带完整 reasoningEfforts → 逐字写入（不重建 wire 值） -------------------- */
	await check('W10', 'POST /api/save 带 reasoningEfforts → ops 里该模型的 reasoningEfforts 逐字等于请求映射', async () => {
		const mapping = { off: null, minimal: null, low: 'low-wire', medium: 'medium-wire', high: 'high-wire', xhigh: 'xhigh-wire', max: 'max-wire' }
		const { h, state } = await buildSaveHarness({})
		try {
			const r = await saveRequest(h, {
				url: BASE + '/api/save',
				method: 'POST',
				body: jsonBody({ revision: 12, models: [{ provider: 'demo', model: 'demo-v1', reasoningEfforts: mapping }] })
			})
			const payload = r.body ? JSON.parse(r.body) : null
			const problems = []
			if (r.status !== 200) problems.push(`status 期望 200，实际 ${r.status} body=${r.body.slice(0, 200)}`)
			if (!payload || payload.ok !== true) problems.push(`ok 期望 true，实际 ${JSON.stringify(payload)}`)
			if (h.calls.mutate !== 1) problems.push(`mutate 期望恰好 1 次，实际 ${h.calls.mutate}`)
			const ops = (h.mutateCalls[0] && h.mutateCalls[0].ops) || []
			if (ops.length !== 1 || JSON.stringify(ops[0] && ops[0].path) !== JSON.stringify(['providers', 'demo', 'models'])) {
				problems.push(`ops 期望 1 条 models set，实际 ${JSON.stringify(ops).slice(0, 200)}`)
			}
			const merged = (ops[0] && ops[0].value && ops[0].value[0]) || {}
			if (JSON.stringify(merged.reasoningEfforts) !== JSON.stringify(mapping)) {
				problems.push(`ops 里的 reasoningEfforts 期望逐字 ${JSON.stringify(mapping)}，实际 ${JSON.stringify(merged.reasoningEfforts)}`)
			}
			// 未提及字段仍原样保留（增量合并语义不变）
			if (merged.name !== 'Demo V1' || merged.contextWindow !== 111111 || merged.maxTokens !== 2222) {
				problems.push(`未提及字段被覆盖：name=${JSON.stringify(merged.name)} contextWindow=${JSON.stringify(merged.contextWindow)} maxTokens=${JSON.stringify(merged.maxTokens)}`)
			}
			// 设置真的变了
			if (JSON.stringify(state.piAi.providers.demo.models[0].reasoningEfforts) !== JSON.stringify(mapping)) {
				problems.push(`设置里的 reasoningEfforts 没变成请求映射，实际 ${JSON.stringify(state.piAi.providers.demo.models[0].reasoningEfforts)}`)
			}
			return {
				ok: problems.length === 0,
				detail: `status=${r.status} mutate=${h.calls.mutate} ops=${ops.length} reasoningEfforts=${JSON.stringify(merged.reasoningEfforts)}` + (problems.length ? '\n' + problems.join('\n') : '')
			}
		} finally {
			await h.dispose()
		}
	})

	/* -------------------- W11. 非法 reasoningEfforts → 400 -------------------- */
	await check('W11', '非法 reasoningEfforts（非对象/键超 20/非法等级名/值不是 string|null/off 非 null）→ 一律 400 且不写', async () => {
		const tooMany = { off: null }
		for (let i = 0; i < 20; i++) tooMany['lvl' + i] = 'x' // 21 个键 > 20
		const cases = [
				{ name: 'reasoningEfforts 是字符串', value: 'high' },
				{ name: 'reasoningEfforts 是数组', value: ['off', 'high'] },
				{ name: 'reasoningEfforts 是 null', value: null },
				{ name: '键数量 21 > 20', value: tooMany },
				{ name: '非法等级名', value: { off: null, turbo: 't' } },
				{ name: '值不是 string|null（数字）', value: { off: null, high: 5 } },
				{ name: '值不是 string|null（对象）', value: { off: null, high: { wire: 'x' } } },
				{ name: '值长度 65 > 64', value: { off: null, high: 'x'.repeat(65) } },
				{ name: 'off 非 null', value: { off: 'none', high: 'high' } },
				{ name: 'off 是空字符串', value: { off: '' } }
			]
		const { h } = await buildSaveHarness({})
		try {
			const problems = []
			const lines = []
			for (const c of cases) {
				const r = await saveRequest(h, {
					url: BASE + '/api/save',
					method: 'POST',
					body: jsonBody({ revision: 12, models: [{ provider: 'demo', model: 'demo-v1', reasoningEfforts: c.value }] })
				})
				const payload = r.body ? JSON.parse(r.body) : null
				lines.push(`- ${c.name}: status=${r.status} code=${payload && payload.code}`)
				if (r.status !== 400) problems.push(`${c.name}: status 期望 400，实际 ${r.status} body=${r.body.slice(0, 160)}`)
				if (!payload || payload.ok !== false || payload.code !== 'bad-request') problems.push(`${c.name}: 期望 bad-request，实际 ${JSON.stringify(payload)}`)
			}
			if (h.calls.mutate !== 0) problems.push(`400 的请求都不该调 mutate，实际调了 ${h.calls.mutate} 次`)
			return { ok: problems.length === 0, detail: lines.join('\n') + (problems.length ? '\n' + problems.join('\n') : '') }
		} finally {
			await h.dispose()
		}
	})

	/* -------------------- W12. reasoning 与 reasoningEfforts 同时给 → 后者优先 -------------------- */
	await check('W12', '同时带 reasoning 与 reasoningEfforts → 以 reasoningEfforts 为准（空对象则清空）', async () => {
		const problems = []
		const lines = []
		const a = await buildSaveHarness({})
		try {
			const r = await saveRequest(a.h, {
				url: BASE + '/api/save',
				method: 'POST',
				body: jsonBody({
					revision: 12,
					models: [{ provider: 'demo', model: 'demo-v1', reasoning: ['off', 'high', 'max'], reasoningEfforts: { off: null, high: 'from-map' } }]
				})
			})
			const ops = (a.h.mutateCalls[0] && a.h.mutateCalls[0].ops) || []
			const merged = (ops[0] && ops[0].value && ops[0].value[0]) || {}
			lines.push(`- reasoning+reasoningEfforts → ${JSON.stringify(merged.reasoningEfforts)}`)
			if (r.status !== 200) problems.push(`status 期望 200，实际 ${r.status}`)
			if (JSON.stringify(merged.reasoningEfforts) !== JSON.stringify({ off: null, high: 'from-map' })) {
				problems.push(`期望以 reasoningEfforts 为准 {off:null,high:"from-map"}（不按 reasoning 重建），实际 ${JSON.stringify(merged.reasoningEfforts)}`)
			}
		} finally {
			await a.h.dispose()
		}
		const b = await buildSaveHarness({})
		try {
			const r = await saveRequest(b.h, {
				url: BASE + '/api/save',
				method: 'POST',
				body: jsonBody({ revision: 12, models: [{ provider: 'demo', model: 'demo-v1', reasoning: ['off', 'high'], reasoningEfforts: {} }] })
			})
			const ops = (b.h.mutateCalls[0] && b.h.mutateCalls[0].ops) || []
			const merged = (ops[0] && ops[0].value && ops[0].value[0]) || {}
			lines.push(`- reasoningEfforts:{} → ${JSON.stringify(merged.reasoningEfforts)}`)
			if (r.status !== 200) problems.push(`空对象：status 期望 200，实际 ${r.status}`)
			if (JSON.stringify(merged.reasoningEfforts) !== JSON.stringify({})) {
				problems.push(`空对象期望清空成 {}，实际 ${JSON.stringify(merged.reasoningEfforts)}`)
			}
		} finally {
			await b.h.dispose()
		}
		return { ok: problems.length === 0, detail: lines.join('\n') + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- W6. 无信任 → 403（body 空） -------------------- */
	await check('W6', 'POST /api/save 未通过信任校验 → 403（或 401），响应体为空、不调 mutate', async () => {
		const problems = []
		const lines = []
		for (const probe of [
			{ name: '403', connection: { requestRejection: () => 403 }, want: 403 },
			{ name: '401', connection: { requestRejection: () => 401 }, want: 401 },
			{ name: 'connection 缺失（失败关闭）', connection: ABSENT, want: 403, mode: 'direct' }
		]) {
			const { h } = await buildSaveHarness({ connection: probe.connection, mode: probe.mode })
			try {
				const r = await saveRequest(h, {
					url: BASE + '/api/save',
					method: 'POST',
					body: jsonBody({ revision: 12, models: [{ provider: 'demo', model: 'demo-v1', image: true }] })
				})
				lines.push(`- ${probe.name}: status=${r.status} body=${r.body.length}B`)
				if (r.status !== probe.want) problems.push(`${probe.name}: status 期望 ${probe.want}，实际 ${r.status}`)
				if (r.body !== '') problems.push(`${probe.name}: 响应体必须为空，实际 ${JSON.stringify(r.body.slice(0, 120))}`)
				if (h.calls.mutate !== 0) problems.push(`${probe.name}: 被拒绝时不该调 mutate`)
			} finally {
				await h.dispose()
			}
		}
		return { ok: problems.length === 0, detail: lines.join('\n') + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- W7. 方法/路径 → 405 -------------------- */
	await check('W7', 'GET /api/save → 405(Allow: POST)；POST 未注册路径 → 405(Allow: GET)', async () => {
		const { h } = await buildSaveHarness({})
		try {
			const problems = []
			const lines = []
			const r1 = await saveRequest(h, { url: BASE + '/api/save', method: 'GET' })
			const allow1 = String(r1.headers.get('allow') || '')
			lines.push(`- GET /api/save: status=${r1.status} allow=${JSON.stringify(allow1)}`)
			if (r1.status !== 405) problems.push(`GET /api/save: status 期望 405，实际 ${r1.status}`)
			if (!/\bPOST\b/.test(allow1)) problems.push(`GET /api/save: allow 期望含 POST，实际 ${JSON.stringify(allow1)}`)

			const r2 = await saveRequest(h, { url: BASE + '/definitely-not-registered', method: 'POST', body: jsonBody({ revision: 12, prefs: { showMore: true } }) })
			const allow2 = String(r2.headers.get('allow') || '')
			lines.push(`- POST /definitely-not-registered: status=${r2.status} allow=${JSON.stringify(allow2)}`)
			if (r2.status !== 405) problems.push(`POST 未注册路径: status 期望 405，实际 ${r2.status}`)
			if (!/\bGET\b/.test(allow2)) problems.push(`POST 未注册路径: allow 期望含 GET，实际 ${JSON.stringify(allow2)}`)

			// 写接口不影响原有只读路由的 405 行为（回归）
			const r3 = await saveRequest(h, { url: BASE + '/api/state', method: 'POST' })
			lines.push(`- POST /api/state: status=${r3.status} allow=${JSON.stringify(String(r3.headers.get('allow') || ''))}`)
			if (r3.status !== 405) problems.push(`POST /api/state: status 期望 405，实际 ${r3.status}`)
			return { ok: problems.length === 0, detail: lines.join('\n') + (problems.length ? '\n' + problems.join('\n') : '') }
		} finally {
			await h.dispose()
		}
	})

	/* -------------------- W8. 写接口响应不含任何密钥值 -------------------- */
	await check('W8', '写接口的所有响应里不出现 .credentials.yaml 中的任何密钥值', async () => {
		if (!data.secrets) return { ok: true, detail: '（密钥清单不可用，本条随后降级为 SKIP）' }
		const problems = []
		let checked = 0
		for (const rec of saveBodies) {
			checked += 1
			data.secrets.forEach((secret, i) => {
				if (secret && rec.body.includes(secret)) problems.push(`${rec.method} ${rec.url} (HTTP ${rec.status}): 命中第 ${i + 1} 个密钥值`)
			})
			if (/\bsk-[A-Za-z0-9_-]{12,}/.test(rec.body)) problems.push(`${rec.method} ${rec.url}: 出现 sk- 形态的疑似密钥`)
		}
		return { ok: problems.length === 0, detail: `检查 ${checked} 个写接口响应 × ${data.secrets.length} 个已知密钥值` + (problems.length ? '\n' + problems.join('\n') : '') }
	})

	/* -------------------- W9. prefs 写失败 → 200 + warnings（不谎报全成） -------------------- */
	await check('W9', '偏好落盘失败 → 仍 200 + warnings 说明；settings 改动不回滚', async () => {
		const blocker = path.join(writeHome, 'dsh-provider-info.json')
		// 让 writeFileSync 命中 EISDIR：把偏好文件的位置占成目录
		fs.rmSync(blocker, { recursive: true, force: true })
		fs.mkdirSync(blocker)
		try {
			const { h, state } = await buildSaveHarness({})
			try {
				const r = await saveRequest(h, {
					url: BASE + '/api/save',
					method: 'POST',
					body: jsonBody({ revision: 12, models: [{ provider: 'demo', model: 'demo-v1', image: true }], prefs: { showMore: false } })
				})
				const payload = r.body ? JSON.parse(r.body) : null
				const problems = []
				if (r.status !== 200) problems.push(`status 期望 200（设置已成功），实际 ${r.status} ${r.body.slice(0, 200)}`)
				if (!payload || payload.ok !== true) problems.push(`ok 期望 true，实际 ${JSON.stringify(payload)}`)
				if (!payload || !Array.isArray(payload.warnings) || payload.warnings.length < 1) problems.push(`warnings 应至少 1 条说明偏好没写成，实际 ${JSON.stringify(payload && payload.warnings)}`)
				if (h.calls.mutate !== 1) problems.push(`mutate 期望 1 次，实际 ${h.calls.mutate}`)
				if (JSON.stringify(state.piAi.providers.demo.models[0].input) !== JSON.stringify(['text', 'image'])) problems.push('设置里的 image 改动没生效（不该被偏好失败回滚）')
				return { ok: problems.length === 0, detail: `status=${r.status} warnings=${JSON.stringify(payload && payload.warnings)}` + (problems.length ? '\n' + problems.join('\n') : '') }
			} finally {
				await h.dispose()
			}
		} finally {
			fs.rmSync(blocker, { recursive: true, force: true })
		}
	})
} finally {
	if (savedHome === undefined) delete process.env.DSH_HOME
	else process.env.DSH_HOME = savedHome
	fs.rmSync(writeHome, { recursive: true, force: true })
}
// 密钥文件缺失时把 W8 也降级成 SKIP（与断言 10 同一口径）
if (!data.secrets) {
	const idx = results.findIndex((r) => r.id === 'W8')
	if (idx >= 0) {
		results[idx].ok = null
		results[idx].detail = CREDS_YAML + ' 不存在或无法解析 → 跳过（本机没有可比对的密钥值）'
	}
}

/* ============================== 出网检查 ============================== */

await check('N', '整个验收过程零出网（quota 走失败分支）', async () => {
	return { ok: net.attempted.length === 0, detail: `fetch 调用次数=${net.attempted.length}${net.attempted.length ? ' → ' + net.attempted.join(', ') : ''}` }
})

/* ============================== --dump ============================== */

if (DUMP_DIR) {
	console.log('')
	console.log('=== --dump 真实数据落盘 ===')
	const outDir = path.resolve(process.cwd(), DUMP_DIR)
	fs.mkdirSync(outDir, { recursive: true })
	const dh = await buildHarness({
		settingsRows: settingsRowsFor(data),
		registeredRoutes: data.registeredRoutes,
		configurable: data.configurable
	})
	globalThis.fetch = (...args) => {
		net.attempted.push(String(args[0]))
		throw new Error('offline-verify: network disabled (' + String(args[0]) + ')')
	}
	try {
		const state = await dh.request({ url: BASE + '/api/state' })
		const quota = await dh.request({ url: BASE + '/api/quota' })
		const statePath = path.join(outDir, 'state.json')
		const quotaPath = path.join(outDir, 'quota.json')
		fs.writeFileSync(statePath, JSON.stringify(JSON.parse(state.body), null, 2) + '\n')
		fs.writeFileSync(quotaPath, JSON.stringify(JSON.parse(quota.body), null, 2) + '\n')
		const stateBytes = fs.statSync(statePath).size
		const quotaBytes = fs.statSync(quotaPath).size
		console.log(`state.json  ${statePath}  ${stateBytes} B  (HTTP ${state.status})`)
		console.log(`quota.json  ${quotaPath}  ${quotaBytes} B  (HTTP ${quota.status})`)
		const qp = JSON.parse(quota.body)
		console.log(`quota items: ${qp.items.length}  warnings: ${JSON.stringify(qp.warnings)}`)
		console.log('quota items 明细: ' + qp.items.map((it) => `${it.provider}[${it.error ?? (it.supported ? 'ok' : 'unsupported')}]`).join(', '))
	} finally {
		globalThis.fetch = realFetch
		await dh.dispose()
	}
}

/* ============================== 汇总 ============================== */

console.log('')
console.log('=== 汇总 ===')
const passed = results.filter((r) => r.ok === true).length
const failed = results.filter((r) => r.ok === false).length
const skipped = results.filter((r) => r.ok === null).length
if (failed) {
	console.log('失败项:')
	for (const r of results.filter((x) => x.ok === false)) console.log(`  - [${r.id}] ${r.title}`)
}
if (skipped) {
	console.log('跳过项:')
	for (const r of results.filter((x) => x.ok === null)) console.log(`  - [${r.id}] ${r.title} —— ${r.detail}`)
}
for (const n of notes) console.log('备注: ' + n)
console.log(`通过 ${passed} / 共 ${results.length}（失败 ${failed}，跳过 ${skipped}）`)
console.log('退出码 ' + (failed ? 1 : 0))
process.exitCode = failed ? 1 : 0

/* ============================== --self-test ============================== */

/**
 * 负向对照：把被测代码**故意改坏一处**，再跑同一套断言，要求"该失败的那条真的失败"。
 * 没有这一步，13 个 PASS 可能只是断言空过。每个变体在独立子进程里跑，互不污染。
 */
if (argv.includes('--self-test')) {
	console.log('')
	console.log('=== --self-test：负向对照（证明断言不是空过）===')
	const { spawnSync } = await import('node:child_process')
	const CASES = [
		{ mutation: 'absolute-location', expect: ['1'], what: 'Location 写成绝对路径' },
		{ mutation: 'redirect-body', expect: ['1'], what: '308 带上了响应体' },
		{ mutation: 'no-308', expect: ['1'], what: '无尾斜杠直接回 200 不跳转' },
		{ mutation: 'unknown-200', expect: ['1', '7'], what: '未注册子路径回 200' },
		{ mutation: 'css-plain', expect: ['3'], what: 'style.css 用 text/plain' },
		{ mutation: 'drop-field', expect: ['5'], what: '/api/state 丢掉 models[].devRole' },
		{ mutation: 'drop-apis', expect: ['5', '5b'], what: '/api/state 丢掉 providers[].apis' },
		{ mutation: 'state-drop-efforts', expect: ['5c'], what: '/api/state 丢掉 models[].reasoningEfforts' },
		{ mutation: 'catalog-uncaught', expect: ['6e'], what: '/api/catalog 取数失败不兜底（500）' },
		{ mutation: 'quota-force-ignored', expect: ['6c'], what: 'quota 把 ?force=1 半路丢掉' },
		{ mutation: 'trust-ignore', expect: ['9'], what: '信任校验永远放行' },
		{ mutation: 'quota-rethrow', expect: ['6', '6b'], what: '单家余量失败拖垮整体（500）' },
		{ mutation: 'no-csp', expect: ['11'], what: '200 响应丢 CSP 头' },
		{ mutation: 'strip-nosniff', expect: ['11'], what: '200 响应丢 nosniff 头' },
		{ mutation: 'leak-secret', expect: ['10'], what: '200 响应里混进真实密钥值' }
	]
	let bad = 0
	for (const c of CASES) {
		const env = { ...process.env, VW_MUTATE: c.mutation }
		if (c.mutation === 'leak-secret') env.VW_MUTATE_SECRET = (data.secrets && data.secrets[0]) || 'MUTATED-SECRET-VALUE'
		const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env, encoding: 'utf8', timeout: 120000 })
		const out = String(child.stdout || '')
		const failedIds = [...out.matchAll(/^!!\[\s*(\S+)\] FAIL/gm)].map((m) => m[1])
		const ok = child.status === 1 && c.expect.every((id) => failedIds.includes(id))
		if (!ok) bad += 1
		console.log(`  ${ok ? 'ok ' : '!! '}${c.mutation.padEnd(18)} ${c.what} → 子进程退出码 ${child.status}，失败项 [${failedIds.join(', ')}]，期望含 [${c.expect.join(', ')}]`)
	}
	console.log(bad ? `self-test 失败 ${bad}/${CASES.length}` : `self-test 通过 ${CASES.length}/${CASES.length}（每条断言都能被改坏触发）`)
	if (bad && !process.exitCode) process.exitCode = 1
}
