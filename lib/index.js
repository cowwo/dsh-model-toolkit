/* dsh-model-toolkit host entry — 合并 dsh-model-fit (v0.2.3) 与 dsh-provider-info (v0.17.0)。
 * 两个 Service 各自保留自己的 static inject，不合并成一个类：
 *   ModelCapabilityService -> ['llm']
 *   ProviderBadgeService   -> ['llm', 'credentials', 'settings', 'connection', 'webServer']
 *     （后两个只为在 webServer 上发布 `web/` 那个独立整页设置页，见文件下方契约说明）
 */
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
// 目录枚举用的就是 lib/catalog.js（catalogLookup）背后那一个 pi-ai 目录模块，
// 不另造一套目录来源；目录真值一律再由 catalogLookup() 查。
import { getBuiltinModels, getBuiltinProviders } from '@earendil-works/pi-ai/providers/all'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { catalogLookup } from './catalog.js'

/* ============================ 目录能力（两处共用） ============================ */

/**
 * pi-ai 目录条目 → 思考等级 wire 映射（等级键 → 线上取值）。
 * 这是「继承自…」的公共口径：modelCapability/source 端点与独立页的 /api/catalog 都用它，
 * 避免同一份 thinkingLevelMap 提取逻辑写两遍。
 * 没有 thinkingLevelMap 时返回 null（沿用 source() 原语义），空映射仍是 `{}`；
 * 值里 undefined 的项丢掉（JSON 里不会有，纯防脏数据）。
 */
function catalogWire(catalogModel) {
	const map = catalogModel && catalogModel.thinkingLevelMap
	if (!map || typeof map !== 'object') return null
	const wire = {}
	for (const [key, value] of Object.entries(map)) {
		if (value !== undefined) wire[key] = value
	}
	return wire
}

/** 目录条目 → 是否支持图片输入（目录 `input` 里的 `'image'`）。 */
function catalogImage(catalogModel) {
	return !!(catalogModel && Array.isArray(catalogModel.input) && catalogModel.input.includes('image'))
}

/**
 * 目录条目 → `/api/catalog` 的一项（「继承自…」的候选）。
 * 只给继承要复制的两项能力：`image` 与 `reasoningEfforts`（wire 值）。
 * **刻意不带 compat**：目录 compat 含设置层拒收的目录专有开关
 * （如 requiresReasoningContentOnAssistantMessages），抄进配置会让整次保存被 dsh-llm-pi-ai 拒绝。
 * 返回 null 表示「没有继承价值」（既不能读图、也没有任何思考等级），调用方跳过。
 * 等级键只收 /api/save 认得的集合，保证页面选完一定能写回去。
 * wire 值必须**能直接写进设置**（页面「继承自…」会把这张映射原样复制进草稿再保存）：
 * - `off` 一律 `null`（契约 §10.1 H1 示例；/api/save 也要求 off 只能是 null）；
 * - 非 off 的 `null` 是 pi-ai 的「该等级不支持」，**必须丢掉**而不是照抄——
 *   dsh-llm-pi-ai 只允许 off 留空，抄下去会让整次保存被设置层拒绝（页面只看到 500）；
 * - 空串同理丢掉（设置层拒收空 wire 值）。
 */
function catalogItem(provider, model, catalogModel) {
	const reasoningEfforts = {}
	const wire = catalogWire(catalogModel)
	if (wire) {
		for (const [level, value] of Object.entries(wire)) {
			if (!REASONING_LEVELS.includes(level)) continue
			if (level === 'off') {
				reasoningEfforts.off = null
				continue
			}
			if (typeof value === 'string' && value.length) reasoningEfforts[level] = value
		}
	}
	const image = catalogImage(catalogModel)
	if (!image && !Object.keys(reasoningEfforts).length) return null
	const name = catalogModel && typeof catalogModel.name === 'string' && catalogModel.name.length ? catalogModel.name : String(model)
	return { provider: String(provider), model: String(model), name, image, reasoningEfforts }
}

/* ============================ dsh-model-fit ============================ */

/**
 * 模型能力服务：为继承对话框读取来源模型的能力
 * （输入模态、推理等级与线上取值；compat 仅作诊断返回，
 * 客户端不再把它写进配置 —— 目录 compat 里含设置层拒收的
 * 目录专有开关，抄进去会让整次保存被 dsh-llm-pi-ai 拒绝）。
 * 通过 typert `modelCapability/source` 端点暴露给浏览器端。
 */
export class ModelCapabilityService extends TypertRemoteService {
	static inject = ['llm']

	constructor(ctx, config) {
		super(ctx, 'modelCapability')
	}

	/**
	 * @param request - { provider, model } of the source model.
	 * @returns null when the source is unknown, else
	 *   { input, levels, wire, compat, exact }.
	 *   `compat` stays in the result for diagnostics; inheritance writes
	 *   only `input` and `reasoningEfforts` (see client inheritTo).
	 */
	async source(request) {
		const provider = request && request.provider
		const model = request && request.model
		if (!provider || !model) throw new Error('modelCapability/source: provider and model are required')
		const info = await this.ctx.llm.resolveModelInfo(provider, model)
		if (!info) return null
		const levels = []
		if (info.reasoning && Array.isArray(info.reasoning.efforts)) {
			for (const effort of info.reasoning.efforts) levels.push(effort.id)
		}
		let wire = null
		let compat = null
		let exact = true
		const found = catalogLookup(provider, model)
		if (found) {
			exact = found.exact
			const catalogModel = found.model
			// 与独立页 /api/catalog 共用同一份 wire 提取逻辑（catalogWire）。
			wire = catalogWire(catalogModel)
			if (catalogModel.compat && typeof catalogModel.compat === 'object') {
				compat = { ...catalogModel.compat }
			}
		}
		return {
			input: info.inputModalities && info.inputModalities.includes('image') ? ['text', 'image'] : ['text'],
			levels,
			wire,
			compat,
			exact
		}
	}
}

/* ========================== dsh-provider-info ========================== */

/* ------------------------------------------------------------------ *
 * 提供商余量查询 —— 统一结构
 * ------------------------------------------------------------------ *
 * 所有厂商家族都归一成同一份结构，渲染端不再按厂商分支（见 ADR-0002）：
 *   windows[]  套餐型的配额窗口（key = 语义槽位，durationHours = 真实时长）
 *   balance    余额型的金额（币种 + 总额）
 *   period     订阅计费周期的到期时间（Command Code 取自 subscriptions 接口；
 *              OpenCode Go 没有独立字段，取月窗 resetsAt——它实测就是计费周期终点）
 * 接口探测规则：以提供商配置里的 baseURL 为主（不依赖自定义 route key），
 * 回退到 route key 里的家族标志。目前实际查询 DeepSeek（余额）、
 * OpenCode Go（5小时/周/月窗口）、Command Code（5小时/周窗口 + 月度池）；
 * 其余已被社区验证有等价接口的厂商仅做识别并标记「暂不支持」，不发起实际查询。
 */

// 窗口时长（小时）：厂商接口只回字段名，时长由适配器声明；渲染端据此生成标签，
// 因此厂商哪天改成非 5小时/周/月 的窗口（如 5 天窗）也能自动显示，无需改渲染代码。
const WINDOW_DURATION_HOURS = { rolling: 5, weekly: 168, monthly: 720 }

// OpenCode Go 官方订阅限额（美元）：接口只回已用百分比 + 重置时间，金额按此换算。
const OPENCODE_LIMITS_USD = { rolling: 12, weekly: 30, monthly: 60 }

// ---- 插件设置（persistent）----
const SETTINGS_FILE = 'dsh-provider-info.json'
// capabilityEditor / badgeAndQuota 是插件级总开关：默认开，只有显式 false 才算关
// （缺字段 / 脏数据一律回落 true，与 hoverRefresh、showMore 同一口径）。
const SETTINGS_DEFAULTS = { capabilityEditor: true, badgeAndQuota: true, hoverRefresh: true, autoRefreshOn: false, autoRefreshMin: 5, showMore: true, fontSize: 'middle', language: 'system' }
const settingPath = () => {
	const root = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
	return path.join(root, SETTINGS_FILE)
}
const clampSettings = (s) => {
	const out = { ...SETTINGS_DEFAULTS }
	if (s && typeof s === 'object') {
		// 两个总开关：显式 false 才关，其余（缺字段、字符串脏数据）一律回落 true。
		out.capabilityEditor = s.capabilityEditor !== false
		out.badgeAndQuota = s.badgeAndQuota !== false
		out.hoverRefresh = s.hoverRefresh !== false
		out.autoRefreshOn = !!s.autoRefreshOn
		const min = Number(s.autoRefreshMin)
		out.autoRefreshMin = Number.isFinite(min) && min >= 1 ? Math.round(min) : SETTINGS_DEFAULTS.autoRefreshMin
		// 默认开（与 hoverRefresh 同样的口径：只有显式 false 才算关，脏数据/缺字段一律回落默认开）。
		// 打开时余量额外显示金额、浮层显示重置倒计时与到期剩余天数。
		out.showMore = s.showMore !== false
		out.fontSize = ['large', 'middle', 'small'].includes(s.fontSize) ? s.fontSize : SETTINGS_DEFAULTS.fontSize
		out.language = ['system', 'en', 'zh'].includes(s.language) ? s.language : SETTINGS_DEFAULTS.language
	}
	return out
}
function readSettings() {
	try {
		const raw = fs.readFileSync(settingPath(), 'utf8')
		return clampSettings(JSON.parse(raw))
	} catch {
		return { ...SETTINGS_DEFAULTS }
	}
}
function writeSettings(settings) {
	const clean = clampSettings(settings)
	try {
		const f = settingPath()
		fs.mkdirSync(path.dirname(f), { recursive: true })
		fs.writeFileSync(f, JSON.stringify(clean, null, 2))
		try { fs.chmodSync(f, 0o600) } catch { /* best-effort */ }
	} catch (e) {
		// 写盘失败必须如实传播：以前这里吞掉异常仍返回 clean，界面会显示
		// 「已保存」而磁盘上什么都没变（遵循 ADR-0001：显式失败，不静默）。
		console.warn('[provider-badge] 写入设置失败', e)
		throw e
	}
	return clean
}

// 余额/限额为低频变化数据（5 小时/天/月窗口），host 端按 provider 缓存 5 分钟，
// 避免每次悬停都打到厂商接口。切走再切回同一 provider 时若未过期，直接用缓存。
const BALANCE_CACHE_TTL_MS = 5 * 60 * 1000
// 失败结果只做「短时间去重」，不做 5 分钟负缓存：一次瞬时抖动（代理冷启动、ECONNRESET）
// 会被钉住整整 5 分钟——设置页表格一直「查询失败」，而开了悬停强刷的浮层却已经拿到新数据，
// 两处自相矛盾（这正是"浮层有数据、表格全失败"那种截图的由来）。
// 20s 足够合并「连续悬停 / 多端同时打开设置页」的重复请求，又不至于让失败状态赖着不走。
const BALANCE_FAILURE_TTL_MS = 20 * 1000
const balanceCache = new Map()
// 在途查询合并：同一 provider（同 force 标记）的并发请求共用一次厂商查询。
const balanceInflight = new Map()

// 厂商家族识别表：markers 命中任何一个即判定为对应家族，用于选取取数适配器与密钥环境变量。
// supported=true 的家族才实际查询；其余识别后回「暂不支持」。
// 这里不记录「余额型/套餐型」：类型由适配器实际返回的数据体现，不做第二处声明（避免两处真相）。
const FAMILY_MARKERS = [
	{ family: 'deepseek', supported: true, markers: ['api.deepseek.com', 'deepseek'], env: 'DEEPSEEK_API_KEY' },
	{ family: 'opencode-go', supported: true, markers: ['opencode.ai', 'opencode-go', 'opencode'], env: 'OPENCODE_GO_API_KEY' },
	{ family: 'commandcode', supported: true, markers: ['commandcode.ai', 'commandcode'], env: 'CMD_01_API_KEY' },
	{ family: 'kimi', supported: false, markers: ['api.kimi.com', 'kimi'], env: 'KIMI_CODING_API_KEY' },
	{ family: 'zhipu', supported: false, markers: ['open.bigmodel.cn', 'api.z.ai', 'zai', 'bigmodel'], env: 'ZAI_API_KEY' },
	{ family: 'minimax', supported: false, markers: ['api.minimaxi.com', 'api.minimax.io', 'minimax'], env: 'MINIMAX_API_KEY' },
	{ family: 'openrouter', supported: false, markers: ['openrouter.ai', 'openrouter'], env: 'OPENROUTER_API_KEY' },
	{ family: 'codex', supported: false, markers: ['chatgpt.com', 'openai-codex', 'codex'], env: 'OPENAI_CODEX_ACCESS_TOKEN' }
]

function detectFamily(baseURL, provider) {
	const haystack = ((baseURL || '') + ' ' + (provider || '')).toLowerCase()
	for (const fam of FAMILY_MARKERS) {
		if (fam.markers.some((m) => haystack.includes(m.toLowerCase()))) return fam
	}
	return null
}

function toNum(v) {
	if (v === null || v === undefined || v === '') return null
	const n = Number(v)
	return Number.isFinite(n) ? n : null
}

// 统一请求：超时、JSON 解析、非 2xx 归类。
async function requestJsonOnce(url, headers, timeoutMs) {
	const ctrl = new AbortController()
	const timer = setTimeout(() => ctrl.abort(), timeoutMs)
	try {
		const res = await fetch(url, { headers, signal: ctrl.signal, redirect: 'follow' })
		let errType = null
		let errMsg = null
		let body = null
		try {
			body = await res.json()
			if (body && body.error) {
				errType = typeof body.error.type === 'string' ? body.error.type : null
				errMsg = typeof body.error.message === 'string' ? body.error.message : null
			}
		} catch { /* 非 JSON 响应 */ }
		if (!res.ok) {
			return { httpError: 'http-' + res.status, status: res.status, providerType: errType, providerMessage: errMsg }
		}
		if (body && body.error) {
			return { httpError: errMsg || errType || 'provider-error', status: res.status, providerType: errType, providerMessage: errMsg }
		}
		return { body }
	} catch (e) {
		return { httpError: e && e.name === 'AbortError' ? 'timeout' : 'network' }
	} finally {
		clearTimeout(timer)
	}
}

// 瞬时失败重试一次：三家厂商的这几个端点都是只读 GET，重试没有任何副作用。
// 代理/VPN 的冷连接被 reset（ECONNRESET）与 Cloudflare 偶发 429/5xx 都属此类——
// 实测同一台机器上常见的形态就是「第一次 network，紧接着第二次就成功」，而用户看到的是
// 一句「查询失败」外加失败被缓存 5 分钟（见下面的 BALANCE_FAILURE_TTL_MS）。
// 超时也重试，但第二次把等待上限压到 8s：真不通的域名不该让人干等两轮 15s。
const REQUEST_ATTEMPTS = 2
const RETRY_DELAY_MS = 400
const RETRY_TIMEOUT_MS = 8000
function isTransientError(result) {
	if (!result || !result.httpError) return false
	if (result.httpError === 'network' || result.httpError === 'timeout') return true
	const m = /^http-(\d{3})$/.exec(result.httpError)
	if (!m) return false
	const status = Number(m[1])
	return status === 429 || status >= 500
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function requestJson(url, headers, timeoutMs = 15000) {
	let last = null
	for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt++) {
		const budget = attempt === 1 ? timeoutMs : Math.min(timeoutMs, RETRY_TIMEOUT_MS)
		last = await requestJsonOnce(url, headers, budget)
		if (!isTransientError(last)) return last
		if (attempt < REQUEST_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt)
	}
	return last
}

// 归一化辅助：金额统一保留两位小数，渲染端不再做数值处理。
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100)

// 厂商给的重置时间有 ISO 字符串（opencode）与毫秒时间戳（commandcode）两种，统一成 ISO。
function isoOrNull(v) {
	if (typeof v === 'string') return v
	const n = toNum(v)
	return n == null ? null : new Date(n).toISOString()
}

/**
 * 归一化一个配额窗口。percent 与 used/total 同出一源：
 * 厂商只回百分比时 used 由 percent × total 折算；只回 used/cap 时 percent 由 used / cap 折算。
 */
function makeWindow(key, { percent = null, used = null, total = null, currency = null, resetsAt = null, rateLimited = false } = {}) {
	return {
		key,
		durationHours: WINDOW_DURATION_HOURS[key] != null ? WINDOW_DURATION_HOURS[key] : null,
		percent: round2(toNum(percent)),
		used: round2(toNum(used)),
		total: toNum(total),
		currency: currency || null,
		resetsAt: isoOrNull(resetsAt),
		rateLimited: !!rateLimited
	}
}

/**
 * 一个订阅计费周期的到期时间（渲染端「到期」行的唯一数据源）：`end` 原样透传，
 * 渲染端负责格式化；`daysLeft` 供「更多信息」显示剩余天数。
 * 拿不到结束时间时返回 null——那家厂商就没有「到期」这一维；日期解析失败时只给 end。
 */
function makePeriod(end) {
	if (typeof end !== 'string' || !end) return null
	const ms = Date.parse(end)
	return { end, daysLeft: ms === ms ? Math.max(0, Math.ceil((ms - Date.now()) / 86400000)) : null }
}

/**
 * 所有返回都保持同一形状（缺失的维度恒为 null），渲染端才能用一套逻辑读三种结果
 * （查得的数据 / 暂不支持 / 出错）。见 ADR-0002。
 */
function emptyQuota({ supported, recognized, family = null, error = null }) {
	return { supported, recognized, family, error, balance: null, windows: null, period: null }
}

// DeepSeek：账户余额金额（余额型，无窗口、无重置）。
async function queryDeepSeek(base, key) {
	const baseUrl = ((base || 'https://api.deepseek.com').replace(/\/$/, ''))
	const { body, httpError } = await requestJson(baseUrl + '/user/balance', {
		Authorization: 'Bearer ' + key,
		Accept: 'application/json'
	})
	if (httpError) return { ok: false, error: httpError }
	const infos = Array.isArray(body && body.balance_infos) ? body.balance_infos : []
	return {
		ok: true,
		balance: {
			isAvailable: !!(body && body.is_available !== false),
			items: infos.map((i) => ({
				currency: typeof i.currency === 'string' ? i.currency : null,
				total: round2(toNum(i.total_balance))
			}))
		}
	}
}

// OpenCode Go：5小时 / 周 / 月 三个滚动窗口，接口只回百分比 + 重置时间。
function pickOpencodeWindow(w) {
	if (!w || typeof w !== 'object') return null
	const percent = toNum(w.percent)
	const status = typeof w.status === 'string' ? w.status : null
	return { percent, status, rateLimited: status === 'rate-limited', resetsAt: typeof w.resetsAt === 'string' ? w.resetsAt : null }
}

async function queryOpencodeGo(base, key) {
	// baseURL 可能是 .../zen/go 或 .../zen/go/v1（用户配置自带 /v1），归一化到 /v1/usage。
	const normBase = ((base || 'https://opencode.ai/zen/go').replace(/\/$/, '').replace(/\/v1$/, ''))
	const { body, httpError, providerType } = await requestJson(normBase + '/v1/usage', {
		Authorization: 'Bearer ' + key,
		'x-api-key': key,
		Accept: 'application/json',
		'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
	})
	if (httpError) {
		// opencode 403=EntitlementError（无订阅权限）区别于普通密钥/地址错误。
		if (httpError === 'http-401' || httpError === 'http-403') {
			return { ok: false, error: providerType === 'EntitlementError' ? 'subscription-required' : 'unauthorized' }
		}
		return { ok: false, error: httpError }
	}
	const usage = body && body.usage ? body.usage : null
	if (!usage || typeof usage !== 'object') return { ok: false, error: 'missing-usage' }
	const windows = []
	for (const key of ['rolling', 'weekly', 'monthly']) {
		const w = pickOpencodeWindow(usage[key])
		if (!w) continue
		// 接口不回金额，套餐价来自上面的 OPENCODE_LIMITS_USD（厂商调价需手工同步该常量）。
		const total = OPENCODE_LIMITS_USD[key] != null ? OPENCODE_LIMITS_USD[key] : null
		const used = w.percent == null || total == null ? null : (w.percent / 100) * total
		windows.push(makeWindow(key, { percent: w.percent, used, total, currency: 'USD', resetsAt: w.resetsAt, rateLimited: w.rateLimited }))
	}
	// 「到期」：Go 没有独立的订阅字段，但月窗的 resetsAt 就是计费周期终点（实测：周窗锚在周一
	// 00:00Z 日历整点，月窗锚在非整点的账号事件 ≈ 订阅起算日 + 1 个月，两者都不随时钟漂移）。
	// 这里把它同时作为 period 返回；于是「月」行与「到期」行指向同一时刻——两行都留着，
	// 月行答「还有多久」、到期行答「哪天」（见 client 的 windowCells / periodValue）。
	const monthly = windows.find((w) => w.key === 'monthly')
	const period = monthly ? makePeriod(monthly.resetsAt) : null
	if (!windows.length) return { ok: false, error: 'missing-windows' }
	return { ok: true, windows, period }
}

// Command Code（GOAT / Pro / Max 等 coding plan）：官方 CLI 内部接口（同 key、纯 GET 只读）——
//   GET /alpha/billing/credits        → 月度剩余 credits + 5小时/每周 滚动窗口（used/cap/exceeded/resetAt）
//   GET /alpha/billing/subscriptions  → planId + 计费周期（「到期」的唯一来源）
// 三个窗口归一成同一结构：5小时 / 周来自 windowLimits，月度池来自 credits 剩余。
// 「月度总额度」不做本地硬编码映射：接口不返回月池总额，这里按 周窗 cap × 2 动态推导
// （GOAT/Pro 的月池 = 周窗×2，例如 GOAT 35×2=70；官方调整窗口值后接口会实时返回、自动跟随）。
async function queryCommandCode(base, key) {
	let origin = 'https://api.commandcode.ai'
	try { origin = new URL(base || origin).origin } catch { /* 回退默认 */ }
	const authHeaders = { Authorization: 'Bearer ' + key, Accept: 'application/json' }
	// 两个接口并行取（实测串行冷启动 ~2.6s → 并行 ~1.2s；热态各自 ~0.33s），
	// 这是“悬停余量出现慢”的主要来源。
	const [creditsRes, subRes] = await Promise.all([
		requestJson(origin + '/alpha/billing/credits', authHeaders),
		requestJson(origin + '/alpha/billing/subscriptions', authHeaders)
	])
	if (creditsRes.httpError) {
		if (creditsRes.httpError === 'http-401' || creditsRes.httpError === 'http-403') {
			return { ok: false, error: creditsRes.httpError === 'http-403' ? 'subscription-required' : 'unauthorized' }
		}
		return { ok: false, error: creditsRes.httpError }
	}
	const body = creditsRes.body && typeof creditsRes.body === 'object' ? creditsRes.body : {}
	const credits = body.credits && typeof body.credits === 'object' ? body.credits : null
	const limits = body.windowLimits && typeof body.windowLimits === 'object' ? body.windowLimits : null
	if (!credits || !limits) return { ok: false, error: 'missing-usage' }
	const windows = []
	let weeklyCap = null
	for (const [winKey, outKey] of [['fiveHour', 'rolling'], ['weekly', 'weekly']]) {
		const w = limits[winKey]
		if (!w || typeof w !== 'object') continue
		const used = toNum(w.used)
		const cap = toNum(w.cap)
		if (cap === null || cap <= 0) continue
		if (outKey === 'weekly') weeklyCap = cap
		windows.push(makeWindow(outKey, {
			percent: used === null ? null : (used / cap) * 100,
			used,
			total: cap,
			currency: 'USD',
			// cmd 在没有活跃窗口时把 resetAt 写成 0（不是时间戳）：按「没有重置时间」处理，
			// 别让它变成 1970-01-01（客户端会算出一个负的倒计时）。
			resetsAt: toNum(w.resetAt) ? w.resetAt : null,
			rateLimited: !!w.exceeded
		}))
	}
	// 订阅计费周期：只有 subscriptions 接口给了结束时间才算数（「到期」的唯一来源）。
	let period = null
	if (!subRes.httpError && subRes.body && subRes.body.data) {
		period = makePeriod(subRes.body.data.currentPeriodEnd)
	}
	// 月度池 = 月度剩余 + 额外购买 + 赠送（与官方 CLI 的 totalRemaining 口径一致）。
	// 已用 = 月池总额 − 剩余；剩余可能大于总额，故夹到 [0, total]。
	if (credits.monthlyCredits != null || credits.purchasedCredits != null || credits.freeCredits != null) {
		const remaining = (toNum(credits.monthlyCredits) || 0) + (toNum(credits.purchasedCredits) || 0) + (toNum(credits.freeCredits) || 0)
		const total = weeklyCap !== null ? weeklyCap * 2 : null
		const used = total === null ? null : Math.min(Math.max(total - remaining, 0), total)
		windows.push(makeWindow('monthly', {
			percent: used === null || total === null || total <= 0 ? null : (used / total) * 100,
			used,
			total,
			currency: 'USD',
			// 月度池的周期终点就是订阅到期时间；渲染端据此避免与「到期」行重复显示倒计时。
			resetsAt: period ? period.end : null,
			rateLimited: false
		}))
	}
	if (!windows.length) return { ok: false, error: 'missing-windows' }
	return { ok: true, windows, period }
}

// 凭据解析：优先用 profile 的 apiKeyEnv，缺失时回退家族 env。
async function resolveKey(ctx, apiKeyEnv, familyEnv) {
	const candidates = []
	if (apiKeyEnv && typeof apiKeyEnv === 'string' && apiKeyEnv.length > 0) candidates.push(apiKeyEnv)
	if (familyEnv && familyEnv !== apiKeyEnv) candidates.push(familyEnv)
	for (const name of candidates) {
		try {
			const resolved = await ctx.credentials.resolve(name)
			if (resolved && resolved.value) return { key: resolved.value, from: name }
		} catch { /* 尝试下一个 */ }
	}
	return { key: null, from: null }
}

/* ------------------------------------------------------------------ *
 * 独立整页设置页（Host 半边，只读）—— 契约见 _spec/webpage-v1.md
 * ------------------------------------------------------------------ *
 * 用 ctx.webServer.register 发布 6 条只读路由：1 个 HTML 页面 + 2 个静态资源 + 3 个 JSON 接口。
 * 页面资源从包根 web/ 读，位置相对 import.meta.url，不写死绝对路径。
 * 安全：每个 handler 第一件事是 trust 校验，不通过一律不吐数据；
 * 响应只回 apiKeyEnv（环境变量名）与 baseURL，永远不解析、不返回真实密钥。
 */
const WEB_BASE_PATH = '/dsh-model-toolkit'
// lib/index.js → 包根/web/
const WEB_DIR = new URL('../web/', import.meta.url)
// llm-pi-ai 命名空间是模型清单与 revision 的唯一来源。
const PI_AI_NS = 'llm-pi-ai'
// 单家余量查询的外层上限：balance() 自身已是 15s(+8s 重试) 的请求超时，
// 这里只做「绝不挂住不返回」的兜底（契约 §4）。
const QUOTA_ITEM_TIMEOUT_MS = 30000
// /api/catalog 的候选上限：超出就截断并在顶层置 truncated:true（目录有 1600+ 条，
// 其中一半以上有继承价值，页面用不了那么多，别把响应撑爆）。
const CATALOG_MAX_MODELS = 500

function errText(e) {
	return e && e.message ? String(e.message) : String(e)
}

/** 统一安全响应头（契约 §2.2 / §2.3）：CSP + nosniff + no-referrer。 */
function applySecurityHeaders(res) {
	res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'")
	res.setHeader('x-content-type-options', 'nosniff')
	res.setHeader('referrer-policy', 'no-referrer')
}

/** 统一收尾：安全头 + no-store + content-type。 */
function sendBody(res, status, contentType, body) {
	res.statusCode = status
	applySecurityHeaders(res)
	res.setHeader('content-type', contentType)
	res.setHeader('cache-control', 'no-store')
	res.end(body)
}

/** 纯文本响应：被拒绝/出错时用它，绝不带任何业务数据。 */
function sendPlain(res, status, body) {
	sendBody(res, status, 'text/plain; charset=utf-8', body)
}

/**
 * 308 跳转：只用于「无尾斜杠 → 带尾斜杠」这一种情况（契约 §1 修订）。
 * Location 保持**相对**写法，这样挂在任意反向代理前缀下都跳得对。
 */
function sendRedirect(res, location) {
	res.statusCode = 308
	applySecurityHeaders(res)
	res.setHeader('location', location)
	res.setHeader('cache-control', 'no-store')
	res.end()
}

/** JSON 响应（no-store：state/quota 都是实时事实）。 */
function sendJson(res, status, payload) {
	sendBody(res, status, 'application/json; charset=utf-8', JSON.stringify(payload))
}

/**
 * 信任校验：照抄先例 dsh-host-open-in-app/lib/index.js:1263-1270 的写法——
 * 判断完全交给 `ctx.connection.requestRejection(req)`（Host/Origin 围栏 + 浏览器会话认证），
 * 它返回 403（Host/Origin 不可信）或 401（未认证），只有 undefined 才放行。
 * 该服务缺失或抛错时**失败关闭**（一律 403）：绝不因为取不到判断依据而放行。
 */
function trustRejection(ctx, req) {
	const connection = ctx && ctx.connection
	if (!connection || typeof connection.requestRejection !== 'function') return 403
	try {
		const rejection = connection.requestRejection(req)
		// 只有 undefined / null 视为放行；**其它任何返回值都按拒绝处理**（fail-closed）。
		// 独立验收 F2：原来 `=== 401 || === 403` 之外一律放行，等于给未来新增的拒绝码
		// 留了一个静默放行、直接吐出全量 provider 清单的口子。
		if (rejection === undefined || rejection === null) return undefined
		return rejection === 401 ? 401 : 403
	} catch {
		return 403
	}
}

/** 未通过信任校验时回拒绝状态并返回 true；响应体为空，不返回任何数据。 */
function rejected(ctx, req, res) {
	const rejection = trustRejection(ctx, req)
	if (rejection === undefined) return false
	res.statusCode = rejection
	// 拒绝响应也带上统一安全头（契约 §2「响应头统一加」，独立验收 F3）。
	applySecurityHeaders(res)
	res.setHeader('cache-control', 'no-store')
	res.setHeader('content-type', 'text/plain; charset=utf-8')
	res.end()
	return true
}

/** 给一个 Promise 加外层上限：超时按失败处理（契约 §4「不许挂住不返回」）。 */
function withTimeout(promise, ms) {
	let timer = null
	const limit = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error('timeout')), ms)
	})
	return Promise.race([Promise.resolve(promise).finally(() => clearTimeout(timer)), limit])
}

/**
 * 思考等级列表：取配置里 `reasoningEfforts` 的**等级键**（off/low/high/max…），
 * 与契约 §3 示例 `["off","high","max"]` 一致（wire 值里 off 是 null，不可能是它）。
 */
function reasoningLevels(model) {
	const efforts = model && model.reasoningEfforts
	if (!efforts || typeof efforts !== 'object' || Array.isArray(efforts)) return []
	return Object.keys(efforts)
}

/**
 * 该模型配置里的 `reasoningEfforts` **完整映射**（等级键 → wire 值，off 通常是 null）。
 * 页面「继承自…」要逐字复制 wire 值，所以必须把整张映射读出来（只给等级键数组不够）。
 * 与 reasoningLevels 同一份来源、同一口径：取不到或形状不对给 `{}`。
 */
function reasoningEffortsOf(model) {
	const efforts = model && model.reasoningEfforts
	if (!efforts || typeof efforts !== 'object' || Array.isArray(efforts)) return {}
	return { ...efforts }
}

/**
 * 契约 §10.1 H4：该模型自带的 compat 标记 `compat.thinkingFormat`。
 * 页面在模型 ID 旁显示 `compat·<标记>` 徽标，null 表示不显示。
 * 只认**模型自己** compat 里的字符串值（设置页「兼容信息」面板读的也是模型级 compat，
 * 见 client/client.js:703）；取不到或非字符串一律 null。
 */
function compatTagOf(model) {
	const compat = model && model.compat
	const tag = compat && typeof compat === 'object' && !Array.isArray(compat) ? compat.thinkingFormat : undefined
	return typeof tag === 'string' ? tag : null
}

/**
 * system 角色：`providers.<pid>.compat.supportsDeveloperRole`。
 *
 * 取值必须与页面（web/app.js）以及 DSH 自带设置页的语义一致：
 * - 未设置 → `"auto"`（交给 pi-ai 按 baseURL/协议推断）
 * - `false` → `"system"`（上游只认 system，强制用 system 绕开 422）
 * - `true`  → `"developer"`（明确支持 developer）
 *
 * 早期实现返回 `on`/`off`，与页面认的 `system`/`developer` 对不上，
 * 真数据下那个下拉框只能显示「off（未知取值）」（Lead 实测发现并修正）。
 */
function devRoleOf(profile) {
	const v = profile && profile.compat ? profile.compat.supportsDeveloperRole : undefined
	if (v === true) return 'developer'
	if (v === false) return 'system'
	return 'auto'
}

/**
 * 契约 §9.2 P0-1：线路协议集合 = `profile.api` ∪ 各 `model.api`，去重；取不到给 `[]`。
 * 页面用它判断该线路的 system 角色开关能不能改（非空且含任一 openai-* 协议才允许）。
 * 顺序 = 首次出现顺序（profile.api 在前，再按 models 次序），只保留非空字符串。
 */
function apisOf(profile) {
	const out = []
	const push = (v) => {
		if (typeof v !== 'string' || !v.length) return
		if (!out.includes(v)) out.push(v)
	}
	if (profile && typeof profile === 'object') {
		push(profile.api)
		const models = Array.isArray(profile.models) ? profile.models : []
		for (const m of models) if (m && typeof m === 'object') push(m.api)
	}
	return out
}

/**
 * 契约 §9.2 P0-2：`/api/quota?force=1` → 绕过宿主缓存重新出网查询。
 * 只有显式的假值（`0`/`false`/`no`/`off`/空串）算假；参数缺席当然算假。
 * 解析失败（畸形 url）不抛错，按「不强制」处理，绝不让一个查询参数把接口打成 500。
 */
function quotaForce(req) {
	let raw = null
	try {
		raw = new URL(String(req && req.url ? req.url : '/'), 'http://localhost').searchParams.get('force')
	} catch {
		return false
	}
	if (raw === null) return false
	const v = String(raw).trim().toLowerCase()
	return v !== '' && !['0', 'false', 'no', 'off'].includes(v)
}

/**
 * 契约 §10.1 H5：`/api/quota?provider=<id>` → 只查该家；不带（或空串）仍是全部。
 * 与 quotaForce 同一口径：参数解析失败按「不带」处理，绝不让一个查询参数把接口打成 500。
 */
function quotaProvider(req) {
	let raw = null
	try {
		raw = new URL(String(req && req.url ? req.url : '/'), 'http://localhost').searchParams.get('provider')
	} catch {
		return null
	}
	if (raw === null) return null
	const v = String(raw).trim()
	return v.length ? v : null
}

/**
 * /api/state 的单个 provider：目录字段（来自 providers()）+ llm-pi-ai 里的模型清单。
 * 目录里字段名是 `provider`，契约要 `id`，这里改名。
 */
function stateProvider(entry, piAi) {
	const e = entry || {}
	const id = e.id != null ? String(e.id) : (e.provider != null ? String(e.provider) : null)
	const profile = id && piAi && piAi.providers && typeof piAi.providers === 'object' ? piAi.providers[id] : null
	const models = Array.isArray(profile && profile.models) ? profile.models : []
	return {
		id,
		displayName: e.displayName != null ? e.displayName : null,
		baseURL: e.baseURL != null ? e.baseURL : null,
		apiKeyEnv: e.apiKeyEnv != null ? e.apiKeyEnv : null,
		// 契约 §9.2 P0-1：该线路支持的协议集合（供页面判断 system 角色能否改）。
		apis: apisOf(profile),
		models: models
			.filter((m) => m && m.id != null)
			.map((m) => ({
				id: String(m.id),
				name: typeof m.name === 'string' && m.name.length ? m.name : String(m.id),
				image: Array.isArray(m.input) && m.input.includes('image'),
				reasoning: reasoningLevels(m),
				// 契约 §7.1 补充：完整 wire 映射（原样透出），reasoning 是它的键数组，既有的保留。
				reasoningEfforts: reasoningEffortsOf(m),
				// 契约 §10.1 H4：compat.thinkingFormat（非字符串 → null），供页面显示 compat 徽标。
				compatTag: compatTagOf(m),
				devRole: devRoleOf(profile)
			}))
	}
}

/* ------------------------------------------------------------------ *
 * 写接口（契约 §7）：POST /dsh-model-toolkit/api/save
 * ------------------------------------------------------------------ *
 * 页面只发**增量**，全量模型对象由这里从现有设置里合并；所有 settings 改动走
 * **一次** mutate（原子），成功后**再**写插件偏好（偏好失败只进 warnings，不回滚设置）。
 */

// 请求体上限：页面只发增量（几行模型 + 几个偏好），256KB 是宽松兜底（契约 §7 实现要求 1）。
const SAVE_MAX_BODY_BYTES = 256 * 1024
// devRole 三取值（契约 §3 修订，冻结）。
const DEV_ROLE_VALUES = ['auto', 'system', 'developer']
// reasoningEfforts 校验（契约 §7.1 补充）：键必须是合法等级名、数量 ≤ 20，
// 值是 string（≤ 64）或 null，且 `off` 恒为 null。
const REASONING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
const REASONING_EFFORTS_MAX_KEYS = 20
const REASONING_WIRE_MAX_LEN = 64
// 插件偏好的可写白名单：与 SETTINGS_DEFAULTS / clampSettings 的 8 个键逐一对齐。
const PREF_BOOL_KEYS = ['capabilityEditor', 'badgeAndQuota', 'hoverRefresh', 'autoRefreshOn', 'showMore']
const PREF_FONT_SIZES = ['large', 'middle', 'small']
const PREF_LANGUAGES = ['system', 'en', 'zh']
const PREF_WRITABLE_KEYS = new Set([...PREF_BOOL_KEYS, 'autoRefreshMin', 'fontSize', 'language'])

/** 400 的语义（与 buildSaveOps 共用）：只带一句人话，不回显请求里的任意值。 */
function badRequest(message) {
	return { ok: false, message }
}

/**
 * 校验请求里模型项的完整 `reasoningEfforts` 映射（契约 §7.1 补充）：
 * 必须是普通对象；键 ≤ 20 且都是合法等级名；值是 string（长度 ≤ 64）或 null；
 * `off` 的值必须是 null（保持既有语义）。
 * 错误信息只说结构，不回显请求里的等级名与取值。
 * @returns {{ok:true, value:Object}|{ok:false, message:string}}
 */
function validateReasoningEfforts(raw, label) {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return badRequest(label + ' 必须是对象')
	const levels = Object.keys(raw)
	if (levels.length > REASONING_EFFORTS_MAX_KEYS) {
		return badRequest(label + ' 的键数量不能超过 ' + REASONING_EFFORTS_MAX_KEYS)
	}
	const clean = {}
	for (const level of levels) {
		if (!REASONING_LEVELS.includes(level)) return badRequest(label + ' 含非法思考等级名')
		const value = raw[level]
		if (level === 'off') {
			if (value !== null) return badRequest(label + '.off 必须是 null')
			clean[level] = null
			continue
		}
		if (value === null) {
			clean[level] = null
			continue
		}
		if (typeof value !== 'string' || value.length > REASONING_WIRE_MAX_LEN) {
			return badRequest(label + ' 的值必须是长度不超过 ' + REASONING_WIRE_MAX_LEN + ' 的字符串或 null')
		}
		clean[level] = value
	}
	return { ok: true, value: clean }
}

/**
 * 请求体校验（宽松但明确）：类型不对一律 400，绝不静默改成默认值。
 * 不认识的**顶层**字段忽略（向前兼容）；`prefs` 只收白名单键。
 * @returns {{ok:true, revision:number, models:Array, roles:Array, prefs:Object|null}|{ok:false, message:string}}
 */
function parseSaveRequest(body) {
	if (!Object.prototype.hasOwnProperty.call(body, 'revision')) return badRequest('缺少 revision：写操作必须带版本号')
	const revision = body.revision
	if (typeof revision !== 'number' || !Number.isFinite(revision)) return badRequest('revision 必须是有限数字')
	const out = { revision, models: [], roles: [], prefs: null }

	if (body.models !== undefined) {
		if (!Array.isArray(body.models)) return badRequest('models 必须是数组')
		for (let i = 0; i < body.models.length; i++) {
			const item = body.models[i]
			if (!item || typeof item !== 'object' || Array.isArray(item)) return badRequest(`models[${i}] 必须是对象`)
			if (typeof item.provider !== 'string' || !item.provider) return badRequest(`models[${i}].provider 必须是非空字符串`)
			if (typeof item.model !== 'string' || !item.model) return badRequest(`models[${i}].model 必须是非空字符串`)
			if (item.image !== undefined && typeof item.image !== 'boolean') return badRequest(`models[${i}].image 必须是 boolean`)
			if (item.reasoning !== undefined && (!Array.isArray(item.reasoning) || item.reasoning.some((x) => typeof x !== 'string'))) {
				return badRequest(`models[${i}].reasoning 必须是字符串数组`)
			}
			const change = { provider: item.provider, model: item.model, image: item.image, reasoning: item.reasoning }
			// 契约 §7.1 补充：带完整 reasoningEfforts 时校验后**直接用它**（合并时优先于 reasoning）。
			if (item.reasoningEfforts !== undefined) {
				const checked = validateReasoningEfforts(item.reasoningEfforts, `models[${i}].reasoningEfforts`)
				if (!checked.ok) return checked
				change.reasoningEfforts = checked.value
			}
			out.models.push(change)
		}
	}

	if (body.roles !== undefined) {
		if (!Array.isArray(body.roles)) return badRequest('roles 必须是数组')
		for (let i = 0; i < body.roles.length; i++) {
			const item = body.roles[i]
			if (!item || typeof item !== 'object' || Array.isArray(item)) return badRequest(`roles[${i}] 必须是对象`)
			if (typeof item.provider !== 'string' || !item.provider) return badRequest(`roles[${i}].provider 必须是非空字符串`)
			if (!DEV_ROLE_VALUES.includes(item.devRole)) return badRequest(`roles[${i}].devRole 必须是 auto|system|developer`)
			out.roles.push({ provider: item.provider, devRole: item.devRole })
		}
	}

	if (body.prefs !== undefined) {
		const p = body.prefs
		if (!p || typeof p !== 'object' || Array.isArray(p)) return badRequest('prefs 必须是对象')
		const clean = {}
		for (const key of Object.keys(p)) {
			const value = p[key]
			// 不回显键名：错误信息只讲结构，避免把请求内容反射回响应。
			if (!PREF_WRITABLE_KEYS.has(key)) return badRequest('prefs 含白名单以外的键')
			if (PREF_BOOL_KEYS.includes(key)) {
				if (typeof value !== 'boolean') return badRequest(`prefs.${key} 必须是 boolean`)
				clean[key] = value
				continue
			}
			if (key === 'autoRefreshMin') {
				// 与 clampSettings 同口径：>=1 的有限数字，取整存储。
				if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return badRequest('prefs.autoRefreshMin 必须是不小于 1 的数字')
				clean[key] = Math.round(value)
				continue
			}
			if (key === 'fontSize') {
				if (!PREF_FONT_SIZES.includes(value)) return badRequest('prefs.fontSize 必须是 large|middle|small')
				clean[key] = value
				continue
			}
			if (!PREF_LANGUAGES.includes(value)) return badRequest('prefs.language 必须是 system|en|zh')
			clean[key] = value
		}
		out.prefs = clean
	}

	const hasModels = out.models.length > 0
	const hasRoles = out.roles.length > 0
	const hasPrefs = !!(out.prefs && Object.keys(out.prefs).length)
	if (!hasModels && !hasRoles && !hasPrefs) return badRequest('没有可写入的字段：models / roles / prefs 至少要给一个')
	return { ok: true, ...out }
}

/**
 * 合并单个模型的增量改动到现有**全量**对象上（契约 §7.2）。
 * 只改被点名的字段，其余（contextWindow / maxTokens / name / …）原样带走：
 * 页面给的是增量，绝不能整体覆盖现有模型对象。
 * `reasoningEfforts`（完整映射）优先于 `reasoning`（等级键数组）：两者同时给时只认前者，
 * 不再按等级键重建 wire 值（契约 §7.1 补充）。
 */
function mergeModelChange(existing, change) {
	const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}
	const next = { ...base }
	if (change.image !== undefined) next.input = change.image ? ['text', 'image'] : ['text']
	if (change.reasoningEfforts !== undefined) {
		// parseSaveRequest 已校验过；这里逐字照用（浅拷贝，不把请求对象塞进设置）。
		next.reasoningEfforts = { ...change.reasoningEfforts }
	} else if (change.reasoning !== undefined) {
		const prev = base.reasoningEfforts && typeof base.reasoningEfforts === 'object' && !Array.isArray(base.reasoningEfforts) ? base.reasoningEfforts : {}
		const efforts = {}
		for (const level of change.reasoning) {
			// wire 值优先沿用现有映射；缺失时才用默认（off→null，其它→键名本身）。
			efforts[level] = Object.prototype.hasOwnProperty.call(prev, level) ? prev[level] : (level === 'off' ? null : level)
		}
		next.reasoningEfforts = efforts
	}
	return next
}

/**
 * 把增量改动编译成 settings ops（契约 §7.2）：
 * - 同一 provider 的模型改动合成**一次** set，value 是合并后的完整模型数组；
 * - devRole：auto → unset 单键，system → set false，developer → set true；
 * - 找不到 provider / model 一律 400（不猜、不新建），错误信息不含请求里的标识值。
 */
function buildSaveOps(parsed, piAi) {
	const ops = []
	if (parsed.models.length) {
		const byProvider = new Map()
		for (const change of parsed.models) {
			if (!byProvider.has(change.provider)) byProvider.set(change.provider, [])
			byProvider.get(change.provider).push(change)
		}
		for (const [pid, changes] of byProvider) {
			const profile = piAi.providers[pid]
			if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return badRequest('未知线路：该 provider 不在 llm-pi-ai 设置里')
			const models = Array.isArray(profile.models) ? profile.models.slice() : []
			for (const change of changes) {
				const idx = models.findIndex((m) => m && typeof m === 'object' && String(m.id) === change.model)
				if (idx < 0) return badRequest('未知模型：该线路下没有这个模型 id')
				models[idx] = mergeModelChange(models[idx], change)
			}
			ops.push({ op: 'set', path: ['providers', pid, 'models'], value: models })
		}
	}
	if (parsed.roles.length) {
		// 同一 provider 出现多次时以最后一次为准（ops 里不该出现两条同路径指令）。
		const lastRole = new Map()
		for (const role of parsed.roles) lastRole.set(role.provider, role.devRole)
		for (const [pid, devRole] of lastRole) {
			const profile = piAi.providers[pid]
			if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return badRequest('未知线路：该 provider 不在 llm-pi-ai 设置里')
			const path = ['providers', pid, 'compat', 'supportsDeveloperRole']
			if (devRole === 'auto') ops.push({ op: 'unset', path })
			else ops.push({ op: 'set', path, value: devRole === 'developer' })
		}
	}
	return { ok: true, ops }
}

/** 读请求体（限长 limit 字节）。超限抛 code='too-large'，流错误原样抛。 */
function readRequestBody(req, limit) {
	return new Promise((resolve, reject) => {
		if (!req || typeof req.on !== 'function') {
			resolve('')
			return
		}
		const chunks = []
		let total = 0
		let settled = false
		const settle = (fn, arg) => {
			if (settled) return
			settled = true
			fn(arg)
		}
		req.on('data', (chunk) => {
			if (settled) return
			const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
			total += buf.length
			if (total > limit) {
				const err = new Error('request body too large')
				err.code = 'too-large'
				settle(reject, err)
				return
			}
			chunks.push(buf)
		})
		req.on('end', () => settle(resolve, Buffer.concat(chunks).toString('utf8')))
		req.on('error', (e) => settle(reject, e))
	})
}

/** 写接口的错误响应：一律 JSON，只带 code + 一句人话，不吐业务数据。 */
function sendSaveError(res, status, code, message) {
	sendJson(res, status, { ok: false, code, message })
}

/**
 * 提供商徽章服务：为悬浮浮层读取当前模型的目录真值
 * （上下文窗口、最大 token、输入模态）以及当前提供商的余量
 * （余额金额或订阅限额）。通过 typert `providerBadge/*` 端点暴露给浏览器端。
 * 另在 `webServer` 上发布独立整页设置页（6 条只读 GET + 1 条写 POST，见文件上方契约说明）。
 */
export class ProviderBadgeService extends TypertRemoteService {
	static inject = ['llm', 'credentials', 'settings', 'connection', 'webServer']

	constructor(ctx, config) {
		super(ctx, 'providerBadge')
		this.registerWebRoutes()
	}

	/**
	 * @param request - { provider, model } of the current model.
	 * @returns { contextWindow, maxTokens, input } from the catalog, or nulls.
	 */
	async modelInfo(request) {
		const provider = request && request.provider
		const model = request && request.model
		if (!provider || !model) throw new Error('providerBadge/modelInfo: provider and model are required')
		const found = catalogLookup(provider, model)
		const m = found ? found.model : null
		let input = null
		try {
			const info = await this.ctx.llm.resolveModelInfo(provider, model)
			if (info && Array.isArray(info.inputModalities)) {
				input = info.inputModalities.includes('image') ? ['text', 'image'] : [...info.inputModalities]
			}
		} catch { /* best-effort */ }
		return {
			contextWindow: m && m.contextWindow != null ? m.contextWindow : null,
			maxTokens: m && m.maxTokens != null ? m.maxTokens : null,
			input
		}
	}

	/**
	 * 枚举**当前已启用**的提供商：只取 DSH 真正会用来发请求的路由。
	 *
	 * 主路径：`ctx.llm.listProviders()` —— llm 适配器表里的已注册路由
	 * （每条形如 `{ id, name }`，如 `deepseek-official` / `cmd-01` / `og-01`），
	 * 再 join `listConfigurableProviders()` 目录拿 settingsNs / settingsPath，
	 * 按路径下钻 settings 取该 provider 的 baseURL / apiKeyEnv。
	 * 这份清单与「设置 → 模型」页展示的一致；`name` 即该页显示的名称。
	 *
	 * 为什么不用 `listConfigurableProviders()` 直接枚举（旧实现）：该目录被
	 * dsh-llm-pi-ai 用 pi-ai 的**全部内置 provider**（39 个，如 kimi-coding /
	 * minimax / zai / opencode 等）填充过一遍，直接枚举会把大量本机从未配置的
	 * 内置项列进表格（表现为一整屏「暂不支持」/「未配置 API Key」），并且
	 * 内置的 `deepseek` 会与官方 `deepseek-official` 重复成两行、查同一个账户。
	 * 该目录仍保留，仅用于给已注册路由补 baseURL / apiKeyEnv。
	 * @returns { providers: [{ provider, displayName, baseURL, apiKeyEnv }] }
	 */
	async providers(_request) {
		const out = []
		const seen = new Set()
		// 读全部 settings namespace 的当前解析值，key 为 ns。
		let nsValues = new Map()
		try {
			const descs = this.ctx.settings.describe() || []
			for (const d of descs) if (d && d.ns && d.value != null) nsValues.set(d.ns, d.value)
		} catch (e) {
			console.warn('[provider-badge] settings.describe 失败', e)
		}
		const pushOne = (provider, displayName, baseURL, apiKeyEnv) => {
			if (!provider) return
			const key = String(provider)
			if (seen.has(key)) return
			seen.add(key)
			out.push({ provider: key, displayName: displayName || null, baseURL: baseURL || null, apiKeyEnv: apiKeyEnv || null })
		}
		// configurable 目录按 provider id 索引，供 join 取 settings 落点。
		let byProvider = new Map()
		try {
			const cfgs = this.ctx.llm.listConfigurableProviders ? this.ctx.llm.listConfigurableProviders() : []
			for (const cp of cfgs) if (cp && cp.provider) byProvider.set(String(cp.provider), cp)
		} catch (e) { console.warn('[provider-badge] 读取 configurable 目录失败', e) }
		// 取某 provider 在 settings 里的 profile 对象；空 settingsPath = 整个 section。
		const profileOf = (cp) => {
			if (!cp) return null
			let profile = nsValues.get(cp.settingsNs)
			if (profile == null) return null
			if (cp.settingsPath && cp.settingsPath.length) {
				for (const seg of cp.settingsPath) {
					if (profile == null) break
					profile = profile[seg]
				}
			}
			return profile
		}
		// 已注册路由 → join 目录 → 下钻 settings，取展示名与查询所需的 baseURL/apiKeyEnv。
		const collectRoute = (route) => {
			const id = route && (route.id || route.provider)
			if (!id) return
			const cp = byProvider.get(String(id))
			const profile = profileOf(cp)
			// 展示名优先用适配器声明（如 DeepSeek），退回 settings 的 displayName。
			const displayName = (route && route.name) || (profile && (profile.displayName || profile.name)) || (cp && cp.displayName) || String(id)
			const baseURL = (profile && (profile.baseURL || profile.baseUrl)) || null
			const apiKeyEnv = (profile && profile.apiKeyEnv) || null
			pushOne(id, displayName, baseURL, apiKeyEnv)
		}
		// ---- 主路径：只列已注册（= 已启用）的路由 ----
		let registered = null
		try {
			registered = this.ctx.llm.listProviders ? this.ctx.llm.listProviders() : null
		} catch (e) { console.warn('[provider-badge] 枚举已注册提供商失败', e) }
		if (Array.isArray(registered) && registered.length) {
			for (const route of registered) collectRoute(route)
			return { providers: out }
		}
		// ---- 兜底：拿不到已注册路由时，退回旧逻辑（自定义 + 官方/内置目录）----
		// 注意：旧逻辑会带上 pi-ai 内置的未配置项，仅在 listProviders 不可用时降级使用。
		try {
			const custom = nsValues.get('llm-pi-ai') && nsValues.get('llm-pi-ai').providers
			if (custom && typeof custom === 'object') {
				for (const id of Object.keys(custom)) {
					const c = custom[id] || {}
					pushOne(id, c.displayName || null, c.baseURL || c.baseUrl || null, c.apiKeyEnv || null)
				}
			}
		} catch (e) { console.warn('[provider-badge] 枚举自定义提供方失败', e) }
		for (const cp of byProvider.values()) {
			const profile = profileOf(cp)
			const displayName = (profile && (profile.displayName || profile.name)) || cp.displayName || cp.provider
			const baseURL = (profile && (profile.baseURL || profile.baseUrl)) || null
			const apiKeyEnv = (profile && profile.apiKeyEnv) || null
			pushOne(cp.provider, displayName, baseURL, apiKeyEnv)
		}
		return { providers: out }
	}

	/**
	 * 查询当前提供商的余量。仅 DeepSeek、OpenCode Go 与 Command Code 实际查询；
	 * 其余已识别的厂商回 supported:false + recognized:true，由客户端显示「暂不支持」。
	 * 返回统一结构：balance（余额型金额）/ windows（套餐型窗口）/ period（订阅到期），缺失者为 null。
	 * @param request - { provider, baseURL, apiKeyEnv } of the current provider route.
	 * @returns normalized payload.
	 */
	async balance(request) {
		const provider = request && request.provider
		const baseURL = request && request.baseURL
		const apiKeyEnv = request && request.apiKeyEnv
		const force = !!(request && request.force)
		if (!provider) throw new Error('providerBadge/balance: provider is required')
		const fam = detectFamily(baseURL, provider)
		// 完全未识别的厂商：不展示余量区块。
		if (!fam) return emptyQuota({ supported: false, recognized: false })
		// 已识别但暂不支持查询的厂商：不走网络，直接标记。
		if (!fam.supported) return emptyQuota({ supported: false, recognized: true, family: fam.family, error: 'not-supported' })
		// 支持查询但未配置密钥：也不走网络。
		const { key } = await resolveKey(this.ctx, apiKeyEnv, fam.env)
		if (!key) return emptyQuota({ supported: true, recognized: true, family: fam.family, error: 'no-api-key' })
		// 5 分钟缓存：命中且未过期直接回；否则重新查询并写回。
		// force=true（手动刷新）时绕过缓存命中，重新查询并写回，之后仍正常兜底。
		// 成功与失败的 TTL 不同：失败只留 20s（见 BALANCE_FAILURE_TTL_MS）。
		const cacheKey = provider + '\n' + baseURL + '\n' + fam.env
		const now = Date.now()
		const hit = balanceCache.get(cacheKey)
		if (!force && hit) {
			const ttl = hit.value && hit.value.error ? BALANCE_FAILURE_TTL_MS : BALANCE_CACHE_TTL_MS
			if (now - hit.fetchedAt < ttl) return hit.value
		}
		// 并发合并：同一 provider 在途的查询复用同一个 Promise，快速反复悬停/多端同时查不会堆请求。
		const inflightKey = cacheKey + '\n' + (force ? 'force' : 'cached')
		const running = balanceInflight.get(inflightKey)
		if (running) return running
		const task = (async () => {
			try {
				let result = null
				switch (fam.family) {
					case 'deepseek': result = await queryDeepSeek(baseURL, key); break
					case 'opencode-go': result = await queryOpencodeGo(baseURL, key); break
					case 'commandcode': result = await queryCommandCode(baseURL, key); break
				}
				let value
				if (!result || !result.ok) {
					value = emptyQuota({ supported: true, recognized: true, family: fam.family, error: result ? result.error : 'unknown' })
					// 客户端只能显示一句中文（「网络不可达」/「查询超时」/「HTTP 503」…），
					// 排查时得有原始 error 可看——打到 host 控制台，不进浏览器。
					console.warn('[provider-badge] 余量查询失败', { provider, family: fam.family, error: value.error })
				} else {
					value = {
						supported: true, recognized: true, family: fam.family, error: null,
						balance: result.balance || null,
						windows: result.windows || null,
						period: result.period || null
					}
				}
				balanceCache.set(cacheKey, { fetchedAt: Date.now(), value })
				return value
			} catch (e) {
				return emptyQuota({ supported: true, recognized: true, family: fam.family, error: e && e.message ? e.message : 'unknown' })
			} finally {
				balanceInflight.delete(inflightKey)
			}
		})()
		balanceInflight.set(inflightKey, task)
		return task
	}

	/**
	 * 读取/写入插件设置。op='get' 返回当前设置；op='set' 合并 patch 并持久化。
	 * @param request - { op, patch? }.
	 * @returns { settings }.
	 */
	async settings(request) {
		const op = request && request.op
		if (op === 'set') {
			const clean = writeSettings({ ...readSettings(), ...(request.patch || {}) })
			return { settings: clean }
		}
		return { settings: readSettings() }
	}

	/* ---------------- 独立整页设置页（6 条只读 GET + 1 条写 POST，契约 §1 §7） ---------------- */

	/**
	 * 注册 7 条路由（6 条 GET + 1 条 POST）。
	 * 基路径那条用 `prefix`，一条顶两条：dsh-host-webserver 的匹配语义
	 * （lib/index.js:322-332）是 `pathname === prefix || pathname.startsWith(prefix + '/')`，
	 * 因此它同时覆盖 `/dsh-model-toolkit` 与带尾斜杠的 `/dsh-model-toolkit/`；
	 * 它也会兜住所有未列出的子路径，由页面 handler 明确回 404。
	 * 静态资源与三个 JSON 接口用 `exact`：exact 表先于 prefix 表命中（同一文件 :323-325），
	 * 所以不会被基路径那条吞掉。
	 */
	registerWebRoutes() {
		this.mountWebRoute('prefix', WEB_BASE_PATH, (req, res) => this.servePage(req, res))
		this.mountWebRoute('exact', WEB_BASE_PATH + '/style.css', (req, res) => this.serveAsset(req, res, 'style.css', 'text/css; charset=utf-8'))
		this.mountWebRoute('exact', WEB_BASE_PATH + '/app.js', (req, res) => this.serveAsset(req, res, 'app.js', 'text/javascript; charset=utf-8'))
		this.mountWebRoute('exact', WEB_BASE_PATH + '/api/state', (req, res) => this.serveState(req, res))
		this.mountWebRoute('exact', WEB_BASE_PATH + '/api/catalog', (req, res) => this.serveCatalog(req, res))
		this.mountWebRoute('exact', WEB_BASE_PATH + '/api/quota', (req, res) => this.serveQuota(req, res))
		// 写接口（契约 §7）：这条路只放行 POST，GET 会回 405 + Allow: POST。
		this.mountWebRoute('exact', WEB_BASE_PATH + '/api/save', (req, res) => this.serveSave(req, res), ['POST'])
	}

	/**
	 * 注册一条路由：信任校验 / 方法检查 / 异常兜底都在这里统一做，handler 只负责出内容。
	 * `methods` 不给时默认只放行 GET（保持只读路由「非 GET → 405 + Allow: GET」逐字不变）。
	 * 用 ctx.effect 挂载，插件卸载时路由自动摘掉（重复注册同 (kind,path) 会 throw，不吞异常）。
	 */
	mountWebRoute(kind, routePath, handler, methods) {
		const allowed = Array.isArray(methods) && methods.length ? methods : ['GET']
		const guarded = async (req, res) => {
			try {
				if (rejected(this.ctx, req, res)) return
				if (!allowed.includes(req.method)) {
					res.setHeader('allow', allowed.join(', '))
					sendPlain(res, 405, 'method not allowed\n')
					return
				}
				await handler(req, res)
			} catch (e) {
				// 必须回一个响应：webServer 只记日志（dsh-host-webserver/lib/index.js:246-250），
				// 抛出去会让请求一直挂着不返回。
				console.warn('[provider-badge] 页面请求失败', { path: routePath, error: errText(e) })
				if (!res.writableEnded) sendPlain(res, 500, 'internal error\n')
			}
		}
		this.ctx.effect(() => this.ctx.webServer.register({ kind, path: routePath, handler: guarded }), `provider-badge: ${kind} ${routePath}`)
	}

	/**
	 * HTML 页面：只有 `/dsh-model-toolkit/` 回页面；无尾斜杠先 308 跳转；其余子路径 404。
	 *
	 * 为什么要跳转（契约 §1 修订）：`web/index.html` 用相对路径 `./style.css` / `./app.js` 且没有
	 * `<base>`；文档 URL 不带尾斜杠时，浏览器会把最后一段当成文件名，相对路径被解析到站点根
	 * （`/style.css`）从而 404 —— 页面会「有壳没样式」。跳转后文档 URL 以 `/` 结尾，相对路径恢复正确。
	 */
	async servePage(req, res) {
		const pathname = new URL(String(req.url || '/'), 'http://localhost').pathname
		if (pathname === WEB_BASE_PATH) {
			// 相对 Location：请求 URI 的最后一段无斜杠，故基准目录是 `/`，拼出 `/dsh-model-toolkit/`。
			sendRedirect(res, WEB_BASE_PATH.replace(/^\//, '') + '/')
			return
		}
		if (pathname !== WEB_BASE_PATH + '/') {
			sendPlain(res, 404, 'not found\n')
			return
		}
		await this.serveAsset(req, res, 'index.html', 'text/html; charset=utf-8')
	}

	/** 静态资源：文件名只来自本文件的常量，请求路径不参与拼路径（无目录穿越面）。 */
	async serveAsset(req, res, filename, contentType) {
		let body
		try {
			body = await fs.promises.readFile(new URL(filename, WEB_DIR), 'utf8')
		} catch (e) {
			console.warn('[provider-badge] 读取页面资源失败', { filename, error: errText(e) })
			sendPlain(res, 500, 'page asset unavailable\n')
			return
		}
		sendBody(res, 200, contentType, body)
	}

	/** /api/state：契约 §3。任何一路取数失败都不许 500，失败部分给默认值 + warnings。 */
	async serveState(req, res) {
		const warnings = []
		let catalog = []
		try {
			const listed = await this.providers({})
			catalog = Array.isArray(listed && listed.providers) ? listed.providers : []
		} catch (e) {
			warnings.push('provider catalog unavailable: ' + errText(e))
		}
		let piAi = null
		let revision = 0
		try {
			const descs = this.ctx.settings.describe() || []
			const row = descs.find((d) => d && d.ns === PI_AI_NS)
			if (row) {
				piAi = row.value && typeof row.value === 'object' ? row.value : null
				// 契约 §3：失败的那部分给默认值**并且**在顶层加 warnings。
				// 这一支原来只静默降级：settings 行在、但 value 取不到 providers 时，
				// 所有模型的 models 会整片变空，而 API 自证不出原因（独立验收 F1）。
				if (!piAi || !piAi.providers || typeof piAi.providers !== 'object') {
					warnings.push(PI_AI_NS + ' settings value has no usable providers object; model lists are empty')
				}
				if (Number.isFinite(row.revision)) revision = row.revision
			} else {
				warnings.push(PI_AI_NS + ' settings namespace not found')
			}
		} catch (e) {
			warnings.push('settings unavailable: ' + errText(e))
		}
		const payload = {
			ok: true,
			generatedAt: new Date().toISOString(),
			revision,
			providers: catalog.map((entry) => stateProvider(entry, piAi)),
			// prefs 就是插件自己的 dsh-provider-info.json（readSettings 读不到时回落默认值，不会抛）。
			prefs: readSettings()
		}
		if (warnings.length) payload.warnings = warnings
		sendJson(res, 200, payload)
	}

	/**
	 * 目录清单：pi-ai 内置 provider → 模型 id 的**原始条目**。
	 * 枚举用的是 lib/catalog.js（catalogLookup）背后同一个 pi-ai 目录模块，不另造一套；
	 * 单项真值一律再由 catalogLookup() 查。单条线路取不到只记 warning 跳过，不影响其余线路。
	 * @param warnings - 可选：失败的线路名会 push 进来（供 handler 顶层 warnings）。
	 */
	catalogEntries(warnings) {
		const out = []
		for (const provider of getBuiltinProviders()) {
			let list = []
			try {
				list = getBuiltinModels(provider)
			} catch {
				if (Array.isArray(warnings)) warnings.push('catalog provider unavailable: ' + String(provider))
				continue
			}
			for (const raw of Array.isArray(list) ? list : []) {
				if (!raw || typeof raw.id !== 'string' || !raw.id) continue
				out.push({ provider: String(provider), model: raw.id })
			}
		}
		return out
	}

	/**
	 * /api/catalog：可供「继承自…」挑选的**目录模型**（pi-ai 目录，不是用户自己的配置）。
	 * 每项给 `{ provider, model, name, image, reasoningEfforts }`；
	 * 只保留「有图片能力或有思考等级」的条目（两者都没有的没有继承价值）；
	 * 上限 CATALOG_MAX_MODELS，超出截断并置 `truncated:true`。
	 * 任何一路取数失败都不许 500：给空数组（或已取到的部分）+ 顶层 warnings。
	 */
	async serveCatalog(_req, res) {
		const warnings = []
		let models = []
		let truncated = false
		try {
			for (const entry of this.catalogEntries(warnings)) {
				const found = catalogLookup(entry.provider, entry.model)
				if (!found) continue
				const item = catalogItem(entry.provider, entry.model, found.model)
				if (!item) continue
				if (models.length >= CATALOG_MAX_MODELS) {
					truncated = true
					break
				}
				models.push(item)
			}
		} catch (e) {
			// 整轮枚举失败：按契约给空数组 + warnings，绝不让接口 500。
			warnings.push('catalog unavailable: ' + errText(e))
			models = []
			truncated = false
		}
		const payload = { ok: true, models, warnings }
		if (truncated) payload.truncated = true
		sendJson(res, 200, payload)
	}

	/** /api/quota：契约 §4。逐家并发查询，单家失败/超时只影响该项，整体恒 200。 */
	async serveQuota(req, res) {
		const warnings = []
		let catalog = []
		try {
			const listed = await this.providers({})
			catalog = Array.isArray(listed && listed.providers) ? listed.providers : []
		} catch (e) {
			warnings.push('provider catalog unavailable: ' + errText(e))
		}
		// 契约 §9.2 P0-2：force 必须一路传到 balance()，否则「刷新」按钮只是重读宿主缓存。
		const force = quotaForce(req)
		// 契约 §10.1 H5：带 provider 时只查该家（页面行内刷新用）；不带仍是全部。
		// 未知 provider 不是错误：回 200 + 空 items + warning，页面据此显示该行无数据而不是整表失败。
		const wanted = quotaProvider(req)
		if (wanted !== null) {
			const only = catalog.filter((entry) => {
				const id = entry && entry.provider != null ? entry.provider : (entry && entry.id != null ? entry.id : null)
				return id !== null && String(id) === wanted
			})
			if (!only.length) warnings.push('quota: requested provider is not in the provider catalog')
			catalog = only
		}
		const items = await Promise.all(catalog.map((entry) => this.quotaItem(entry, warnings, force)))
		sendJson(res, 200, { ok: true, items, warnings })
	}

	/**
	 * 单家余量：balance() 的返回值原样透传（balance/windows/period 保持它给的样子，
	 * 即使是 null 也不改形状）；抛错或超时按失败处理，error 填一句能读的话。
	 */
	async quotaItem(entry, warnings, force) {
		const e = entry || {}
		const provider = e.provider != null ? String(e.provider) : (e.id != null ? String(e.id) : null)
		const base = {
			provider,
			displayName: e.displayName != null ? e.displayName : null,
			supported: false,
			recognized: false,
			family: null,
			error: null,
			balance: null,
			windows: null,
			period: null
		}
		if (!provider) return base
		try {
			const value = await withTimeout(
				this.balance({ provider, baseURL: e.baseURL, apiKeyEnv: e.apiKeyEnv, force: !!force }),
				QUOTA_ITEM_TIMEOUT_MS
			)
			if (!value || typeof value !== 'object') return { ...base, error: 'no-result' }
			return { ...base, ...value, provider, displayName: base.displayName }
		} catch (err) {
			const message = errText(err)
			warnings.push(provider + ': ' + message)
			return { ...base, error: message }
		}
	}

	/* ---------------- 写接口：POST /api/save（契约 §7） ---------------- */

	/** 从 settings.describe() 取 llm-pi-ai 那条：{value, revision}，没有则 null。 */
	describePiAi() {
		const descs = this.ctx.settings.describe() || []
		const row = descs.find((d) => d && d.ns === PI_AI_NS)
		if (!row) return null
		return {
			value: row.value && typeof row.value === 'object' ? row.value : null,
			revision: Number.isFinite(row.revision) ? row.revision : 0
		}
	}

	/**
	 * mutate 抛错后判定是不是版本冲突：以**重新 describe 到的当前 revision** 为准，
	 * 而不是猜异常文案（不同实现抛的错长得不一样）。读不到就当普通失败（500）。
	 */
	isRevisionConflict(expected) {
		try {
			const row = this.describePiAi()
			if (row) return row.revision !== expected
		} catch { /* 读不到，按普通失败处理 */ }
		return false
	}

	/**
	 * 写接口主流程（契约 §7）：
	 * 限长读体 → JSON/字段校验（400）→ 从现有设置合并出 ops → **一次** mutate（原子）
	 * → 成功后再写插件偏好（失败只进 warnings）→ 重新 describe 拿新 revision 回 200。
	 * 错误映射：revision 冲突 → 409 conflict；其它异常 → 500 server（message 不含任何设置值）。
	 */
	async serveSave(req, res) {
		let raw
		try {
			raw = await readRequestBody(req, SAVE_MAX_BODY_BYTES)
		} catch (e) {
			if (e && e.code === 'too-large') {
				sendSaveError(res, 400, 'bad-request', '请求体过大（上限 256KB）')
				return
			}
			sendSaveError(res, 400, 'bad-request', '读取请求体失败')
			return
		}
		if (typeof raw !== 'string' || raw.trim() === '') {
			sendSaveError(res, 400, 'bad-request', '请求体为空')
			return
		}
		let body
		try {
			body = JSON.parse(raw)
		} catch {
			sendSaveError(res, 400, 'bad-request', 'JSON 解析失败')
			return
		}
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			sendSaveError(res, 400, 'bad-request', '请求体必须是 JSON 对象')
			return
		}
		const parsed = parseSaveRequest(body)
		if (!parsed.ok) {
			sendSaveError(res, 400, 'bad-request', parsed.message)
			return
		}

		const warnings = []
		const wantSettings = parsed.models.length > 0 || parsed.roles.length > 0
		let piAi = null
		let currentRevision = null
		try {
			const row = this.describePiAi()
			piAi = row ? row.value : null
			currentRevision = row && Number.isFinite(row.revision) ? row.revision : null
		} catch (e) {
			console.warn('[provider-badge] 保存前读取设置失败', errText(e))
			// 只改 prefs 时可以不依赖 settings；要改 settings 就必须读得到。
			if (wantSettings) {
				sendSaveError(res, 500, 'server', '设置读取失败')
				return
			}
		}
		// 版本校验对**所有**写请求统一生效，哪怕这次只改 prefs：
		// 否则"过期 revision + 只改 prefs"会静默保存成功，与设置写入的冲突语义不一致。
		if (currentRevision !== null && parsed.revision !== currentRevision) {
			sendSaveError(res, 409, 'conflict', '设置已被其它地方修改，请刷新页面后重试')
			return
		}
		if (wantSettings && (!piAi || !piAi.providers || typeof piAi.providers !== 'object')) {
			sendSaveError(res, 500, 'server', '设置内容不可用')
			return
		}

		const plan = buildSaveOps(parsed, piAi)
		if (!plan.ok) {
			sendSaveError(res, 400, 'bad-request', plan.message)
			return
		}

		// 一次 mutate：模型数组与 devRole 指令全在这一批里，要么全成要么全不成。
		if (plan.ops.length) {
			try {
				await this.ctx.settings.mutate(PI_AI_NS, plan.ops, parsed.revision)
			} catch (e) {
				console.warn('[provider-badge] 保存设置失败', errText(e))
				if (this.isRevisionConflict(parsed.revision)) {
					sendSaveError(res, 409, 'conflict', '设置已被其它地方修改，请刷新页面后重试')
					return
				}
				sendSaveError(res, 500, 'server', '设置写入失败')
				return
			}
		}

		// settings 原子写成功后，再落插件偏好；偏好失败不回滚设置，只在 warnings 里如实说明。
		if (parsed.prefs && Object.keys(parsed.prefs).length) {
			try {
				writeSettings({ ...readSettings(), ...parsed.prefs })
			} catch (e) {
				console.warn('[provider-badge] 保存插件偏好失败', errText(e))
				warnings.push('插件偏好写入失败，模型能力已保存')
			}
		}

		let revision = parsed.revision
		try {
			const row = this.describePiAi()
			if (row && Number.isFinite(row.revision)) revision = row.revision
		} catch { /* 拿不到就回请求里带的版本号 */ }

		sendJson(res, 200, { ok: true, revision, warnings })
	}
}

/* ------------------------------------------------------------------ *
 * 插件入口：挂载两个各自独立的 Service（不合并类、不动各自 inject）。
 * ------------------------------------------------------------------ */
export default function apply(ctx) {
	ctx.plugin(ModelCapabilityService)
	ctx.plugin(ProviderBadgeService)
}
