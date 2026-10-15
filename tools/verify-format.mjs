/**
 * 渲染文案的实测脚本（开发期用，不参与插件运行）：
 * 从 client/client.js 里**原样抽取**「余量数据 → 统一文案」这段真实源码执行，
 * 输入真实/代表性数据，打印浮层与设置页表格将要显示的每一格文字并做断言。
 * 这样格式逻辑不靠人肉阅读，也不靠复制一份实现来"测试自己"。
 *
 * 用法：node tools/verify-format.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// 合并后：指向本包 merge 产物的 client.js（dsh-model-toolkit/client/client.js）
const CLIENT = path.join(here, '../client/client.js')
console.log('client.js :', CLIENT)
const src = fs.readFileSync(CLIENT, 'utf8')

const start = src.indexOf('//#region 余量数据 → 统一文案')
const end = src.indexOf('//#endregion', start)
if (start < 0 || end < 0) throw new Error('找不到 client.js 里的文案 region 标记')
const region = src.slice(start, end)

const dict = {
	'quota.win.rolling': '5小时',
	'quota.win.weekly': '周',
	'quota.win.monthly': '月',
	balance: '余量',
	balanceName: '余额',
	window: '窗口',
	expiresOn: '到期',
	leftDays: '剩',
	daysUnit: '天',
	insufficient: '（余额不足）',
	rateLimited: '已限流',
	noReset: '—',
	noData: '无数据',
	noSupportProvider: '当前暂不支持查询当前提供商',
	noApiKey: '未配置 API Key',
	subscriptionRequired: '订阅权限不足',
	unauthorized: '密钥无效',
	http404: '接口地址错误',
	queryFailed: '查询失败',
	netUnreachable: '网络不可达',
	queryTimeout: '查询超时',
	httpRateLimited: '请求过频（429）',
	httpServerError: '服务端错误',
	httpStatus: 'HTTP 状态',
	missingUsage: '接口无用量数据'
}
const tx = (k) => (dict[k] != null ? dict[k] : k)
const resolveLang = () => 'zh'

// eslint-disable-next-line no-new-func
const api = new Function('tx', 'resolveLang', region + `
	return { windowLabel, windowValue, windowCells, windowColumns, compactWindowText, balanceValue, periodValue, quotaErrorText, quotaStatusText, isTransientQuota, hasQuotaData, sortedWindows };
`)(tx, resolveLang)

let failed = 0
const check = (what, actual, expected) => {
	const ok = actual === expected
	if (!ok) failed++
	console.log((ok ? '  ok   ' : '  FAIL ') + what + '  =>  ' + JSON.stringify(actual) + (ok ? '' : '   (期望 ' + JSON.stringify(expected) + ')'))
}
/** 去掉末尾的「· 倒计时」（倒计时随当前时间变化，其余部分固定；行内还有别的 · 分隔符，不能按 split 取首段）。 */
const dropCountdown = (s) => String(s).replace(/\s·\s(?:\d+d\d+h|\d+h\d+m|\d+m)$/, "");

// ---- 真实返回样本（来自 tools/verify-quota.mjs 的实测输出）----
const deepseek = {
	supported: true, recognized: true, family: 'deepseek', error: null,
	balance: { isAvailable: true, items: [{ currency: 'USD', total: 0 }, { currency: 'CNY', total: 20.38 }] },
	windows: null, period: null
}
// 夹具的字段结构照抄实测样本，但 resetsAt / 到期时间改成「相对当前时间」生成：
// 否则日期一过，倒计时与到期断言就会随时间失效。
const isoIn = (ms) => new Date(Date.now() + ms).toISOString()
const ogRollEnd = isoIn(3 * 3600000), ogWeekEnd = isoIn(4 * 86400000), ogMonthEnd = isoIn(9 * 86400000)
const ccRollEnd = isoIn(5 * 3600000), ccWeekEnd = isoIn(6 * 3600000), ccMonthEnd = isoIn(23 * 86400000)

const opencodeGo = {
	supported: true, recognized: true, error: null,
	// host 侧由月窗 resetsAt 推导出的「到期」（Go 没有独立的订阅字段）
	balance: null, period: { end: ogMonthEnd, daysLeft: 9 },
	windows: [
		{ key: 'monthly', durationHours: 720, percent: 72, used: 43.2, total: 60, currency: 'USD', resetsAt: ogMonthEnd, rateLimited: false },
		{ key: 'rolling', durationHours: 5, percent: 2, used: 0.24, total: 12, currency: 'USD', resetsAt: ogRollEnd, rateLimited: false },
		{ key: 'weekly', durationHours: 168, percent: 1, used: 0.3, total: 30, currency: 'USD', resetsAt: ogWeekEnd, rateLimited: false }
	]
}
const commandCode = {
	supported: true, recognized: true, error: null, balance: null,
	period: { end: ccMonthEnd, daysLeft: 23 },
	windows: [
		{ key: 'rolling', durationHours: 5, percent: 5.09, used: 0.71, total: 14, currency: 'USD', resetsAt: ccRollEnd, rateLimited: false },
		{ key: 'weekly', durationHours: 168, percent: 22.07, used: 7.72, total: 35, currency: 'USD', resetsAt: ccWeekEnd, rateLimited: false },
		{ key: 'monthly', durationHours: 720, percent: 9.94, used: 6.96, total: 70, currency: 'USD', resetsAt: ccMonthEnd, rateLimited: false }
	]
}
const kimi = { supported: false, recognized: true, family: 'kimi', error: 'not-supported', balance: null, windows: null, period: null }
const unknown = { supported: false, recognized: false, family: null, error: null, balance: null, windows: null, period: null }

console.log('\n【浮层：deepseek】')
check('行标签', '余额', dict.balanceName)
check('行内容', api.balanceValue(deepseek.balance), '¥20.38 / $0.00')

console.log('\n【浮层：og-01（窗口顺序必须按真实时长排：5小时→周→月），显示更多信息=开】')
const ogSorted = api.sortedWindows(opencodeGo)
check('窗口顺序', ogSorted.map((w) => w.key).join(','), 'rolling,weekly,monthly')
check('5小时 行', api.windowLabel(ogSorted[0]), '5小时')
check('5小时 值', dropCountdown(api.windowValue(ogSorted[0], { more: true, countdown: true, period: opencodeGo.period })), '2.00% · $0.24/$12.00')
check('周 值', dropCountdown(api.windowValue(ogSorted[1], { more: true, countdown: true, period: opencodeGo.period })), '1.00% · $0.30/$30.00')
check('月 值', dropCountdown(api.windowValue(ogSorted[2], { more: true, countdown: true })), '72.00% · $43.20/$60.00')
check('月 值带倒计时（与 5小时/周 对齐）', / · \d/.test(api.windowValue(ogSorted[2], { more: true, countdown: true })), true)
const ogMonthCells = api.windowCells(ogSorted[2], { more: true, countdown: true })
check('分列：比例', ogMonthCells.pct, '72.00%')
check('分列：金额（不带括号）', ogMonthCells.money, '$43.20/$60.00')
check('分列：尾列＝倒计时', /^\d+[dhm]/.test(ogMonthCells.tail), true)
check('一行文本＝三列用 · 拼起来', api.windowValue(ogSorted[2], { more: true, countdown: false }), ogMonthCells.pct + ' · ' + ogMonthCells.money)
const ogMonthCols = api.windowColumns(ogSorted[2], { more: true, countdown: true })
check('浮层分列：比例带尾点', ogMonthCols.pct, '72.00% ·')
check('浮层分列：金额带尾点', ogMonthCols.money, '$43.20/$60.00 ·')
check('浮层分列：尾列＝倒计时', ogMonthCols.tail, ogMonthCells.tail)
check('浮层分列：一行三段的字符与 windowValue 一致', [ogMonthCols.pct.split(' ·')[0], ogMonthCols.money.split(' ·')[0], ogMonthCols.tail].join(' · '), api.windowValue(ogSorted[2], { more: true, countdown: true }))
check('到期行＝月窗终点那一天（两行各给一半、指向同一时刻）', api.periodValue(opencodeGo.period, { more: true }), api.periodValue({ end: ogMonthEnd, daysLeft: 9 }, { more: true }))
check('到期 行', api.periodValue(opencodeGo.period, { more: true }), api.periodValue({ end: ogMonthEnd, daysLeft: 9 }, { more: true }))

console.log('\n【浮层：cmd-01（月行同样带自己的重置倒计时），显示更多信息=开】')
const ccSorted = api.sortedWindows(commandCode)
check('月 值', dropCountdown(api.windowValue(ccSorted[2], { more: true, countdown: true })), '9.94% · $6.96/$70.00')
check('月 值带倒计时', / · \d/.test(api.windowValue(ccSorted[2], { more: true, countdown: true })), true)
check('5小时 值附倒计时', dropCountdown(api.windowValue(ccSorted[0], { more: true, countdown: true })), '5.09% · $0.71/$14.00')
check('到期 行', api.periodValue(commandCode.period, { more: true }), api.periodValue({ end: ccMonthEnd, daysLeft: 23 }, { more: true }))

console.log('\n【显示更多信息=关（默认）：只留比例数字与到期日期】')
check('不传选项也默认关（调用处漏传也安全）', api.windowValue(ogSorted[0]), '2.00%')
check('浮层窗口行只剩百分比', api.windowValue(ogSorted[0], { more: false, countdown: true }), '2.00%')
check('表格窗口格只剩百分比', api.windowValue(ccSorted[2], { more: false, countdown: false }), '9.94%')
check('关掉更多信息：金额列为空', api.windowCells(ogSorted[2], { more: false }).money, '')
check('关掉更多信息：尾列为空', api.windowCells(ogSorted[2], { more: false, countdown: true }).tail, '')
check('关掉更多信息：浮层分列只剩比例、且不带尾点', api.windowColumns(ogSorted[2], { more: false, countdown: true }).pct, '72.00%')
check('关掉更多信息：到期无剩余天数', api.periodValue(opencodeGo.period, { more: false }), api.periodValue({ end: ogMonthEnd }, { more: false }))
check('到期只剩日期', api.periodValue(commandCode.period, { more: false }), api.periodValue({ end: ccMonthEnd }, { more: false }))
check('余额型不受影响', api.balanceValue(deepseek.balance), '¥20.38 / $0.00')
check('「已限流」是状态警告，不随开关隐藏', api.windowValue({ key: 'rolling', percent: 5, rateLimited: true }, { more: false, countdown: true }), '5.00% · 已限流')
check('「已限流」归到尾列', api.windowCells({ key: 'rolling', percent: 5, rateLimited: true }, { more: false }).tail, '已限流')
check('浮层分列：只有比例＋已限流时，点加在比例后面', api.windowColumns({ key: 'rolling', percent: 5, rateLimited: true }, { more: false, countdown: true }).pct, '5.00% ·')
// 收起态（不勾「显示更多信息」）：比例与限流标记拼成一段，作为一个右对齐的值渲染。
check('收起态一行文本：只有比例', api.compactWindowText({ key: 'weekly', percent: 77, rateLimited: false }), '77.00%')
check('收起态一行文本：比例＋已限流', api.compactWindowText({ key: 'rolling', percent: 5, rateLimited: true }), '5.00% · 已限流')
check('收起态一行文本：没有比例时为空', api.compactWindowText({ key: 'rolling' }), '')
check('（既有口径）百分比为 null 时按 0 显示，不当成缺失', api.compactWindowText({ key: 'rolling', percent: null }), '0.00%')

console.log('\n【设置页表格：套餐型没有「余额」格（余额列只服务充值型）】')
check('og 余额格', api.balanceValue(opencodeGo.balance), '')
check('cmd 余额格', api.balanceValue(commandCode.balance), '')
check('deepseek 到期格', api.periodValue(deepseek.period, { more: true }), '')

console.log('\n【查不了的厂商：状态跟在名称后，不占数据列】')
check('kimi 状态文案', api.quotaStatusText(kimi), '当前暂不支持查询当前提供商')
check('kimi 是否显示该行', api.hasQuotaData(kimi), true)
check('未识别厂商收起态隐藏', api.hasQuotaData(unknown), false)
check('未识别厂商状态文案', api.quotaStatusText(unknown), '当前暂不支持查询当前提供商')

console.log('\n【出错文案：能指路，不再一律「查询失败」】')
const errQuota = (error) => ({ supported: true, recognized: true, family: 'opencode-go', error, balance: null, windows: null, period: null })
check('连接被 reset', api.quotaErrorText(errQuota('network')), '网络不可达')
check('超时', api.quotaErrorText(errQuota('timeout')), '查询超时')
check('厂商限流', api.quotaErrorText(errQuota('http-429')), '请求过频（429）')
check('服务端错误带状态码', api.quotaErrorText(errQuota('http-503')), '服务端错误 503')
check('其它 HTTP 状态带状态码', api.quotaErrorText(errQuota('http-418')), 'HTTP 状态 418')
check('未知原因仍兜底「查询失败」', api.quotaErrorText(errQuota('something-else')), '查询失败')
check('原有文案不被顶掉：密钥', api.quotaErrorText(errQuota('no-api-key')), '未配置 API Key')
check('原有文案不被顶掉：404', api.quotaErrorText(errQuota('http-404')), '接口地址错误')
check('瞬时失败：network 值得重试', api.isTransientQuota(errQuota('network')), true)
check('瞬时失败：timeout 值得重试', api.isTransientQuota(errQuota('timeout')), true)
check('瞬时失败：503 值得重试', api.isTransientQuota(errQuota('http-503')), true)
check('确定性失败：401 不重试', api.isTransientQuota(errQuota('http-401')), false)
check('确定性失败：没配密钥不重试', api.isTransientQuota(errQuota('no-api-key')), false)
check('查成功的行不重试', api.isTransientQuota(opencodeGo), false)

console.log('\n【余额不足后缀】')
check('余额不足', api.balanceValue({ isAvailable: false, items: [{ currency: 'CNY', total: 0 }] }), '¥0.00（余额不足）')

// ---- 浮层余量区块的「结构」断言：用真实源码 + 最小 DOM 替身跑 balanceRows() ----
// 这段逻辑在 client.js 的「提供商徽章 + 悬浮信息浮层」region 里（不在上面的文案 region），
// 所以单独抽出来执行；只 stub document / QSettings，跑的是插件真实的渲染代码。
const hoverStart = src.indexOf('const row = (label, value) => {')
const hoverEnd = src.indexOf('// 余量区块的 DOM：balanceRows')
if (hoverStart < 0 || hoverEnd < 0) throw new Error('找不到 client.js 里的浮层 region 标记')
const blankDoc = { createElement: (tag) => ({ tagName: tag, style: {}, textContent: '', children: [], appendChild(c) { this.children.push(c); return c } }) }
const QSettingsStub = { showMore: true }
// eslint-disable-next-line no-new-func
const panel = new Function('tx', 'resolveLang', 'document', 'QSettings', 'UNKNOWN',
	region + '\n' + src.slice(hoverStart, hoverEnd) + '\nreturn { balanceRows };'
)(tx, resolveLang, blankDoc, QSettingsStub, '未提供')

/** 结构指纹：数字、以及倒计时的时长写法（3h0m / 9d0h）都归一，只比结构、列位与分隔符。 */
const shapeText = (s) => String(s)
	.replace(/\d+d\d+h|\d+h\d+m|\d+m/g, 'N<cd>')
	.replace(/\d+(\.\d+)?/g, 'N')
const panelShape = (b) => panel.balanceRows(b).map((el) => (el.style.display === 'grid'
	? el.children.map((c) => (c.style.gridColumn || 'auto') + ':' + shapeText(c.textContent)).join(' | ')
	: 'row ' + el.children.map((c) => shapeText(c.textContent)).join(' | ')))
/** 网格轨道数：`minmax(...)` 的个数 +1（模板里除了标签列都是 minmax）。 */
const trackCount = (el) => (String(el.style.gridTemplateColumns).match(/minmax\(/g) || []).length + 1

console.log('\n【浮层结构：两家厂商必须同一套规则（列位 / 分隔点 / 到期独立行）】')
const ogPanel = panel.balanceRows(opencodeGo), ccPanel = panel.balanceRows(commandCode)
check('og-01 与 cmd-01 的结构指纹一致', panelShape(commandCode).join(' // '), panelShape(opencodeGo).join(' // '))
check('窗口行＝四列（auto,2,3,4 重复三行）', ogPanel[0].children.map((c) => c.style.gridColumn || 'auto').join(','), 'auto,2,3,4,auto,2,3,4,auto,2,3,4')
check('展开态网格＝4 条轨道', trackCount(ogPanel[0]), 4)
check('比例列与金额列都以「 ·」结尾', ogPanel[0].children.filter((c) => c.style.gridColumn === '2' || c.style.gridColumn === '3').every((c) => / ·$/.test(c.textContent)), true)
check('尾列不带前导点（点挂在前一段末尾）', ogPanel[0].children.filter((c) => c.style.gridColumn === '4').every((c) => !/^· /.test(c.textContent)), true)
check('「到期」行不在网格里（独立普通行）', ogPanel.length === 2 && ogPanel[1].style.display !== 'grid' && ogPanel[1].children[0].textContent === '到期', true)
QSettingsStub.showMore = false
// 收起态：窗口行只有「标签 | 比例」两个格子 —— 网格轨道数也跟着从 4 降到 2。
// 若这时还留着空着的金额/尾列，两个 columnGap（10px×2）会把比例顶得离右边缘差 20px，
// 与下面「到期」和上面「提供商 / 当前模型」各行的值对不齐（用户截图里的那处不齐）。
const ogCompact = panel.balanceRows(opencodeGo)[0]
check('关掉「显示更多信息」：窗口行只剩比例、且不带尾点', panelShape(opencodeGo)[0], 'auto:N小时 | 2 / -1:N% | auto:周 | 2 / -1:N% | auto:月 | 2 / -1:N%')
check('关掉「显示更多信息」：网格只剩 2 条轨道（比例才贴得到右边缘）', trackCount(ogCompact), 2)
check('关掉「显示更多信息」：行里没有空格子（不给空列占位）', ogCompact.children.every((c) => c.textContent !== ''), true)
const idleWindow = { key: 'rolling', durationHours: 5, percent: 0, used: 0, total: 14, currency: 'USD', resetsAt: null, rateLimited: false }
const idleCmd = { supported: true, recognized: true, error: null, balance: null, period: null, windows: [idleWindow] }
check('没有重置时间（cmd 没开窗）：尾列给占位，不空着', api.windowColumns(idleWindow, { more: true, countdown: true }).tail, '—')
check('没有重置时间：一行文本也带占位', api.windowValue(idleWindow, { more: true, countdown: true }), '0.00% · $0.00/$14.00 · —')
QSettingsStub.showMore = true // 这条要看「更多信息=开」时的列结构
check('没有重置时间：浮层四列仍是齐的', panelShape(idleCmd)[0], 'auto:N小时 | 2:N% · | 3:$N/$N · | 4:—')
QSettingsStub.showMore = false
check('关掉「显示更多信息」时：不给占位（尾列本来就该空）', api.windowColumns(idleWindow, { more: false, countdown: true }).tail, '')
check('关掉「显示更多信息」：到期行仍在（只剩日期）', panelShape(opencodeGo)[1], 'row 到期 | N-N-N')
QSettingsStub.showMore = true

// ---- 悬停状态机的崩溃回归：relatedTarget 可能是非 Node ----
// 线上实测（用户浏览器控制台）：指针移出页面（浏览器 UI / DevTools / 另一个窗口）时，
// Chrome 会把原生 mouseout 的 relatedTarget 给成 window 这类非 Node，React 合成事件原样透传；
// 旧代码 `tip.contains(next)` 直接抛 TypeError，onLeave 被就地打断 → hovering 卡在 true、
// 收起定时器没装上 → 浮层不消失。这里同样抽**真实源码**跑，不复制实现。
const guardStart = src.indexOf('//#region 悬停事件的节点判定')
const guardEnd = src.indexOf('//#endregion', guardStart)
if (guardStart < 0 || guardEnd < 0) throw new Error('找不到 client.js 里的悬停节点判定 region')
const guardRegion = src.slice(guardStart, guardEnd)
const leaveStart = src.indexOf('const onEnter = () => {')
const leaveEnd = src.indexOf('// 滚动/尺寸变化', leaveStart)
if (leaveStart < 0 || leaveEnd < 0) throw new Error('找不到 client.js 里的 onEnter/onLeave')
const leaveSrc = src.slice(leaveStart, leaveEnd)

/** 用最小替身把 createTipController 里的 onEnter/onLeave 跑起来（真实源码注入）。 */
const mkHoverHarness = () => {
	const fakeSetTimeout = (fn, ms) => ({ fn, ms })
	const fakeClearTimeout = () => {}
	// eslint-disable-next-line no-new-func
	const ctl = new Function('setTimeout', 'clearTimeout', `
		let tip = null, hovering = false, showTimer = null, hideTimer = null, showSeq = 0, hidden = false;
		const showTip = () => {};
		const hideTip = () => { hidden = true; };
		const getAnchor = () => null;
		const seatAnchorMode = false;
		const SHOW_DELAY = 120, HIDE_DELAY = 100, LEAVE_GRACE = 120;
		${guardRegion}
		${leaveSrc}
		return {
			setTip: (t) => { tip = t; },
			onEnter, onLeave,
			state: () => ({ hovering, showSeq, hidden, hideMs: hideTimer ? hideTimer.ms : null }),
			fireHide: () => { if (hideTimer) hideTimer.fn(); }
		};
	`)(fakeSetTimeout, fakeClearTimeout)
	return ctl
}

console.log('\n【悬停状态机：relatedTarget 不是 Node 时不能把 onLeave 打断】')
// 逼真的 Node.contains 替身：真 Node 之外一律抛 TypeError —— 这正是浏览器里的行为。
// 替身若宽容（对什么都返回 false），这个回归就抓不到旧写法 `tip.contains(next)` 的崩溃。
const mkTipStub = () => {
	const inner = { nodeType: 1 }
	const tipEl = {
		nodeType: 1,
		contains: (n) => {
			if (!n || typeof n.nodeType !== 'number') throw new TypeError("Failed to execute 'contains' on 'Node': parameter 1 is not of type 'Node'.")
			return n === inner
		}
	}
	return { tipEl, inner }
}
{
	const { tipEl } = mkTipStub()
	const winLike = { nodeType: undefined, document: {}, addEventListener: () => {} } // window：不是 Node
	const ctl = mkHoverHarness()
	ctl.setTip(tipEl)
	ctl.onEnter()
	check('悬停中', ctl.state().hovering, true)
	let threw = null
	try { ctl.onLeave({ relatedTarget: winLike }) } catch (e) { threw = e.message }
	check('relatedTarget 是 window（非 Node）时不抛', threw, null)
	check('移出后 hovering 归位', ctl.state().hovering, false)
	check('移出后悬停代际自增（在途结果作废）', ctl.state().showSeq, 2)
	check('移出后装上收起定时器（HIDE_DELAY）', ctl.state().hideMs, 100)
	ctl.fireHide()
	check('定时器到点后浮层收起', ctl.state().hidden, true)
}
{
	const { tipEl, inner } = mkTipStub()
	const ctl = mkHoverHarness()
	ctl.setTip(tipEl)
	ctl.onEnter()
	ctl.onLeave({ relatedTarget: inner })
	check('挪进浮窗：代际不自增（面板继续显示）', ctl.state().showSeq, 1)
	check('挪进浮窗：照样挂收起定时器（到点按 hovering 决定）', ctl.state().hideMs, 100)
}
{
	const { tipEl } = mkTipStub()
	const ctl = mkHoverHarness()
	ctl.setTip(tipEl)
	ctl.onEnter()
	ctl.onLeave({ relatedTarget: null })
	check('relatedTarget 为 null 时正常收尾', ctl.state().hovering === false && ctl.state().showSeq === 2, true)
	ctl.onEnter()
	let threw2 = null
	try { ctl.onLeave(undefined) } catch (e) { threw2 = e.message }
	check('连事件对象都没有时也不抛', threw2, null)
}
const bareContains = src.split('\n')
	.map((text, i) => ({ text, n: i + 1 }))
	.filter(({ text }) => !/^\s*\/\//.test(text) && /\.contains\(/.test(text) && !/const containsNode = /.test(text))
	.map(({ n }) => n)
check('除 containsNode 内部外没有裸的 .contains(（否则又会把非 Node 传进去）', bareContains.join(','), '')

console.log('\n' + (failed ? failed + ' 项不符' : '全部符合预期'))
process.exit(failed ? 1 : 0)
