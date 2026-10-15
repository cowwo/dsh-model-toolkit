/**
 * 「瞬时失败重试 + 缓存 TTL」的实测脚本（开发期用，不参与插件运行）：
 * 把 globalThis.fetch 换成剧本化替身，跑真实的 ProviderBadgeService.balance()，确认四件事——
 *   1) 连接被 reset（network）会重试一次，第二次成功即算成功；
 *   2) 429 / 5xx 同样重试，而 401 这类确定性错误只发一次（不浪费往返）；
 *   3) 失败结果只留 20s（短去重），不会像成功结果那样把「查询失败」钉住 5 分钟；
 *   4) 成功结果仍按 5 分钟缓存。
 * 全程不打厂商接口（fetch 是替身），也不碰真实 $DSH_HOME。
 *
 * 背景：用户侧的截图里设置页 4 家全「查询失败」，而浮层却能拿到 go-02 的窗口数据——
 * 起因就是一次瞬时抖动 + 失败被负缓存 5 分钟（浮层开了悬停强刷、绕缓存，所以它是好的）。
 *
 * 用法：node tools/verify-resilience.mjs
 */
// 合并后 lib/index.js 的默认导出变成了插件函数 apply()，Service 改为具名导出。
import { ProviderBadgeService } from '../lib/index.js'

const BASE = 'https://opencode.ai/zen/go/v1'
const isoIn = (ms) => new Date(Date.now() + ms).toISOString()
const usage = () => ({
	usage: {
		rolling: { percent: 1, status: 'ok', resetsAt: isoIn(3600e3) },
		weekly: { percent: 2, status: 'ok', resetsAt: isoIn(86400e3) },
		monthly: { percent: 3, status: 'ok', resetsAt: isoIn(9 * 86400e3) }
	}
})

// ---- 剧本化 fetch 替身：每次调用消费一条剧本，空了默认回成功 ----
let calls = 0
let script = []
const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
globalThis.fetch = async () => {
	calls++
	const step = script.shift() || { status: 200, body: usage() }
	if (step.err) {
		const e = new TypeError('fetch failed')
		e.cause = { code: step.err }
		throw e
	}
	return jsonResponse(step.status, step.body)
}

const noop = () => {}
const base = {
	credentials: { resolve: async (name) => (name === 'OG_01_API_KEY' ? { value: 'test-key' } : null) },
	settings: { describe: () => [] },
	llm: {}
}
const ctx = new Proxy(base, {
	get: (target, prop) => {
		if (prop in target) return target[prop]
		if (prop === 'reflect') return new Proxy({}, { get: () => noop })
		return noop
	}
})
const service = new ProviderBadgeService(ctx, {})

// ---- 可控时钟：缓存 TTL 用 Date.now 判定，这里只挪时钟、不真等 ----
const realNow = Date.now
let clockOffset = 0
Date.now = () => realNow.call(Date) + clockOffset

let failed = 0
const check = (what, actual, expected) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expected)
	if (!ok) failed++
	console.log((ok ? '  ok   ' : '  FAIL ') + what + '  =>  ' + JSON.stringify(actual) + (ok ? '' : '   (期望 ' + JSON.stringify(expected) + ')'))
}
const query = (provider, force) => service.balance({ provider, baseURL: BASE, apiKeyEnv: 'OG_01_API_KEY', force: !!force })

console.log('\n【瞬时失败重试：冷连接被 reset，第二次就成功】')
script = [{ err: 'ECONNRESET' }, { status: 200, body: usage() }]
calls = 0
let r = await query('og-01', true)
check('network 后重试成功', r.error, null)
check('拿到三个窗口', (r.windows || []).map((w) => w.key).join(','), 'rolling,weekly,monthly')
check('确实发了两次请求（1 次重试）', calls, 2)

console.log('\n【429 / 5xx 重试，确定性错误不重试】')
script = [{ status: 429, body: {} }, { status: 200, body: usage() }]
calls = 0
r = await query('og-02', true)
check('429 重试后成功', r.error, null)
check('429 发了两次', calls, 2)
script = [{ status: 503, body: {} }, { err: 'ECONNRESET' }]
calls = 0
r = await query('og-03', true)
check('5xx→重试→network：最终如实报 network', r.error, 'network')
check('5xx + network 共两次尝试', calls, 2)
script = [{ status: 401, body: { error: { type: 'Unauthorized', message: 'bad key' } } }]
calls = 0
r = await query('og-04', true)
check('401 只发一次（确定性错误不重试）', calls, 1)
check('401 归类为密钥无效', r.error, 'unauthorized')

console.log('\n【失败只留 20s：表格会自愈，不再被钉 5 分钟】')
script = [{ err: 'ECONNRESET' }, { err: 'ECONNRESET' }]
calls = 0
r = await query('og-05', true)
check('重试后仍失败 → network', r.error, 'network')
check('两次尝试都发了', calls, 2)
script = [{ status: 200, body: usage() }]
calls = 0
const cachedFail = await query('og-05', false)
check('20s 内 force=false 命中失败缓存（合并重复请求）', calls, 0)
check('缓存回来的仍是失败结果', cachedFail.error, 'network')
clockOffset += 21000
script = [{ status: 200, body: usage() }]
calls = 0
const healed = await query('og-05', false)
check('过了 20s 自动重查（无需用户点刷新）', calls, 1)
check('这次拿到了数据', healed.error === null && (healed.windows || []).length === 3, true)
clockOffset = 0

console.log('\n【成功结果仍是 5 分钟缓存】')
script = [{ status: 200, body: usage() }]
calls = 0
await query('og-06', true)
check('首查一次', calls, 1)
clockOffset += 60 * 1000
calls = 0
await query('og-06', false)
check('1 分钟内命中缓存，不打接口', calls, 0)
clockOffset += 5 * 60 * 1000
calls = 0
await query('og-06', false)
check('超过 5 分钟重新查询', calls, 1)
clockOffset = 0

Date.now = realNow
console.log('\n' + (failed ? failed + ' 项不符' : '全部符合预期'))
process.exit(failed ? 1 : 0)
