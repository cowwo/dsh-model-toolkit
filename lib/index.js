/* dsh-model-toolkit host entry — 合并 dsh-model-fit (v0.2.3) 与 dsh-provider-info (v0.17.0)。
 * 两个 Service 各自保留自己的 static inject，不合并成一个类：
 *   ModelCapabilityService -> ['llm']
 *   ProviderBadgeService   -> ['llm', 'credentials', 'settings']
 */
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { catalogLookup } from './catalog.js'

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
			if (catalogModel.thinkingLevelMap && typeof catalogModel.thinkingLevelMap === 'object') {
				wire = {}
				for (const [key, value] of Object.entries(catalogModel.thinkingLevelMap)) {
					if (value !== undefined) wire[key] = value
				}
			}
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

/**
 * 提供商徽章服务：为悬浮浮层读取当前模型的目录真值
 * （上下文窗口、最大 token、输入模态）以及当前提供商的余量
 * （余额金额或订阅限额）。通过 typert `providerBadge/*` 端点暴露给浏览器端。
 */
export class ProviderBadgeService extends TypertRemoteService {
	static inject = ['llm', 'credentials', 'settings']

	constructor(ctx, config) {
		super(ctx, 'providerBadge')
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
}

/* ------------------------------------------------------------------ *
 * 插件入口：挂载两个各自独立的 Service（不合并类、不动各自 inject）。
 * ------------------------------------------------------------------ */
export default function apply(ctx) {
	ctx.plugin(ModelCapabilityService)
	ctx.plugin(ProviderBadgeService)
}
