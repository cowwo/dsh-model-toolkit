/**
 * 「显示更多信息」设置项的实测脚本（开发期用，不参与插件运行）：
 * 用**临时 DSH_HOME** 跑真实的 settings 读写，确认三件事——
 *   1) 这个键能通过 typert 的严格 schema（否则保存会被整包拒绝，界面显示「保存失败」）；
 *   2) 默认是开（true），且写入后能读回、能落盘；
 *   3) 脏数据（字符串等）会被夹回默认值。
 * 绝不会碰用户真实的 $DSH_HOME/dsh-provider-info.json。
 *
 * 用法：node tools/verify-settings.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
// 合并后 lib/index.js 的默认导出变成了插件函数 apply()，Service 改为具名导出。
import { ProviderBadgeService } from '../lib/index.js'
import { TYPERT } from '../lib/typert.host.js'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-provider-info-'))
process.env.DSH_HOME = home
const file = path.join(home, 'dsh-provider-info.json')

const noop = () => {}
const ctx = new Proxy({}, { get: (t, p) => (p === 'reflect' ? new Proxy({}, { get: () => noop }) : noop) })
const service = new ProviderBadgeService(ctx, {})

const invocation = TYPERT.invocations.find((i) => i.method === 'settings')
// 清单里的 codec 形状是 { mode, typeSymbol, create }（没有 `schema`）：
// create() 才返回真正的 zod v4 schema，直接读 `.schema` 会拿到 undefined。
const reqSchema = invocation.parameters[0].codec.create()
const resSchema = invocation.result.create()

let failed = 0
const check = (what, actual, expected) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expected)
	if (!ok) failed++
	console.log((ok ? '  ok   ' : '  FAIL ') + what + '  =>  ' + JSON.stringify(actual) + (ok ? '' : '   (期望 ' + JSON.stringify(expected) + ')'))
}

console.log('\n【严格 schema：这个设置必须能存下去】')
check('set {showMore:true} 被接受', reqSchema.safeParse({ op: 'set', patch: { showMore: true } }).success, true)
check('set {showMore:false} 被接受', reqSchema.safeParse({ op: 'set', patch: { showMore: false } }).success, true)
// zod 的 object 默认**剥离**未知键（不是报错）——所以 schema 里漏写 showMore 的后果是
// 「勾选框翻动、请求成功、但什么都没存」这种静默失效，比报错更难发现，必须靠这条断言守住。
check('未知键被剥离，不会到达 host 逻辑', reqSchema.safeParse({ op: 'set', patch: { showMore: true, nonsense: 1 } }).data.patch, { showMore: true })
check('类型错仍然报错', reqSchema.safeParse({ op: 'set', patch: { showMore: 'yes' } }).success, false)
check('结果 schema 接受 {settings:{showMore}}', resSchema.safeParse({ settings: { showMore: false } }).success, true)

console.log('\n【默认值：默认开启】')
const got = await service.settings({ op: 'get' })
check('默认 showMore', got.settings.showMore, true)
check('默认返回值过结果 schema', resSchema.safeParse(got).success, true)

console.log('\n【写入 → 读回 → 落盘】')
const set = await service.settings({ op: 'set', patch: { showMore: false } })
check('写入后返回 showMore', set.settings.showMore, false)
check('再读一次仍是 false', (await service.settings({ op: 'get' })).settings.showMore, false)
check('已落盘到 json 文件', JSON.parse(fs.readFileSync(file, 'utf8')).showMore, false)
check('其余设置未被破坏', (await service.settings({ op: 'get' })).settings.hoverRefresh, true)

console.log('\n【脏数据夹回默认值】')
fs.writeFileSync(file, JSON.stringify({ showMore: 'yes', hoverRefresh: null }))
const dirty = await service.settings({ op: 'get' })
check('字符串 "yes" 回落到默认值（默认开）', dirty.settings.showMore, true)
check('null 的 hoverRefresh 回落默认值', dirty.settings.hoverRefresh, true)

fs.writeFileSync(file, JSON.stringify({ showMore: false }))
check('显式 false 才算关（不被默认值顶回来）', (await service.settings({ op: 'get' })).settings.showMore, false)

fs.rmSync(home, { recursive: true, force: true })
console.log('\n' + (failed ? failed + ' 项不符' : '全部符合预期（临时目录已清理：' + path.basename(home) + '）'))
process.exit(failed ? 1 : 0)
