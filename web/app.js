/*! dsh-model-toolkit 独立设置页 · v2（B 端表格形态 + 增量保存）
 * 无框架、无外部资源、无内联脚本/样式；数据只走相对路径 ./api/state、./api/quota、./api/save。
 * 布局与视觉令牌见 _spec/webpage-v1.md §5.1 / §5.2（冻结）；写接口见 §7（只发增量）。
 * 单页滚动 + 左侧锚点导航 + 三个区块：模型能力（主表 19 行）/ 线路余量（表格）/ 插件偏好（设置项列表）。
 * 离线看样式：地址带 ?mock=1，或把 hash 设为 #mock（此模式下保存只在本页模拟，不请求后端）。
 */
(function () {
	'use strict'

	/* ================= 文案（按 key 组织，中英双语） ================= */
	var STRINGS = {
		zh: {
			'app.title': '模型工具箱',
			'state.loading': '正在加载线路与模型…',
			'nav.quota': '线路余量',
			'nav.capability': '模型能力',
			'nav.prefs': '插件偏好',
			'nav.label': '页面分区',
			'nav.tip': '单页滚动 · 点击定位',
			'search.label': '搜索线路或模型',
			'search.placeholder': '搜索线路或模型…',
			'lang.label': '界面语言',
			'lang.zh': '中文',
			'lang.en': 'EN',
			'theme.label': '主题',
			'theme.light': '浅',
			'theme.dark': '深',
			'theme.system': '跟随',
			'toolbar.line': '线路筛选',
			'line.all': '全部线路',
			'list.onlyConfigured': '只看已配置',
			'list.onlyConfigured.title': '已配置 = 设过图片、思考等级或系统角色',
			'toolbar.batch': '批量',
			'toolbar.selected': '已勾选 {n} 行',
			'toolbar.pick': '请先勾选要操作的行',
			'batch.image': '图片全开',
			'batch.image.tip': '把勾选行的「图片输入」全部打开',
			'batch.reasoning': '补默认等级',
			'batch.reasoning.tip': '只给思考等级为空的勾选行补一个默认等级（off）',
			'batch.clear': '清空能力',
			'batch.clear.tip': '清空勾选行的图片输入与思考等级（不改线路级 system 角色）',
			'batch.done': '已更新 {n} 行',
			'batch.doneSkipped': '已更新 {n} 行，跳过 {m} 行（被筛选隐藏）',
			'batch.hiddenOnly': '勾选的行都被筛选隐藏了，请先调整筛选',
			'batch.hint': '勾选行后可批量操作',
			/* W3：撤销修改（草稿回到最近一次加载 / 保存的基线） */
			'undo': '撤销修改',
			'undo.tip': '把草稿恢复到最后一次加载 / 保存的基线（全部未保存改动都会丢失）',
			'undo.none': '没有未保存的改动，无需撤销',
			'undo.done': '已撤销未保存的改动',
			'save': '保存',
			'save.withCount': '保存 ({n})',
			'save.saving': '保存中…',
			'save.saved': '已保存',
			'save.mockSaved': '已保存（示例数据，未写入后端）',
			'save.failed': '保存失败',
			'save.conflict': '设置已被其它地方修改，请刷新页面后重试',
			'save.reload': '重新加载',
			'save.hint': '保存未保存的改动（只发增量）',
			'save.none': '没有未保存的改动',
			'notice.dismiss': '关闭',
			'status.line': '当前线路',
			'status.tightest': '余量最紧',
			'status.hint': '余量未查询',
			'status.view': '查看余量',
			'status.noData': '该线路没有余量数据',
			'status.used': '已用 {p}%',
			'status.balance': '余额 {v}',
			'status.resetIn': '重置还有',
			'status.resetAt': '重置于',
			'status.failed': '余量查询失败',
			'banner.mockTitle': '示例数据模式',
			'banner.mockBody': '地址带 ?mock=1：页面没有请求后端，保存只在本页模拟，不会写入设置。',
			'banner.warnTitle': '部分数据获取失败，已按空值展示',
			'err.loadTitle': '取数失败',
			'err.hint': '相对路径 ./api/state 没有返回可用数据。',
			'err.mockHint': '可改用 ?mock=1 查看示例数据。',
			'err.retry': '重试',
			'err.quotaTitle': '余量查询失败',
			'err.quotaHint': '出网查询失败或超时，可以重试。',
			'cap.subtitle': '一张平表 + 线路列。图片输入、思考等级按模型保存；system 角色是线路级设置（改一行，同线路所有行同步）。勾选后可批量操作。',
			'cap.count': '{p} 条线路 · {m} 个模型',
			'cap.rows': '{n} 行',
			'cap.empty': '没有匹配的行',
			'cap.col.sel': '勾选',
			'cap.col.line': '线路',
			'cap.col.id': '模型 ID',
			'cap.col.name': '名称',
			'cap.col.image': '图片输入',
			'cap.col.reasoning': '思考等级',
			'cap.col.role': 'system 角色',
			'cap.selectAll': '全选当前筛选结果',
			'cap.image.tip': '该模型的图片输入能力（input 里有没有 image）',
			'cap.chip.tip': '点击切换该思考等级（保存时重建 reasoningEfforts）',
			'cap.wire.tip': '该等级发给上游的真实值（wire）；留空 = 用默认值',
			'cap.wire.ph': '默认',
			'cap.chip.more': '+ 更多',
			'cap.chip.less': '收起',
			/* W1：继承自…（目录条目 → 复制图片 + reasoningEfforts，不复制 compat） */
			'cap.inherit': '继承自…',
			'cap.inherit.tip': '从目录条目继承图片输入与思考等级（含 wire 值），不复制 compat',
			'inherit.title': '继承自…',
			'inherit.subtitle': '从目录里挑一个条目：把它的「图片输入」和「思考等级（含 wire 值）」复制到这一行。compat 不复制。',
			'inherit.target': '目标行',
			'inherit.search': '搜索目录条目',
			'inherit.search.placeholder': '搜索模型 ID / 名称 / 线路…',
			'inherit.loading': '正在读取目录…',
			'inherit.empty': '没有匹配的目录条目',
			'inherit.error': '目录读取失败',
			'inherit.retry': '重试',
			'inherit.close': '关闭',
			'inherit.done': '已继承（不含 compat）',
			'inherit.item.image': '图片',
			'inherit.item.none': '无等级',
			/* W2：wire 值可编辑 */
			'cap.wire.tip': '该等级的 wire 值，保存时写进 reasoningEfforts；留空 = 默认（等级名）',
			'cap.wire.label': '{lv} 的 wire 值',
			'cap.wire.placeholder': '默认',
			/* W4：compat 标记 */
			'cap.compat.tip': 'compat.thinkingFormat 标记（只读；继承不会覆盖 compat）',
			'cap.reasoning.none': '未设置',
			'cap.role.tip': '线路级设置（compat.supportsDeveloperRole）：改动同步整条线路',
			/* §9.2 P0-1：该线路协议集合里没有任何 OpenAI 兼容协议 → 写下去会被设置校验拒绝 */
			'cap.role.unsupported': '该线路协议不支持此开关，写下去会被设置校验拒绝',
			'value.on': '开',
			'value.off': '关',
			'value.none': '未设置',
			'role.auto': '自动',
			'role.system': '强制 system',
			'role.developer': '强制 developer',
			'role.raw': '{v}（未知取值）',
			'quota.subtitle': '页面加载时查询一次（走服务端缓存）；点「全部刷新」绕过缓存重新出网查询（可能慢几秒）',
			'quota.loading': '正在查询余量…（出网查询，可能需要几秒）',
			'quota.empty': '没有可查询的线路。',
			'quota.refreshAll': '全部刷新',
			'quota.refreshing': '刷新中…',
			'quota.refresh.tip': '绕过缓存，重新查询全部线路的余量',
			/* W6：行内刷新（只刷这一条线路） */
			'quota.row.refresh': '刷新',
			'quota.row.refreshing': '刷新中…',
			'quota.row.tip': '只刷新这一条线路（?provider=<id>&force=1，绕过缓存）',
			/* W7：未识别行默认隐藏 */
			'quota.more.show': '展开全部（{n}）',
			'quota.more.hide': '收起',
			'quota.more.tip': '未识别 / 不支持的线路默认隐藏，展开后可见',
			/* W8：动态窗口列（列头 = 窗口 · 5 小时 / 周 / 月 / N 天） */
			'quota.col.winPrefix': '窗口',
			'quota.win.days': '{d} 天',
			/* W11：余额不足标记 */
			'quota.balance.low': '（余额不足）',
			'quota.balance.multi': '多币种按币种字母序',
			'quota.col.provider': '线路',
			'quota.col.type': '类型',
			'quota.col.balance': '余额',
			'quota.col.usage': '已用 · 总额',
			'quota.col.window': '窗口',
			'quota.col.reset': '重置',
			'quota.type.plan': '套餐窗口',
			'quota.type.balance': '账户余额',
			'quota.type.unsupported': '不支持',
			'quota.type.unknown': '未知',
			'quota.win.rolling': '5 小时',
			'quota.win.weekly': '周',
			'quota.win.monthly': '月',
			'quota.win.hours': '{h} 小时',
			'quota.reset.none': '不重置',
			'quota.reset.now': '即将重置',
			'quota.reset.after': '{v}后',
			'quota.reset.at': '{v}',
			'quota.period': '到期',
			'quota.periodDays': '还有 {d} 天',
			'quota.rateLimited': '已达上限',
			'quota.unavailable': '不可用',
			'quota.noData': '无数据',
			'quota.err.unsupported': '该线路没有公开的余量查询接口',
			'quota.err.noKey': '没有配置密钥环境变量，无法查询',
			'dur.day': '{d} 天',
			'dur.hour': '{h} 小时',
			'dur.min': '{m} 分',
			'pref.hint': '在右侧控件上直接改；改动后点右上角「保存」写入插件配置。',
			'pref.group.features': '功能开关',
			'pref.group.ui': '界面与刷新',
			'pref.badgeAndQuota': '启用提供商徽章与余量',
			'pref.badgeAndQuota.desc': '悬浮面板里显示线路徽章与余量。',
			/* W9：生效提示 */
			'pref.badgeAndQuota.apply': '改动后需刷新 DSH 页面生效',
			'pref.autoRefreshMin.off': '先打开「定时刷新」才能改间隔',
			'pref.hoverRefresh': '悬浮窗自动刷新',
			'pref.hoverRefresh.desc': '鼠标悬停在徽章上时刷新余量。',
			'pref.autoRefreshOn': '定时刷新',
			'pref.autoRefreshOn.desc': '按固定间隔自动刷新余量。',
			'pref.autoRefreshMin': '定时刷新间隔',
			'pref.autoRefreshMin.desc': '取值范围 1–1440。',
			'pref.showMore': '显示更多信息',
			'pref.showMore.desc': '余量里多显示一层细节（剩余天数、金额明细）。',
			'pref.fontSize': '字体大小',
			'pref.fontSize.desc': '插件自身的界面字号。',
			'pref.language': '界面语言',
			'pref.language.desc': '插件自身的界面语言，与页面右上角的语言切换各自独立。',
			'pref.minUnit': '分钟',
			'pref.fontSize.small': '小',
			'pref.fontSize.middle': '中',
			'pref.fontSize.large': '大',
			'pref.lang.system': '跟随系统',
			'pref.lang.zh': '中文',
			'pref.lang.en': 'English',
			'meta.generatedAt': '生成于',
			'meta.revision': '修订',
			'common.na': '—'
		},
		en: {
			'app.title': 'Model Toolkit',
			'state.loading': 'Loading providers and models…',
			'nav.quota': 'Quota',
			'nav.capability': 'Capabilities',
			'nav.prefs': 'Preferences',
			'nav.label': 'Page sections',
			'nav.tip': 'Single page · click to jump',
			'search.label': 'Search providers or models',
			'search.placeholder': 'Search provider or model…',
			'lang.label': 'Page language',
			'lang.zh': '中文',
			'lang.en': 'EN',
			'theme.label': 'Theme',
			'theme.light': 'Light',
			'theme.dark': 'Dark',
			'theme.system': 'Auto',
			'toolbar.line': 'Filter by line',
			'line.all': 'All lines',
			'list.onlyConfigured': 'Configured only',
			'list.onlyConfigured.title': 'Configured = image, reasoning levels or system role is set',
			'toolbar.batch': 'Batch',
			'toolbar.selected': '{n} rows selected',
			'toolbar.pick': 'Select rows first',
			'batch.image': 'Images on',
			'batch.image.tip': 'Turn image input on for the selected rows',
			'batch.reasoning': 'Fill default levels',
			'batch.reasoning.tip': 'Only fills rows whose reasoning list is empty (default: off)',
			'batch.clear': 'Clear capabilities',
			'batch.clear.tip': 'Clears image input and reasoning levels of the selected rows (the line-level system role is untouched)',
			'batch.done': 'Updated {n} rows',
			'batch.doneSkipped': 'Updated {n} rows; skipped {m} hidden by the filter',
			'batch.hiddenOnly': 'All selected rows are hidden by the current filter. Adjust the filter first.',
			'batch.hint': 'Select rows to enable batch actions',
			'undo': 'Discard changes',
			'undo.tip': 'Restore the draft to the last loaded / saved baseline (all unsaved changes are lost)',
			'undo.none': 'No unsaved changes to discard',
			'undo.done': 'Unsaved changes discarded',
			'save': 'Save',
			'save.withCount': 'Save ({n})',
			'save.saving': 'Saving…',
			'save.saved': 'Saved',
			'save.mockSaved': 'Saved (sample data, nothing written to the backend)',
			'save.failed': 'Save failed',
			'save.conflict': 'These settings were changed elsewhere. Refresh the page and try again.',
			'save.reload': 'Reload',
			'save.hint': 'Save unsaved changes (incremental only)',
			'save.none': 'No unsaved changes',
			'notice.dismiss': 'Dismiss',
			'status.line': 'Current line',
			'status.tightest': 'Tightest quota',
			'status.hint': 'Quota not queried yet',
			'status.view': 'View quota',
			'status.noData': 'No quota data for this line',
			'status.used': 'used {p}%',
			'status.balance': 'balance {v}',
			'status.resetIn': 'resets in',
			'status.resetAt': 'resets at',
			'status.failed': 'quota query failed',
			'banner.mockTitle': 'Sample data mode',
			'banner.mockBody': 'URL contains ?mock=1: the backend was not queried and saving is simulated locally only.',
			'banner.warnTitle': 'Some data failed to load and is shown empty',
			'err.loadTitle': 'Failed to load data',
			'err.hint': 'The relative path ./api/state did not return usable data.',
			'err.mockHint': 'You can add ?mock=1 to see sample data.',
			'err.retry': 'Retry',
			'err.quotaTitle': 'Quota query failed',
			'err.quotaHint': 'The network query failed or timed out; you can retry.',
			'cap.subtitle': 'One flat table with a line column. Image input and reasoning levels are saved per model; the system role is line-level (edit one row, every row of that line follows). Select rows to batch-edit.',
			'cap.count': '{p} providers · {m} models',
			'cap.rows': '{n} rows',
			'cap.empty': 'No matching row',
			'cap.col.sel': 'Select',
			'cap.col.line': 'Line',
			'cap.col.id': 'Model ID',
			'cap.col.name': 'Name',
			'cap.col.image': 'Image input',
			'cap.col.reasoning': 'Reasoning levels',
			'cap.col.role': 'system role',
			'cap.selectAll': 'Select all filtered rows',
			'cap.image.tip': 'Image input capability of this model (whether input contains image)',
			'cap.chip.tip': 'Click to toggle this reasoning level (reasoningEfforts is rebuilt on save)',
			'cap.wire.tip': 'Wire value sent upstream for this level; empty = default',
			'cap.wire.ph': 'default',
			'cap.chip.more': '+ more',
			'cap.chip.less': 'less',
			'cap.inherit': 'Inherit from…',
			'cap.inherit.tip': 'Inherit image input and reasoning levels (incl. wire values) from a catalog entry; compat is not copied',
			'inherit.title': 'Inherit from…',
			'inherit.subtitle': 'Pick a catalog entry: its image input and reasoning levels (incl. wire values) are copied into this row. compat is not copied.',
			'inherit.target': 'Target row',
			'inherit.search': 'Search catalog',
			'inherit.search.placeholder': 'Search model ID / name / provider…',
			'inherit.loading': 'Loading catalog…',
			'inherit.empty': 'No matching catalog entry',
			'inherit.error': 'Failed to load the catalog',
			'inherit.retry': 'Retry',
			'inherit.close': 'Close',
			'inherit.done': 'Inherited (compat excluded)',
			'inherit.item.image': 'image',
			'inherit.item.none': 'no levels',
			'cap.wire.tip': 'Wire value of this level, written into reasoningEfforts on save; empty = default (the level name)',
			'cap.wire.label': 'wire value of {lv}',
			'cap.wire.placeholder': 'default',
			'cap.compat.tip': 'compat.thinkingFormat marker (read-only; inheriting never overrides compat)',
			'cap.reasoning.none': 'not set',
			'cap.role.tip': 'Line-level setting (compat.supportsDeveloperRole): applies to the whole line',
			'cap.role.unsupported': 'This line protocol does not support this switch; the settings validator would reject it',
			'value.on': 'on',
			'value.off': 'off',
			'value.none': 'not set',
			'role.auto': 'auto',
			'role.system': 'force system',
			'role.developer': 'force developer',
			'role.raw': '{v} (unknown value)',
			'quota.subtitle': 'Queried once on load (server cache); "Refresh all" bypasses the cache and re-queries (may take seconds)',
			'quota.loading': 'Querying quota… (network query, may take a few seconds)',
			'quota.empty': 'No provider to query.',
			'quota.refreshAll': 'Refresh all',
			'quota.refreshing': 'Refreshing…',
			'quota.refresh.tip': 'Bypass the cache and re-query quota for every provider',
			'quota.row.refresh': 'Refresh',
			'quota.row.refreshing': 'Refreshing…',
			'quota.row.tip': 'Refresh only this provider (?provider=<id>&force=1, bypassing the cache)',
			'quota.more.show': 'Show all ({n})',
			'quota.more.hide': 'Collapse',
			'quota.more.tip': 'Unrecognized / unsupported providers are hidden by default; expand to show them',
			'quota.col.winPrefix': 'Window',
			'quota.win.days': '{d}d',
			'quota.balance.low': ' (low balance)',
			'quota.balance.multi': 'Multiple currencies sorted alphabetically',
			'quota.col.provider': 'Line',
			'quota.col.type': 'Type',
			'quota.col.balance': 'Balance',
			'quota.col.usage': 'Used · total',
			'quota.col.window': 'Window',
			'quota.col.reset': 'Resets',
			'quota.type.plan': 'plan windows',
			'quota.type.balance': 'account balance',
			'quota.type.unsupported': 'unsupported',
			'quota.type.unknown': 'unknown',
			'quota.win.rolling': '5 hours',
			'quota.win.weekly': 'week',
			'quota.win.monthly': 'month',
			'quota.win.hours': '{h} hours',
			'quota.reset.none': 'no reset',
			'quota.reset.now': 'resetting now',
			'quota.reset.after': 'in {v}',
			'quota.reset.at': '{v}',
			'quota.period': 'period',
			'quota.periodDays': '{d} days left',
			'quota.rateLimited': 'rate limited',
			'quota.unavailable': 'unavailable',
			'quota.noData': 'no data',
			'quota.err.unsupported': 'This provider has no public quota endpoint',
			'quota.err.noKey': 'No API key env var configured, cannot query',
			'dur.day': '{d}d',
			'dur.hour': '{h}h',
			'dur.min': '{m}m',
			'pref.hint': 'Edit the controls on the right; then click Save in the top right to write the plugin config.',
			'pref.group.features': 'Feature switches',
			'pref.group.ui': 'Interface and refresh',
			'pref.badgeAndQuota': 'Enable provider badges and quota',
			'pref.badgeAndQuota.desc': 'Show line badges and quota in the hover panel.',
			'pref.badgeAndQuota.apply': 'Takes effect after refreshing the DSH page',
			'pref.autoRefreshMin.off': 'Turn on “Scheduled refresh” before editing the interval',
			'pref.hoverRefresh': 'Refresh on hover',
			'pref.hoverRefresh.desc': 'Refresh quota when hovering a badge.',
			'pref.autoRefreshOn': 'Scheduled refresh',
			'pref.autoRefreshOn.desc': 'Refresh quota automatically at a fixed interval.',
			'pref.autoRefreshMin': 'Refresh interval',
			'pref.autoRefreshMin.desc': 'Range 1–1440.',
			'pref.showMore': 'Show more information',
			'pref.showMore.desc': 'Show extra detail in quota (days left, amount breakdown).',
			'pref.fontSize': 'Font size',
			'pref.fontSize.desc': 'The plugin own interface font size.',
			'pref.language': 'Interface language',
			'pref.language.desc': 'The plugin own UI language; independent from the page language switch above.',
			'pref.minUnit': 'minutes',
			'pref.fontSize.small': 'Small',
			'pref.fontSize.middle': 'Medium',
			'pref.fontSize.large': 'Large',
			'pref.lang.system': 'Follow system',
			'pref.lang.zh': '中文',
			'pref.lang.en': 'English',
			'meta.generatedAt': 'generated at',
			'meta.revision': 'revision',
			'common.na': '—'
		}
	}

	/* ================= 示例数据（?mock=1 / #mock） =================
	 * 形如真实数据的提供商与模型 id（19 个模型 / 5 条线路余量，与真机行数一致）。
	 * baseURL 这里只写主机名（不带协议），这样页面里不会出现任何外部地址字面量；
	 * 真实数据由 ./api/state 提供。此模式下保存只在本页模拟，不请求后端。
	 */
	var MOCK_STATE = {
		ok: true,
		generatedAt: '2026-10-16T08:40:00.000Z',
		revision: 12,
		warnings: ['providers.zhipu.compat 缺失，已按目录默认值展示'],
		providers: [
			{
				id: 'deepseek', displayName: 'DeepSeek', baseURL: 'api.deepseek.com', apiKeyEnv: 'DEEPSEEK_API_KEY',
				/* §9.2 P0-1：apis 覆盖三种分支，便于离线自查置灰逻辑：
				 * deepseek=支持 / opencode-go=不支持 / moonshot=字段缺失 / zhipu=空数组 /
				 * bailian=多个协议其中一个是支持的 / mimo=不支持。 */
				apis: ['openai-completions'],
				models: [
					{ id: 'deepseek-v4.1-flash', name: 'deepseek-v4.1-flash', image: false, reasoning: ['off', 'low', 'high', 'max'], devRole: 'auto' },
					{ id: 'deepseek-v4.1-flash-fast', name: 'deepseek-v4.1-flash-fast', image: false, reasoning: ['off', 'low'], devRole: 'auto' },
					{ id: 'deepseek-v4.1-pro', name: 'DeepSeek V4.1 Pro', image: true, reasoning: ['off', 'high', 'max'], devRole: 'developer' },
					{ id: 'deepseek-reasoner', name: 'deepseek-reasoner', image: false, reasoning: ['off', 'high'], devRole: 'auto' }
				]
			},
			{
				id: 'opencode-go', displayName: 'OpenCode Go', baseURL: 'opencode.ai/zen/v1', apiKeyEnv: 'OPENCODE_GO_API_KEY',
				apis: ['anthropic-messages'],
				models: [
					{ id: 'opencode-go/kimi-k2-0905', name: 'Kimi K2 0905', image: false, reasoning: ['off'], devRole: 'system' },
					{ id: 'opencode-go/glm-4.6', name: 'GLM-4.6', image: true, reasoning: ['off', 'high'], devRole: 'system' },
					{ id: 'opencode-go/qwen3-coder-plus', name: 'Qwen3 Coder Plus', image: false, reasoning: [], devRole: 'system' }
				]
			},
			{
				id: 'moonshot', displayName: 'Moonshot 月之暗面', baseURL: 'api.moonshot.cn/v1', apiKeyEnv: 'MOONSHOT_API_KEY',
				/* 故意不写 apis：验证「缺失 → 视为允许」的向后兼容兜底 */
				models: [
					{ id: 'kimi-k2-turbo-preview', name: 'kimi-k2-turbo-preview', image: false, reasoning: ['off'], devRole: 'auto' },
					{ id: 'kimi-vl-a3b-thinking', name: 'kimi-vl-a3b-thinking', image: true, reasoning: ['off', 'high'], devRole: 'auto' },
					{ id: 'kimi-k3', name: 'Kimi K3', image: true, reasoning: ['low', 'medium', 'high', 'xhigh', 'max'], devRole: 'auto' }
				]
			},
			{
				id: 'zhipu', displayName: '智谱 GLM (Zhipu)', baseURL: 'open.bigmodel.cn/api/paas/v4', apiKeyEnv: 'ZHIPU_API_KEY',
				apis: [],
				models: [
					{ id: 'glm-4.6', name: 'GLM-4.6', image: true, reasoning: ['off', 'high', 'max'], devRole: 'auto' },
					{ id: 'glm-4.5-air', name: 'GLM-4.5-Air', image: false, reasoning: ['off'], devRole: 'auto' },
					{ id: 'glm-4.5', name: 'GLM-4.5', image: false, reasoning: [], devRole: 'auto' }
				]
			},
			{
				id: 'bailian', displayName: '阿里云百炼 (DashScope)', baseURL: 'dashscope.aliyuncs.com/compatible-mode/v1', apiKeyEnv: 'DASHSCOPE_API_KEY',
				apis: ['anthropic-messages', 'openai-responses'],
				models: [
					{ id: 'qwen3-max', name: 'qwen3-max', image: false, reasoning: ['off', 'high'], devRole: 'auto' },
					{ id: 'qwen3-vl-plus', name: 'qwen3-vl-plus', image: true, reasoning: ['off'], devRole: 'auto' },
					{ id: 'qwen3-coder-plus', name: 'qwen3-coder-plus', image: false, reasoning: [], devRole: 'auto' }
				]
			},
			{
				id: 'mimo', displayName: '小米 MiMo', baseURL: 'api.mimo.xiaomi.com/v1', apiKeyEnv: 'MIMO_API_KEY',
				apis: ['google-generative-ai'],
				models: [
					{ id: 'mimo-7b-rl', name: 'MiMo-7B-RL', image: false, reasoning: ['off', 'high'], devRole: 'auto' },
					{ id: 'mimo-vl-7b-rl', name: 'MiMo-VL-7B-RL', image: true, reasoning: ['off'], devRole: 'auto' },
					{ id: 'mimo-9b-rl', name: 'MiMo-9B-RL', image: false, reasoning: [], devRole: 'auto' }
				]
			}
		],
		prefs: {
			capabilityEditor: true,
			badgeAndQuota: true,
			hoverRefresh: false,
			autoRefreshOn: false,
			autoRefreshMin: 15,
			showMore: false,
			fontSize: 'middle',
			language: 'system'
		}
	}

	var MOCK_QUOTA = {
		ok: true,
		items: [
			{
				provider: 'deepseek', displayName: 'DeepSeek', supported: true, recognized: true, family: 'deepseek', error: null,
				balance: { isAvailable: true, items: [{ currency: 'CNY', total: 128.42 }] },
				/* 两个不同 durationHours：验证 W8 动态窗口列（5 小时 + 1 天） */
				windows: [
					{ key: 'rolling', durationHours: 5, percent: 18.5, used: 2.22, total: 12, currency: 'CNY', resetsAt: '2026-10-16T12:05:00.000Z', rateLimited: false },
					{ key: 'daily', durationHours: 24, percent: 55.5, used: 5.55, total: 10, currency: 'CNY', resetsAt: '2026-10-17T00:00:00.000Z', rateLimited: false }
				],
				period: null
			},
			{
				provider: 'opencode-go', displayName: 'OpenCode Go', supported: true, recognized: true, family: 'opencode-go', error: null,
				balance: null,
				windows: [
					{ key: 'rolling', durationHours: 5, percent: 18.5, used: 2.22, total: 12, currency: 'USD', resetsAt: '2026-10-16T12:05:00.000Z', rateLimited: false },
					{ key: 'weekly', durationHours: 168, percent: 64.2, used: 19.26, total: 30, currency: 'USD', resetsAt: '2026-10-19T00:00:00.000Z', rateLimited: false },
					{ key: 'monthly', durationHours: 720, percent: 93.7, used: 56.22, total: 60, currency: 'USD', resetsAt: '2026-11-08T00:00:00.000Z', rateLimited: false }
				],
				period: { end: '2026-11-08T00:00:00.000Z', daysLeft: 23 }
			},
			{
				/* W11：多币种故意逆序给出（USD 在前），页面应按币种字母序（CNY → USD） */
				provider: 'moonshot', displayName: 'Moonshot 月之暗面', supported: true, recognized: true, family: 'moonshot', error: null,
				/* W11 用例：多币种（故意乱序）+ 其中一个为 0 → 触发「余额不足」 */
				balance: { isAvailable: true, items: [{ currency: 'USD', total: 5.2 }, { currency: 'JPY', total: 0 }, { currency: 'CNY', total: 41.6 }] },
				windows: [],
				period: null
			},
			{
				/* W11：isAvailable=false → 「不可用」；余额 0 → 「（余额不足）」 */
				provider: 'bailian', displayName: '阿里云百炼 (DashScope)', supported: true, recognized: true, family: 'dashscope', error: null,
				balance: { isAvailable: false, items: [{ currency: 'CNY', total: 0 }] },
				windows: [], period: null
			},
			{
				/* W7：未识别（supported=false && recognized=false）→ 默认隐藏，点「展开全部」才出现 */
				provider: 'zhipu', displayName: '智谱 GLM (Zhipu)', supported: false, recognized: false, family: null,
				error: '该线路没有公开的余量查询接口', balance: null, windows: [], period: null
			},
			{
				provider: 'mimo', displayName: '小米 MiMo', supported: false, recognized: false, family: null,
				error: null, balance: null, windows: [], period: null
			}
		],
		warnings: ['mimo：查询超时（5 秒），已按失败处理']
	}

	/* 给示例数据补齐 §10.1 的新字段（真实数据由 ./api/state 提供）：
	 * reasoningEfforts = 缺省由 reasoning 键推导（off → null，其余 → 键名）；
	 * compatTag 只给几个模型，便于离线看 W4 的 compat 徽标。 */
	var MOCK_COMPAT = {
		'deepseek|deepseek-v4.1-pro': 'anthropic',
		'opencode-go|glm-4.6': 'openai',
		'moonshot|kimi-k3': 'google',
		'bailian|qwen3-max': 'openai'
	}

	;(function seedMockEfforts() {
		;(MOCK_STATE.providers || []).forEach(function (p) {
			;(p.models || []).forEach(function (m) {
				var eff = {}
				;(m.reasoning || []).forEach(function (lv) {
					eff[lv] = lv === 'off' ? null : lv
				})
				m.reasoningEfforts = eff
				m.compatTag = MOCK_COMPAT[p.id + '|' + m.id] || null
			})
		})
	})()

	/* 「继承自…」目录的示例数据（?mock=1）：按线路分组、等级与图片组合各不相同，
	 * 便于离线看到「选中后图片开关与等级一起变、compat 不变」。 */
	var MOCK_CATALOG = {
		ok: true,
		models: [
			{ provider: 'pi-ai', model: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', image: true, reasoningEfforts: { off: null, low: 'low', medium: 'medium', high: 'high', max: 'max' } },
			{ provider: 'pi-ai', model: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6', image: true, reasoningEfforts: { off: null, high: 'high', max: 'max' } },
			{ provider: 'pi-ai', model: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol', image: false, reasoningEfforts: { off: null, minimal: 'minimal', low: 'low', high: 'high' } },
			{ provider: 'pi-ai-cn', model: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', image: false, reasoningEfforts: { off: null, low: 'low', high: 'high', max: 'max' } },
			{ provider: 'pi-ai-cn', model: 'moonshotai/kimi-k3', name: 'Kimi K3', image: true, reasoningEfforts: { off: null, high: 'high', xhigh: 'xhigh' } },
			{ provider: 'pi-ai-eu', model: 'mistral/magistral-medium', name: 'Magistral Medium', image: false, reasoningEfforts: { off: null, high: 'reasoning' } }
		]
	}


	/* ================= 常量 / 状态 ================= */
	var LS_LANG = 'dsh-model-toolkit.page.lang'
	var LS_THEME = 'dsh-model-toolkit.page.theme'

	/* 思考等级全集（冻结顺序）：off / minimal / low / medium / high / max / xhigh。
	 * 每行默认只显示该模型「有」的等级（state 里的 reasoning ∪ 本次勾上的），
	 * 点「+ 更多」才展开全集。 */
	var LEVEL_ORDER = ['off', 'minimal', 'low', 'medium', 'high', 'max', 'xhigh']

	/* 侧栏导航图标：24×24 视框、线描、stroke=currentColor（跟随选中态变色）。
	 * 只在这里用 createElementNS 现建 SVG 元素；不引图标字体、不引外部文件、不用 Emoji。 */
	var SVG_NS = 'http://www.w3.org/2000/svg'
	var NAV_ICONS = {
		/* 能力 ≈ 滑块 */
		capability: [
			['path', { d: 'M4 8h9' }],
			['circle', { cx: '15.5', cy: '8', r: '2.5' }],
			['path', { d: 'M18 8h2' }],
			['path', { d: 'M4 16h2' }],
			['circle', { cx: '8.5', cy: '16', r: '2.5' }],
			['path', { d: 'M11 16h9' }]
		],
		/* 余量 ≈ 仪表 */
		quota: [
			['path', { d: 'M3.5 18a8.5 8.5 0 1 1 17 0' }],
			['path', { d: 'M12 18l4-6' }],
			['path', { d: 'M12 8.6v2' }],
			['path', { d: 'M7 11.2l1.4 1.4' }],
			['path', { d: 'M17 11.2l-1.4 1.4' }]
		],
		/* 偏好 ≈ 齿轮 */
		prefs: [
			['circle', { cx: '12', cy: '12', r: '3' }],
			['path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' }]
		]
	}

	function svgIcon(kind) {
		var svg = document.createElementNS(SVG_NS, 'svg')
		svg.setAttribute('class', 'nav-icon')
		svg.setAttribute('viewBox', '0 0 24 24')
		svg.setAttribute('width', '24')
		svg.setAttribute('height', '24')
		svg.setAttribute('fill', 'none')
		svg.setAttribute('stroke', 'currentColor')
		svg.setAttribute('stroke-width', '1.5')
		svg.setAttribute('stroke-linecap', 'round')
		svg.setAttribute('stroke-linejoin', 'round')
		svg.setAttribute('aria-hidden', 'true')
		svg.setAttribute('focusable', 'false')
		var spec = NAV_ICONS[kind] || []
		for (var i = 0; i < spec.length; i++) {
			var node = document.createElementNS(SVG_NS, spec[i][0])
			var attrs = spec[i][1]
			for (var k in attrs) {
				if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k])
			}
			svg.appendChild(node)
		}
		return svg
	}

	var isMock = /(^|[?&])mock=1(&|$)/.test(location.search) || location.hash === '#mock'

	/* 页面可能以 /dsh-model-toolkit 或 /dsh-model-toolkit/ 打开（契约里两条路由都要能用）。
	 * 带尾斜杠时浏览器自己就能把 './api/state' 解析对；不带尾斜杠时，浏览器会把相对路径
	 * 解析到站点根，所以这里按 location.pathname 现算一次目录，再把同一个相对路径拼上去。
	 * 源码里不出现域名、端口或任何绝对路径字面量。 */
	function apiPath(rel) {
		var p = String(location.pathname || '/')
		var last = p.slice(p.lastIndexOf('/') + 1)
		var dir
		if (last && last.indexOf('.') >= 0) dir = p.slice(0, p.lastIndexOf('/') + 1)
		else dir = p.charAt(p.length - 1) === '/' ? p : p + '/'
		return dir + String(rel).replace(/^\.\//, '')
	}

	/* 单页滚动：没有「当前标签页」，只有「当前滚动到的区块」（state.active，用于锚点高亮）。
	 * 区块顺序 = 施工单的 1/2/3：模型能力（主表）→ 线路余量 → 插件偏好。 */
	var SECTIONS = [
		{ id: 'sec-capability', icon: 'capability', key: 'capability' },
		{ id: 'sec-quota', icon: 'quota', key: 'quota' },
		{ id: 'sec-prefs', icon: 'prefs', key: 'prefs' }
	]

	var state = {
		lang: 'zh',
		theme: 'system',
		active: 'sec-capability',
		search: '',
		lineFilter: '',
		onlyConfigured: false,
		sel: {},              /* 勾选行：'provider\u0000model' -> true */
		expanded: {},         /* 思考等级「+ 更多」展开：同上 key */
		stateStatus: 'loading',
		stateError: '',
		data: null,           /* 当前工作副本（可编辑） */
		baseline: null,       /* 服务器版本（用于算增量 / 脏标记） */
		warnings: [],
		quotaStatus: 'idle',
		quotaError: '',
		quotaData: null,
		quotaLoading: false,
		/* W7：未识别行默认隐藏；展开状态 */
		quotaShowAll: false,
		/* W6：行内刷新中的线路 id（'pid' -> true） */
		quotaRowLoading: {},
		/* W5：首轮瞬时失败只自动重试一次（防重入） */
		quotaRetried: false,
		quotaRetryTimer: 0,
		quotaRetryDone: false,
		/* W1：继承弹窗状态 { pid, mid, status, error, models, search } */
		inherit: null,
		inheritFocus: null,   /* 打开「继承自…」前的焦点元素，关闭后还回去 */
		/* W1：目录（继承自…）缓存与弹窗状态 */
		catalogStatus: 'idle',   /* idle | loading | ready | error */
		catalogModels: null,
		catalogError: '',
		inheritTarget: null,     /* {pid, mid} */
		inheritQuery: '',
		inheritBusy: false,
		saving: false,
		saveConflict: false,   /* 409 冲突后锁住保存，直到重新加载 */
		notice: null,         /* {kind:'ok'|'error'|'conflict', text, reload} */
		noticeTimer: 0
	}

	/* ================= 小工具 ================= */
	function readLS(key) {
		try {
			return window.localStorage ? window.localStorage.getItem(key) : null
		} catch (e) {
			return null
		}
	}

	function writeLS(key, val) {
		try {
			if (window.localStorage) window.localStorage.setItem(key, val)
		} catch (e) {
			/* 隐私模式等场景下忽略即可 */
		}
	}

	function t(key, vars) {
		var table = STRINGS[state.lang] || STRINGS.zh
		var s = table[key]
		if (s == null) s = STRINGS.zh[key]
		if (s == null) return key
		if (vars) {
			for (var k in vars) {
				if (Object.prototype.hasOwnProperty.call(vars, k)) {
					s = s.split('{' + k + '}').join(String(vars[k]))
				}
			}
		}
		return s
	}

	/* 建 DOM 的小助手：绝不使用 innerHTML，也绝不写内联 <style> 或 style="..." 属性
	 * （CSP：style-src 'self'；只有 <style> 元素和 style 属性会被挡，CSSOM 属性赋值不受限）。 */
	function h(tag, props) {
		var node = document.createElement(tag)
		var kids = Array.prototype.slice.call(arguments, 2)
		if (props) {
			for (var k in props) {
				if (!Object.prototype.hasOwnProperty.call(props, k)) continue
				var v = props[k]
				if (v == null || v === false) continue
				if (k === 'text') node.textContent = String(v)
				else if (k === 'class') node.className = String(v)
				else if (k.lastIndexOf('on', 0) === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v)
				else node.setAttribute(k, v === true ? '' : String(v))
			}
		}
		appendKids(node, kids)
		return node
	}

	function appendKids(node, kids) {
		for (var i = 0; i < kids.length; i++) {
			var kid = kids[i]
			if (kid == null || kid === false) continue
			if (Array.isArray(kid)) appendKids(node, kid)
			else if (typeof kid === 'object' && kid.nodeType) node.appendChild(kid)
			else node.appendChild(document.createTextNode(String(kid)))
		}
	}

	function clear(node) {
		while (node.firstChild) node.removeChild(node.firstChild)
	}

	/* 替换容器的全部子节点：接受单个节点、多个节点、或嵌套数组 */
	function setKids(node) {
		clear(node)
		appendKids(node, Array.prototype.slice.call(arguments, 1))
		return node
	}

	function byId(id) {
		return document.getElementById(id)
	}

	/* 深拷贝：只走 JSON（数据全是 JSON 形状），避免引用共享导致「基线」被改脏 */
	function clone(v) {
		try {
			return JSON.parse(JSON.stringify(v))
		} catch (e) {
			return null
		}
	}

	/* ================= 数字 / 时间格式 ================= */
	function fmtNum(v) {
		if (typeof v !== 'number' || v !== v) return null
		var s = Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2)
		return s.replace(/\.00$/, '')
	}

	function fmtPct(v) {
		if (typeof v !== 'number' || v !== v) return null
		return (Math.round(v * 10) / 10).toFixed(1) + '%'
	}

	function fmtDate(iso) {
		var ms = Date.parse(iso)
		if (ms !== ms) return String(iso || '')
		try {
			return new Date(ms).toLocaleString(state.lang === 'en' ? 'en-US' : 'zh-CN', {
				year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
			})
		} catch (e) {
			return new Date(ms).toISOString()
		}
	}

	/* 距重置时间：kind = none | now | soon | date */
	function durParts(iso) {
		if (typeof iso !== 'string' || !iso) return null
		var ms = Date.parse(iso)
		if (ms !== ms) return null
		var diff = ms - Date.now()
		if (diff <= 0) return { kind: 'now', bare: '', date: fmtDate(iso), ms: diff }
		var d = Math.floor(diff / 86400000)
		var hr = Math.floor((diff % 86400000) / 3600000)
		var mi = Math.floor((diff % 3600000) / 60000)
		var parts = []
		if (d >= 1) parts.push(t('dur.day', { d: d }))
		if (hr >= 1 && d < 7) parts.push(t('dur.hour', { h: hr }))
		if (!parts.length) parts.push(t('dur.min', { m: Math.max(1, mi) }))
		return {
			kind: d > 60 ? 'date' : 'soon',
			bare: parts.join(' '),
			date: fmtDate(iso),
			ms: diff
		}
	}

	function winLabel(w) {
		var hours = w && typeof w.durationHours === 'number' ? w.durationHours : null
		if (hours === 5) return t('quota.win.rolling')
		if (hours === 168) return t('quota.win.weekly')
		if (hours === 720) return t('quota.win.monthly')
		if (hours != null) return t('quota.win.hours', { h: hours })
		return (w && w.key) || t('common.na')
	}

	/* 单项失败的 error 可能是人话，也可能是 i18n key / 机器原因码 */
	function errText(raw) {
		if (!raw) return ''
		var s = String(raw)
		var known = {
			'quota-endpoint-unsupported': 'quota.err.unsupported',
			'unsupported': 'quota.err.unsupported',
			'missing-windows': 'quota.err.unsupported',
			'no-api-key': 'quota.err.noKey'
		}
		if (known[s] && STRINGS.zh[known[s]]) return t(known[s])
		return s
	}

	/* ================= 数据读取 ================= */
	function providers() {
		return (state.data && Array.isArray(state.data.providers)) ? state.data.providers : []
	}

	function findProvider(pid) {
		var list = providers()
		for (var i = 0; i < list.length; i++) {
			if (list[i] && list[i].id === pid) return list[i]
		}
		return null
	}

	function modelsOf(p) {
		return (p && Array.isArray(p.models)) ? p.models : []
	}

	function findModel(pid, mid) {
		var p = findProvider(pid)
		var list = modelsOf(p)
		for (var i = 0; i < list.length; i++) {
			if (list[i] && list[i].id === mid) return { p: p, m: list[i] }
		}
		return null
	}

	function rowKey(pid, mid) {
		return String(pid) + '\u0000' + String(mid)
	}

	/* 模型 / 线路的 devRole 取不到时按契约默认值 auto 处理 */
	function roleOf(m) {
		return (m && m.devRole) ? String(m.devRole) : 'auto'
	}

	/* system 角色是线路级设置：整条线路以第一个模型（或首个有值的模型）为准 */
	function roleOfProvider(p) {
		var ms = modelsOf(p)
		for (var i = 0; i < ms.length; i++) {
			if (ms[i] && ms[i].devRole) return String(ms[i].devRole)
		}
		return ms.length ? 'auto' : 'auto'
	}

	/* ---------- §9.2 P0-1：system 角色是否被该线路协议支持（与 DSH 设置面板同规则） ---------- */
	/* 只有这些协议认得 compat.supportsDeveloperRole，其它协议写下去会被设置校验拒绝 */
	var ROLE_SUPPORTED_APIS = [
		'openai-completions',
		'openai-responses',
		'azure-openai-responses',
		'openai-codex-responses'
	]

	/* providers[].apis：该线路的协议集合；取不到（字段缺失）或空数组都归一成 [] */
	function providerApis(p) {
		if (!p || !Array.isArray(p.apis)) return []
		var out = []
		for (var i = 0; i < p.apis.length; i++) {
			if (p.apis[i] == null) continue
			var s = String(p.apis[i])
			if (s) out.push(s)
		}
		return out
	}

	function roleAllowed(p) {
		var apis = providerApis(p)
		/* 兼容旧快照：apis 缺失或为空 → 视为允许（宁可多给一个开关，也不要整页变灰） */
		if (!apis.length) return true
		for (var i = 0; i < apis.length; i++) {
			if (ROLE_SUPPORTED_APIS.indexOf(apis[i]) >= 0) return true
		}
		return false
	}

	function baselineProvider(pid) {
		var list = (state.baseline && Array.isArray(state.baseline.providers)) ? state.baseline.providers : []
		for (var i = 0; i < list.length; i++) {
			if (list[i] && list[i].id === pid) return list[i]
		}
		return null
	}

	function baselineModel(pid, mid) {
		var ms = modelsOf(baselineProvider(pid))
		for (var i = 0; i < ms.length; i++) {
			if (ms[i] && ms[i].id === mid) return ms[i]
		}
		return null
	}

	function baselineRoleOfProvider(pid) {
		var ms = modelsOf(baselineProvider(pid))
		for (var i = 0; i < ms.length; i++) {
			if (ms[i] && ms[i].devRole) return String(ms[i].devRole)
		}
		return ms.length ? 'auto' : 'auto'
	}

	/* 已配置 = 设过图片 / 思考等级 / 系统角色 */
	function isConfigured(m) {
		if (!m) return false
		if (m.image === true) return true
		if (Array.isArray(m.reasoning) && m.reasoning.length > 0) return true
		return !!(m.devRole && m.devRole !== 'auto')
	}

	function hasImage(m) {
		return !!(m && m.image === true)
	}

	function reasoningLevels(m) {
		return (m && Array.isArray(m.reasoning)) ? m.reasoning.filter(function (x) { return x != null }) : []
	}

	/* 等级排序：按冻结全集顺序，未知等级放最后（保证增量对比稳定） */
	function sortLevels(arr) {
		return arr.slice().sort(function (a, b) {
			var ia = LEVEL_ORDER.indexOf(String(a))
			var ib = LEVEL_ORDER.indexOf(String(b))
			if (ia < 0) ia = LEVEL_ORDER.length
			if (ib < 0) ib = LEVEL_ORDER.length
			return ia - ib
		}).map(function (x) { return String(x) })
	}

	function sameLevels(a, b) {
		var x = sortLevels(Array.isArray(a) ? a : [])
		var y = sortLevels(Array.isArray(b) ? b : [])
		if (x.length !== y.length) return false
		for (var i = 0; i < x.length; i++) {
			if (x[i] !== y[i]) return false
		}
		return true
	}

	/* ---------- §10.1 H2/H3：reasoningEfforts（等级 → wire）与 compat 标记 ---------- */
	/* 每个模型的可选新字段：
	 *   reasoning        string[]             等级键数组（旧形状，一直保留）
	 *   reasoningEfforts { level: wire|null } 等级 → wire（新形状，保存时优先）
	 *   compatTag        string|null          compat.thinkingFormat（只读展示）
	 * 字段缺失时优雅降级：缺 reasoningEfforts → 用 reasoning 键推导默认映射
	 * （off → null，其余 → 键名本身）；缺 compatTag → 不显示徽标。 */
	function isPlainObj(v) {
		return !!v && typeof v === 'object' && !Array.isArray(v)
	}

	function defaultWire(lv) {
		return String(lv) === 'off' ? null : String(lv)
	}

	/* wire 值统一成 string(≤64) | null；空串按 null（= 默认）处理 */
	function normWire(v) {
		if (v == null) return null
		var s = String(v)
		if (!s) return null
		return s.length > 64 ? s.slice(0, 64) : s
	}

	/* 取（必要时就地补齐）某个模型的 wire 映射 */
	function effortMapOf(m) {
		if (!m) return {}
		if (!isPlainObj(m.reasoningEfforts)) {
			var out = {}
			reasoningLevels(m).forEach(function (lv) { out[lv] = defaultWire(lv) })
			m.reasoningEfforts = out
		}
		return m.reasoningEfforts
	}

	function wireOf(m, lv) {
		var key = String(lv)
		var map = effortMapOf(m)
		if (Object.prototype.hasOwnProperty.call(map, key)) return normWire(map[key])
		return defaultWire(key)
	}

	/* 草稿改写某个等级的 wire（输入框留空 → null = 用默认值） */
	function setWire(m, lv, raw) {
		var key = String(lv)
		var map = effortMapOf(m)
		map[key] = key === 'off' ? null : normWire(raw)
	}

	/* 提交形状：按当前等级顺序的完整映射，off 强制 null（H3 校验要求） */
	function buildEfforts(m) {
		var out = {}
		sortLevels(reasoningLevels(m)).forEach(function (lv) {
			out[lv] = lv === 'off' ? null : wireOf(m, lv)
		})
		return out
	}

	/* 加载时把两种形状对齐：映射非空则以映射为准（H3：reasoningEfforts 优先），
	 * 映射缺失/为空则按 reasoning 键推导默认值。 */
	function normalizeModelEfforts(m) {
		if (!m) return m
		var src = isPlainObj(m.reasoningEfforts) ? m.reasoningEfforts : null
		var keys = src ? sortLevels(Object.keys(src).filter(function (k) { return k != null && k !== '' })) : []
		var levels = keys.length ? keys : sortLevels(reasoningLevels(m))
		if (keys.length) m.reasoning = keys
		var out = {}
		levels.forEach(function (lv) {
			var w = (src && Object.prototype.hasOwnProperty.call(src, lv)) ? src[lv] : defaultWire(lv)
			out[lv] = lv === 'off' ? null : normWire(w)
		})
		m.reasoningEfforts = out
		if (typeof m.compatTag !== 'string' || !m.compatTag) m.compatTag = null
		return m
	}

	function effortPairs(m) {
		return sortLevels(reasoningLevels(m)).map(function (lv) {
			return lv + '\u0000' + String(wireOf(m, lv))
		}).join('\u0001')
	}

	function sameEfforts(a, b) {
		return effortPairs(a || null) === effortPairs(b || null)
	}

	function hasRole(m) {
		return !!(m && m.devRole && m.devRole !== 'auto')
	}

	/* 行是否脏：图片 / 思考等级（含每个等级的 wire 值）与基线不同 */
	function modelDirty(pid, m) {
		var b = baselineModel(pid, m.id)
		if (!b) return true
		if (!!b.image !== !!m.image) return true
		if (!sameLevels(b.reasoning, m.reasoning)) return true
		return !sameEfforts(b, m)
	}

	function lineRoleDirty(pid) {
		var p = findProvider(pid)
		/* 置灰（协议不支持）的线路用户改不了，自然也不算脏数据 */
		if (!roleAllowed(p)) return false
		return roleOfProvider(p) !== baselineRoleOfProvider(pid)
	}

	function rowDirty(pid, m) {
		return modelDirty(pid, m) || lineRoleDirty(pid)
	}

	function matches(p, m) {
		var q = state.search.trim().toLowerCase()
		if (state.lineFilter && p.id !== state.lineFilter) return false
		if (!q) return true
		var hay = [m.id, m.name, p.id, p.displayName].filter(Boolean).join(' ').toLowerCase()
		return hay.indexOf(q) >= 0
	}

	/* 当前筛选后可见的行（一张平表，按线路顺序） */
	function visibleRows() {
		var out = []
		providers().forEach(function (p) {
			modelsOf(p).forEach(function (m) {
				if (!matches(p, m)) return
				if (state.onlyConfigured && !isConfigured(m)) return
				out.push({ p: p, m: m })
			})
		})
		return out
	}

	function selCount() {
		var n = 0
		for (var k in state.sel) {
			if (Object.prototype.hasOwnProperty.call(state.sel, k) && state.sel[k]) n++
		}
		return n
	}

	function selectedModels() {
		var out = []
		providers().forEach(function (p) {
			modelsOf(p).forEach(function (m) {
				if (state.sel[rowKey(p.id, m.id)]) out.push({ p: p, m: m })
			})
		})
		return out
	}

	/* ================= 增量（只发真正改过的项） ================= */
	/* 返回 {models:[{provider,model,image,reasoning|reasoningEfforts}], roles:[{provider,devRole}], prefs:{}}
	 * 规则（§10.2 保存请求变化）：改过等级或 wire → 发完整 reasoningEfforts 映射（优先）；
	 * 只改图片 → 维持现状发 reasoning 键数组；没改动的模型不进增量。 */
	function diffData() {
		var out = { models: [], roles: [], prefs: {} }
		if (!state.data || !state.baseline) return out
		providers().forEach(function (p) {
			modelsOf(p).forEach(function (m) {
				var b = baselineModel(p.id, m.id)
				if (!b) return
				var imgChanged = (!!b.image !== !!m.image)
				var lvChanged = !sameLevels(b.reasoning, m.reasoning) || !sameEfforts(b, m)
				if (!imgChanged && !lvChanged) return
				var item = { provider: p.id, model: m.id, image: !!m.image }
				if (lvChanged) item.reasoningEfforts = buildEfforts(m)
				else item.reasoning = sortLevels(reasoningLevels(m))
				out.models.push(item)
			})
			/* 线路级：一条线路最多一条记录（即使整条线路每一行都显示成脏）。
			 * 协议不支持 system 角色的线路（下拉已置灰）永远不进增量。 */
			var cur = roleOfProvider(p)
			if (roleAllowed(p) && cur !== baselineRoleOfProvider(p.id)) {
				out.roles.push({ provider: p.id, devRole: cur })
			}
		})
		var bp = (state.baseline.prefs && typeof state.baseline.prefs === 'object') ? state.baseline.prefs : {}
		var cp = (state.data.prefs && typeof state.data.prefs === 'object') ? state.data.prefs : {}
		for (var k in cp) {
			if (!Object.prototype.hasOwnProperty.call(cp, k)) continue
			/* §9.1：capabilityEditor 控制的分区已删除，失去作用对象 → 不再发这个键 */
			if (REMOVED_PREF_KEYS[k]) continue
			if (String(cp[k]) !== String(bp[k] === undefined ? null : bp[k])) out.prefs[k] = cp[k]
		}
		return out
	}

	function dirtyCount() {
		var d = diffData()
		var n = d.models.length + d.roles.length
		for (var k in d.prefs) {
			if (Object.prototype.hasOwnProperty.call(d.prefs, k)) n++
		}
		return n
	}

	/* ================= 渲染：左侧导航（锚点导航，点一下滚动定位，不切换页面） ================= */
	function renderSidenav() {
		var items = h('ul', { class: 'nav-list' },
			SECTIONS.map(function (s) {
				return h('li', { class: 'nav-li' },
					h('a', {
						class: 'nav-item',
						id: 'nav-' + s.id,
						href: '#' + s.id,
						'aria-current': state.active === s.id ? 'true' : 'false',
						onclick: (function (x) { return function (ev) { onNavClick(ev, x) } })(s.id)
					},
						svgIcon(s.icon),
						h('span', { class: 'nav-label', text: t('nav.' + s.key) })
					)
				)
			})
		)
		return h('div', { class: 'sidenav-inner' },
			h('h1', { class: 'brand', text: t('app.title') }),
			h('nav', { class: 'nav', 'aria-label': t('nav.label') }, items),
			h('p', { class: 'nav-tip', text: t('nav.tip') })
		)
	}

	/* ================= 渲染：顶栏（只留全局动作）+ 各区块自己的工具条 ================= */
	/* 方案 A（2026-10-19）：搜索 / 线路筛选 / 只看已配置 / 批量操作 只服务「模型能力」区，
	 * 下沉到区块内；顶栏只保留语言 / 主题 / 撤销 / 保存这类全局动作。 */
	function searchBox() {
		return h('input', {
			type: 'search',
			class: 'search',
			id: 'search-input',
			value: state.search,
			placeholder: t('search.placeholder'),
			'aria-label': t('search.label'),
			oninput: function (ev) {
				state.search = ev.target.value
				rerenderCapability()
			}
		})
	}

	function onlyConfiguredLabel() {
		return h('label', { class: 'check', title: t('list.onlyConfigured.title') },
			h('input', {
				type: 'checkbox',
				id: 'only-configured',
				checked: state.onlyConfigured,
				onchange: function (ev) {
					state.onlyConfigured = !!ev.target.checked
					rerenderCapability()
				}
			}),
			h('span', { text: t('list.onlyConfigured') }))
	}

	function batchBar() {
		return h('div', { class: 'sec-tools-batch', id: 'batch-bar' },
			h('span', { class: 'toolbar-label', text: t('toolbar.batch') }),
			h('button', {
				type: 'button', class: 'btn btn-mini', title: t('batch.image.tip'), text: t('batch.image'),
				onclick: function () { applyBatch('image') }
			}),
			h('button', {
				type: 'button', class: 'btn btn-mini', title: t('batch.reasoning.tip'), text: t('batch.reasoning'),
				onclick: function () { applyBatch('reasoning') }
			}),
			h('button', {
				type: 'button', class: 'btn btn-mini', title: t('batch.clear.tip'), text: t('batch.clear'),
				onclick: function () { applyBatch('clear') }
			}),
			h('span', { class: 'toolbar-count', id: 'sel-count' }))
	}
	function lineFilter() {
		var opts = [h('option', { value: '', text: t('line.all') })]
		providers().forEach(function (p) {
			opts.push(h('option', { value: p.id, text: p.displayName || p.id }))
		})
		var sel = h('select', {
			class: 'select',
			id: 'line-filter',
			'aria-label': t('toolbar.line'),
			title: t('toolbar.line'),
			onchange: function (ev) {
				state.lineFilter = ev.target.value || ''
				rerenderCapability()
			}
		}, opts)
		sel.value = state.lineFilter
		return sel
	}

	function renderTopbar() {
		var langSeg = h('div', { class: 'seg', role: 'group', 'aria-label': t('lang.label') },
			['zh', 'en'].map(function (lg) {
				return h('button', {
					type: 'button',
					class: 'seg-btn',
					'aria-pressed': state.lang === lg ? 'true' : 'false',
					text: t('lang.' + lg),
					onclick: function () { setLang(lg) }
				})
			})
		)

		var themeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': t('theme.label') },
			['light', 'dark', 'system'].map(function (th) {
				return h('button', {
					type: 'button',
					class: 'seg-btn',
					'aria-pressed': state.theme === th ? 'true' : 'false',
					text: t('theme.' + th),
					onclick: function () { setTheme(th) }
				})
			})
		)

		/* 保存：有未保存改动才启用，并显示改动条数（如「保存 (3)」） */
		var save = h('button', {
			type: 'button',
			class: 'btn save-btn',
			id: 'save-btn',
			disabled: true,
			title: t('save.none'),
			text: t('save'),
			onclick: function () { doSave() }
		})

		/* W3：撤销修改（草稿 → 最近一次加载 / 保存的基线）。无改动时 disabled。 */
		var undo = h('button', {
			type: 'button',
			class: 'btn btn-mini undo-btn',
			id: 'undo-btn',
			disabled: true,
			title: t('undo.none'),
			text: t('undo'),
			onclick: function () { undoAll() }
		})

		/* 方案 A：顶栏只留全局动作；搜索 / 筛选 / 批量操作已下沉到「模型能力」区 */
		var saveMobile = h('button', {
			type: 'button', class: 'btn save-btn', id: 'save-btn-m', disabled: true,
			title: t('save.none'), text: t('save'), onclick: function () { doSave() }
		})
		var undoMobile = h('button', {
			type: 'button', class: 'btn btn-mini undo-btn', id: 'undo-btn-m', disabled: true,
			title: t('undo.none'), text: t('undo'), onclick: function () { undoAll() }
		})
		return [
			h('div', { class: 'topbar-inner wrap' },
				isMock ? h('span', { class: 'mock-badge', text: t('banner.mockTitle') }) : null,
				h('div', { class: 'tools' }, langSeg, themeSeg, undo, save),
				h('span', { class: 'notice', id: 'notice', role: 'status', 'aria-live': 'polite' })
			),
			/* <1024px 的吸底操作条：窄屏顶栏不吸顶，保证保存随手可点 */
			h('div', { class: 'mobile-actions', id: 'mobile-actions' }, undoMobile, saveMobile)
		]
	}

	function renderNotice() {
		var n = state.notice
		if (!n || !n.text) return []
		var kids = [h('span', { class: 'notice-text', text: n.text })]
		if (n.reload) {
			kids.push(h('button', {
				type: 'button', class: 'btn btn-mini', text: t('save.reload'),
				onclick: function () { window.location.reload() }
			}))
		}
		if (n.kind !== 'ok') {
			kids.push(h('button', {
				type: 'button', class: 'btn btn-mini', text: t('notice.dismiss'),
				onclick: function () {
					if (state.noticeTimer) { window.clearTimeout(state.noticeTimer); state.noticeTimer = 0 }
					state.notice = null
					updateChrome()
				}
			}))
		}
		return kids
	}

	function setNotice(kind, text, reload, autoClear) {
		if (state.noticeTimer) { window.clearTimeout(state.noticeTimer); state.noticeTimer = 0 }
		state.notice = text ? { kind: kind, text: text, reload: !!reload } : null
		if (autoClear && text) {
			state.noticeTimer = window.setTimeout(function () {
				state.noticeTimer = 0
				state.notice = null
				updateChrome()
			}, 4000)
		}
	}

	/* 顶栏/工具栏里「会变的部分」就地更新：保存按钮文案与禁用、勾选计数、提示条。
	 * 不重建整个顶栏 —— 否则搜索框会失焦。 */
	function updateChrome() {
		var n = dirtyCount()
		var saveDisabled = !!(state.saving || state.saveConflict || n === 0)
		var saveText = state.saving ? t('save.saving') : (n ? t('save.withCount', { n: n }) : t('save'))
		var saveTitle = n ? t('save.hint') : t('save.none')
		/* 桌面顶栏 + 窄屏吸底条各一份，状态必须一致 */
		;['save-btn', 'save-btn-m'].forEach(function (id) {
			var btn = byId(id)
			if (!btn) return
			btn.disabled = saveDisabled
			btn.textContent = saveText
			btn.title = saveTitle
			btn.setAttribute('aria-busy', state.saving ? 'true' : 'false')
		})
		/* W3：没有未保存改动 → 撤销按钮 disabled */
		;['undo-btn', 'undo-btn-m'].forEach(function (id) {
			var undo = byId(id)
			if (!undo) return
			undo.disabled = saveDisabled
			undo.title = n ? t('undo.tip') : t('undo.none')
		})
		var cnt = byId('sel-count')
		if (cnt) cnt.textContent = t('toolbar.selected', { n: selCount() })
		/* 批量操作条：只在有勾选时出现；没勾选时显示弱提示 */
		var batchBar = byId('batch-bar')
		if (batchBar) batchBar.hidden = selCount() === 0
		var batchHint = byId('batch-hint')
		if (batchHint) batchHint.hidden = selCount() > 0
		var host = byId('notice')
		if (host) {
			host.className = 'notice' + (state.notice && state.notice.text ? ' notice-' + state.notice.kind : '')
			setKids(host, renderNotice())
		}
	}

	/* ================= 渲染：常驻细条（余量最紧的一条线路） ================= */
	function barCells(percent, warn) {
		var filled = Math.max(0, Math.min(10, Math.round((percent || 0) / 10)))
		var cells = []
		for (var i = 0; i < 10; i++) {
			cells.push(h('span', { class: 'bar-cell' + (i < filled ? (warn ? ' warn' : ' on') : '') }))
		}
		return h('span', { class: 'bar', role: 'img', 'aria-label': fmtPct(percent) || '' }, cells)
	}

	function generatedMeta() {
		if (!state.data || !state.data.generatedAt) return ''
		var meta = [t('meta.generatedAt') + ' ' + fmtDate(state.data.generatedAt)]
		if (typeof state.data.revision === 'number') meta.push(t('meta.revision') + ' ' + state.data.revision)
		return meta.join(' · ')
	}

	function tightestWindow(it) {
		var ws = windowsOf(it)
		var best = null
		for (var i = 0; i < ws.length; i++) {
			if (typeof ws[i].percent !== 'number') continue
			if (!best || ws[i].percent > best.percent) best = ws[i]
		}
		return best || ws[0] || null
	}

	function windowsOf(it) {
		var ws = (it && Array.isArray(it.windows)) ? it.windows.slice() : []
		ws.sort(function (a, b) {
			var da = a && typeof a.durationHours === 'number' ? a.durationHours : 0
			var db = b && typeof b.durationHours === 'number' ? b.durationHours : 0
			return da - db
		})
		return ws
	}

	function tightestQuotaItem() {
		var items = (state.quotaData && Array.isArray(state.quotaData.items)) ? state.quotaData.items : []
		var best = null
		var bestPct = -1
		var i
		for (i = 0; i < items.length; i++) {
			var it = items[i]
			if (!it || !it.supported || it.error) continue
			var w = tightestWindow(it)
			if (w && typeof w.percent === 'number' && w.percent > bestPct) {
				bestPct = w.percent
				best = it
			}
		}
		if (best) return best
		for (i = 0; i < items.length; i++) {
			if (items[i] && items[i].supported && !items[i].error) return items[i]
		}
		return items.length ? items[0] : null
	}

	/* 余量摘要：只描述余量，渲染在「线路余量」区块里（方案 A 从全局状态条下沉） */
	function renderQuotaSummary() {
		var out = [h('span', { class: 'status-label', text: t('status.tightest') })]
		if (state.stateStatus !== 'ready') {
			out.push(h('span', { class: 'status-meta', text: t('status.hint') }))
			return h('div', { class: 'quota-summary-inner wrap' }, out)
		}
		var it = tightestQuotaItem()
		if (!it) {
			out.push(h('span', { class: 'status-meta', text: t('status.noData') }))
			return h('div', { class: 'quota-summary-inner wrap' }, out)
		}
		out.push(h('span', { class: 'status-line', text: it.displayName || it.provider }))
		if (!it.supported || it.error) {
			out.push(h('span', { class: 'status-alert', text: errText(it.error) || t('status.failed') }))
			return h('div', { class: 'quota-summary-inner wrap' }, out)
		}

		var ws = windowsOf(it)
		if (ws.length) {
			var w = tightestWindow(it)
			var pct = w && typeof w.percent === 'number' ? w.percent : 0
			var warn = pct >= 90 || !!(w && w.rateLimited)
			out.push(barCells(pct, warn))
			out.push(h('span', { class: 'status-num' + (warn ? ' status-alert' : ''), text: t('status.used', { p: fmtPct(pct) }) }))
			var dp = durParts((w && w.resetsAt) || (it.period && it.period.end) || null)
			if (dp) {
				out.push(h('span', { class: 'status-meta', text: (dp.kind === 'date' ? t('status.resetAt') + ' ' + dp.date : t('status.resetIn') + ' ' + dp.bare) }))
			}
		} else {
			var bal = it.balance
			if (bal && Array.isArray(bal.items) && bal.items.length) {
				var txt = bal.items.map(function (b) {
					return (b.currency ? b.currency + ' ' : '') + (fmtNum(b.total) != null ? fmtNum(b.total) : t('common.na'))
				}).join(' · ')
				if (bal.isAvailable === false) {
					out.push(h('span', { class: 'status-alert', text: t('status.balance', { v: t('quota.unavailable') }) }))
				} else {
					out.push(h('span', { class: 'status-num', text: t('status.balance', { v: txt }) }))
				}
			} else {
				out.push(h('span', { class: 'status-meta', text: t('status.noData') }))
			}
		}
		return h('div', { class: 'quota-summary-inner wrap' }, out)
	}


	/* ================= 渲染：提示横幅（真实告警两条 + 示例数据徽标在顶栏） ================= */
	function renderBanners() {
		var out = []
		if (isMock) {
			out.push(h('div', { class: 'banner banner-mock' },
				h('span', { class: 'banner-title', text: t('banner.mockTitle') }),
				h('span', { class: 'banner-item', text: ' · ' + t('banner.mockBody') })
			))
		}
		var warns = []
		if (state.warnings && state.warnings.length) warns = warns.concat(state.warnings)
		if (state.quotaData && Array.isArray(state.quotaData.warnings) && state.quotaData.warnings.length) {
			warns = warns.concat(state.quotaData.warnings)
		}
		if (warns.length) {
			out.push(h('div', { class: 'banner banner-warn' },
				h('span', { class: 'banner-title', text: t('banner.warnTitle') }),
				h('div', { class: 'banner-list' }, warns.map(function (w) {
					return h('span', { class: 'banner-item', text: String(w) })
				}))
			))
		}
		return out
	}

	/* ================= 渲染：主区（三个区块同在一页从上到下：两表 + 一张设置项列表） ================= */
	function renderMain() {
		var main = byId('main')
		if (!main) return
		if (state.stateStatus === 'loading') {
			setKids(main, h('p', { class: 'placeholder' }, h('span', { class: 'placeholder-text', text: t('state.loading') })))
			return
		}
		if (state.stateStatus === 'error') {
			setKids(main, renderLoadError())
			return
		}
		setKids(main, renderSecCapability(), renderSecQuota(), renderSecPrefs(), renderFooter())
		refreshSpy()
		applyPendingHash()
	}

	/* 页脚：页面级元数据（生成时间 / 修订号）——它不属于任何一张表 */
	function renderFooter() {
		var meta = generatedMeta()
		return h('footer', { class: 'page-foot', id: 'page-foot' },
			meta ? h('span', { class: 'page-foot-meta', text: meta }) : null)
	}

	function renderLoadError() {
		return h('div', { class: 'sec' },
			h('div', { class: 'quota-error' },
				h('span', { class: 'placeholder-text', text: t('err.loadTitle') + '：' + (state.stateError || '') }),
				h('div', { class: 'note', text: t('err.hint') + ' ' + t('err.mockHint') }),
				h('button', {
					type: 'button', class: 'btn retry', text: t('err.retry'),
					onclick: function () { loadState() }
				})
			)
		)
	}

	/* 标题栏：左标题 + 右侧「元信息 + 可选操作按钮」（§9.2 P0-2 的「全部刷新」就挂在这里） */
	function sectionHead(id, title, meta, actions) {
		var right = (meta || actions)
			? h('span', { class: 'sec-head-right' },
				meta ? h('span', { class: 'sec-meta', text: meta }) : null,
				actions || null)
			: null
		return h('header', { class: 'sec-head' },
			h('h2', { class: 'sec-title', id: id + '-title', text: title }),
			right
		)
	}

	/* ---------- 区块 1：模型能力（一张平表 + 线路列，19 行，全部可编辑） ---------- */
	function renderSecCapability() {
		var all = providers()
		var rows = visibleRows()
		var totalModels = 0
		all.forEach(function (p) { totalModels += modelsOf(p).length })

		var meta = t('cap.rows', { n: rows.length }) + ' · ' + t('cap.count', { p: all.length, m: totalModels })

		var region = h('section', { class: 'sec', id: 'sec-capability', 'aria-labelledby': 'sec-capability-title' },
			sectionHead('sec-capability', t('nav.capability'), meta),
			h('p', { class: 'sec-note', text: t('cap.subtitle') }),
			/* 方案 A：这些控件只服务本表，放进区块里，归属一眼可见 */
			h('div', { class: 'sec-tools' },
				h('div', { class: 'sec-tools-filters' }, searchBox(), lineFilter(), onlyConfiguredLabel()),
				h('span', { class: 'sec-tools-hint', id: 'batch-hint', text: t('batch.hint') }),
				batchBar())
		)

		var thead = h('thead', {},
			h('tr', {},
				h('th', { scope: 'col', class: 'col-sel' }, selectAllBox()),
				h('th', { scope: 'col', class: 'col-line', text: t('cap.col.line') }),
				h('th', { scope: 'col', class: 'col-id', text: t('cap.col.id') }),
				h('th', { scope: 'col', class: 'col-name', text: t('cap.col.name') }),
				h('th', { scope: 'col', class: 'col-img', text: t('cap.col.image') }),
				h('th', { scope: 'col', class: 'col-reason', text: t('cap.col.reasoning') }),
				h('th', { scope: 'col', class: 'col-role', text: t('cap.col.role') })
			)
		)

		var tbody = h('tbody', {}, rows.length
			? rows.map(renderCapRow)
			: h('tr', {}, h('td', { class: 'cell-empty', colspan: '7', text: t('cap.empty') })))

		var wrap = h('div', { class: 'table-wrap tall', id: 'cap-wrap' },
			h('table', { class: 'tbl cap-tbl' }, thead, tbody))
		region.appendChild(wrap)
		return region
	}

	function selectAllBox() {
		var rows = visibleRows()
		var picked = 0
		rows.forEach(function (r) { if (state.sel[rowKey(r.p.id, r.m.id)]) picked++ })
		var box = h('input', {
			type: 'checkbox',
			id: 'sel-all',
			'aria-label': t('cap.selectAll'),
			title: t('cap.selectAll'),
			onchange: function (ev) {
				var on = !!ev.target.checked
				visibleRows().forEach(function (r) {
					var k = rowKey(r.p.id, r.m.id)
					if (on) state.sel[k] = true
					else delete state.sel[k]
				})
				rerenderCapability()
			}
		})
		box.checked = rows.length > 0 && picked === rows.length
		box.indeterminate = picked > 0 && picked < rows.length
		return box
	}

	function renderCapRow(x) {
		var p = x.p
		var m = x.m
		var k = rowKey(p.id, m.id)
		var imgDirty = modelDirty(p.id, m) && (function () {
			var b = baselineModel(p.id, m.id)
			return !b || (!!b.image !== !!m.image)
		})()
		var lvDirty = modelDirty(p.id, m) && (function () {
			var b = baselineModel(p.id, m.id)
			return !b || !sameLevels(b.reasoning, m.reasoning) || !sameEfforts(b, m)
		})()
		var roleDirty = lineRoleDirty(p.id) /* 协议不支持时恒为 false（控件置灰，改不了也不算脏） */
		var dirty = imgDirty || lvDirty || roleDirty

		var img = h('input', {
			type: 'checkbox',
			'data-role': 'image',
			checked: hasImage(m),
			title: t('cap.image.tip'),
			'aria-label': t('cap.col.image') + ' · ' + (m.name || m.id),
			onchange: function (ev) {
				m.image = !!ev.target.checked
				rerenderCapability()
				updateChrome()
			}
		})

		var roleSel = roleSelect(roleOfProvider(p), p)
		roleSel.setAttribute('data-role', 'role')
		roleSel.addEventListener('change', function (ev) {
			onRoleChange(p.id, ev.target.value)
		})
		roleSel.setAttribute('data-role-enabled', roleAllowed(p) ? '1' : '0')

		var firstOfLine = modelsOf(p).length && modelsOf(p)[0] === m

		return h('tr', {
			class: 'cap-row' + (firstOfLine ? ' row-line-start' : ''),
			'data-provider': p.id,
			'data-model': m.id,
			'data-dirty': dirty ? '1' : '0'
		},
			h('td', { class: 'cell-sel' },
				(function () {
					var box = h('input', {
						type: 'checkbox',
						'data-role': 'sel',
						'aria-label': t('cap.col.sel') + ' · ' + (m.name || m.id),
						onchange: function (ev) {
							if (ev.target.checked) state.sel[k] = true
							else delete state.sel[k]
							rerenderCapability()
						}
					})
					box.checked = !!state.sel[k]
					return box
				})()
			),
			h('td', { class: 'cell-line' },
				h('span', { text: p.displayName || p.id }),
				(p.displayName && p.id && p.displayName !== p.id)
					? h('span', { class: 'line-id mono', text: p.id })
					: null
			),
			h('td', { class: 'cell-id mono-cell', title: m.id },
				h('span', { class: 'id-text', text: m.id }),
				/* W4：compat 标记（只读；仅当 compatTag 是非空字符串时显示） */
				(typeof m.compatTag === 'string' && m.compatTag)
					? h('span', {
						class: 'compat-badge mono',
						'data-compat': m.compatTag,
						title: t('cap.compat.tip'),
						text: 'compat·' + m.compatTag
					})
					: null
			),
			h('td', { class: 'cell-name', title: m.name || m.id, text: m.name || m.id }),
			h('td', { class: 'cell-img' + (imgDirty ? ' cell-dirty' : '') },
				h('span', { class: 'img-box' },
					img,
					h('span', { class: 'img-state', text: hasImage(m) ? t('value.on') : t('value.off') })
				)
			),
			h('td', { class: 'cell-reason' + (lvDirty ? ' cell-dirty' : '') }, reasoningCell(p.id, m, k)),
			h('td', { class: 'cell-role' + (roleDirty ? ' cell-dirty' : '') }, roleSel)
		)
	}

	/* 思考等级：一组可点的等级 chips + 「+ 更多」展开全集（默认只显示该模型「有」的等级） */
	function reasoningCell(pid, m, k) {
		var cur = sortLevels(reasoningLevels(m))
		var expanded = !!state.expanded[k]
		var set = {}
		cur.forEach(function (x) { set[x] = true })
		reasoningLevels(baselineModel(pid, m.id)).forEach(function (x) { set[x] = true })
		if (expanded) LEVEL_ORDER.forEach(function (x) { set[x] = true })

		var known = LEVEL_ORDER.filter(function (x) { return set[x] })
		var extra = Object.keys(set).filter(function (x) { return LEVEL_ORDER.indexOf(x) < 0 }).sort()
		var levels = known.concat(extra)

		var kids = levels.map(function (lv) {
			var on = cur.indexOf(lv) >= 0
			var btn = h('button', {
				type: 'button',
				class: 'chip-btn',
				'data-level': lv,
				'aria-pressed': on ? 'true' : 'false',
				title: t('cap.chip.tip'),
				text: lv,
				onclick: function () { toggleLevel(pid, m.id, lv) }
			})
			/* W2：**展开「更多」之后**才给 wire 输入框——常显会把行撑宽、把 system 角色列挤出去。
			 * 不重渲染整行（否则输入焦点会丢），只就地更新脏标记与保存计数。 */
			if (!on || lv === 'off' || !expanded) return btn
			var w = wireOf(m, lv)
			return h('span', { class: 'chip-wrap' },
				btn,
				h('input', {
					type: 'text',
					class: 'wire-input mono',
					'data-level': lv,
					'data-role': 'wire',
					value: w == null ? '' : String(w),
					placeholder: t('cap.wire.ph'),
					title: t('cap.wire.tip'),
					'aria-label': lv + ' wire',
					oninput: function (ev) {
						setWire(m, lv, ev.target.value)
						var tr = ev.target.closest ? ev.target.closest('tr') : null
						if (tr) tr.setAttribute('data-dirty', modelDirty(pid, m) ? '1' : '0')
						var cell = ev.target.closest ? ev.target.closest('td') : null
						if (cell) {
							if (modelDirty(pid, m)) cell.classList.add('cell-dirty')
							else cell.classList.remove('cell-dirty')
						}
						updateChrome()
					}
				})
			)
		})

		if (!cur.length && !expanded) {
			kids.push(h('span', { class: 'reason-none', text: t('cap.reasoning.none') }))
		}

		kids.push(h('button', {
			type: 'button',
			class: 'chip-btn more',
			'data-role': 'more',
			'aria-expanded': expanded ? 'true' : 'false',
			text: expanded ? t('cap.chip.less') : t('cap.chip.more'),
			onclick: function () {
				if (expanded) delete state.expanded[k]
				else state.expanded[k] = true
				rerenderCapability()
			}
		}))

		/* W1：「继承自…」入口——放在等级 chips 的末尾 */
		kids.push(h('button', {
			type: 'button',
			class: 'inherit-link',
			'data-role': 'inherit',
			title: t('inherit.subtitle'),
			text: t('inherit.title'),
			onclick: function () { openInherit(pid, m.id) }
		}))

		return h('span', { class: 'chips' }, kids)
	}

	/* 线路的 system 角色下拉。p 的协议（apis）不支持这个开关时：disabled + 置灰 + title 说明。
	 * 注意用 disabled 属性（不是 readonly），并且置灰只用「颜色」不用 opacity：
	 * opacity 会把 --ink-muted 的实际对比度拉低于 4.5:1。 */
	function roleSelect(cur, p) {
		var v = cur ? String(cur) : 'auto'
		var allowed = roleAllowed(p)
		var apis = providerApis(p)
		var base = ['auto', 'system', 'developer']
		var opts = base.slice()
		if (base.indexOf(v) < 0) opts.push(v) /* 未知取值（如 off）原样列出，不假装成 auto */
		var tip = allowed
			? t('cap.role.tip')
			: t('cap.role.unsupported') + (apis.length ? '（' + apis.join(' · ') + '）' : '')
		var sel = h('select', {
			class: 'select' + (allowed ? '' : ' role-off'),
			title: tip,
			'aria-label': t('cap.col.role'),
			'aria-disabled': allowed ? null : 'true'
		},
			opts.map(function (x) {
				return h('option', {
					value: x,
					text: base.indexOf(x) >= 0 ? t('role.' + x) : t('role.raw', { v: x })
				})
			})
		)
		sel.value = v
		if (!allowed) {
			sel.disabled = true
			sel.setAttribute('disabled', 'disabled')
		}
		return sel
	}

	/* ---------- 区块 2：线路余量（一行 = 一条线路） ---------- */
	/* §9.2 P0-2：表级「全部刷新」按钮（?force=1，绕服务端缓存），不再给每行一个误导性的刷新按钮。
	 * 首次加载走 loadQuota(false) → ./api/quota（吃缓存，快）。 */
	function refreshAllButton() {
		var busy = !!state.quotaLoading
		return h('button', {
			type: 'button',
			class: 'btn btn-mini quota-refresh-all',
			id: 'quota-refresh-all',
			disabled: busy,
			title: t('quota.refresh.tip'),
			'aria-label': t('quota.refreshAll'),
			text: busy ? t('quota.refreshing') : t('quota.refreshAll'),
			onclick: function () { loadQuota(true) }
		})
	}

	function renderSecQuota() {
		var region = h('section', { class: 'sec', id: 'sec-quota', 'aria-labelledby': 'sec-quota-title' },
			sectionHead('sec-quota', t('nav.quota'), t('quota.subtitle'), refreshAllButton()),
			/* 方案 A：全局状态条里的「余量最紧」搬进余量区（它本来就只描述余量） */
			h('div', { class: 'quota-summary' }, renderQuotaSummary()))

		var allItems = (state.quotaData && Array.isArray(state.quotaData.items)) ? state.quotaData.items : []
		/* W7：未识别/不支持的线路默认隐藏；有隐藏项时给「展开全部（N）」。
		 * 注意：出错的行**不隐藏**（要让人看见失败原因）。 */
		var hiddenItems = allItems.filter(function (it) { return !it.supported && !it.recognized && !it.error })
		var expanded = !!state.quotaShowAll
		var items = expanded ? allItems : allItems.filter(function (it) { return it.supported || it.recognized || !!it.error })
		/* W8：窗口列按当前可见行的实际时长动态生成（5 小时 / 周 / 月 / N 天），不再把多窗口挤进一列 */
		var winCols = []
		var winSeen = {}
		items.forEach(function (it) {
			windowsOf(it).forEach(function (w) {
				var hk = (w && typeof w.durationHours === 'number') ? String(w.durationHours) : String((w && w.key) || '')
				if (!hk || winSeen[hk]) return
				winSeen[hk] = { id: hk, label: winLabel(w), hours: (typeof w.durationHours === 'number' ? w.durationHours : 1e9) }
				winCols.push(winSeen[hk])
			})
		})
		winCols.sort(function (a, b) { return a.hours - b.hours })
		var colCount = String(5 + Math.max(winCols.length, 1))
		var body

		if (state.quotaStatus === 'loading' || state.quotaStatus === 'idle') {
			body = h('tr', {}, h('td', { class: 'cell-empty', colspan: colCount }, t('quota.loading')))
		} else if (state.quotaStatus === 'error') {
			/* 整表失败：只占一行（colspan=列数），不要把「说明 + 重试」拆成两个 td 撑出多余的列 */
			body = h('tr', {}, h('td', { class: 'cell-empty quota-alert', colspan: colCount },
				h('span', { text: t('err.quotaTitle') + '：' + (state.quotaError || '') + ' ' + t('err.quotaHint') }),
				h('button', {
					type: 'button', class: 'btn btn-mini', text: t('err.retry'),
					onclick: function () { loadQuota(true) }
				})))
		} else if (!items.length) {
			body = h('tr', {}, h('td', { class: 'cell-empty', colspan: colCount, text: t('quota.empty') }))
		} else {
			body = items.map(function (it) { return renderQuotaRow(it, winCols) })
		}

		region.appendChild(h('div', { class: 'table-wrap', id: 'quota-wrap' },
			h('table', { class: 'tbl quota-tbl' },
				h('thead', {},
					h('tr', {},
						h('th', { scope: 'col', class: 'col-line', text: t('quota.col.provider') }),
						h('th', { scope: 'col', class: 'col-type', text: t('quota.col.type') }),
						winCols.length
							? winCols.map(function (c) { return h('th', { scope: 'col', class: 'col-win num', text: c.label }) })
							: h('th', { scope: 'col', class: 'col-win num', text: t('quota.col.window') }),
						h('th', { scope: 'col', class: 'col-balance num', text: t('quota.col.balance') }),
						h('th', { scope: 'col', class: 'col-reset', text: t('quota.col.reset') }),
						h('th', { scope: 'col', class: 'col-action', text: t('quota.row.refresh') })
					)
				),
				h('tbody', {}, body)
			)
		))

		/* W7：有被隐藏的行时，表格下方给「展开全部（N）」/「收起」 */
		if (hiddenItems.length) {
			region.appendChild(h('div', { class: 'quota-more-row' },
				h('button', {
					type: 'button',
					class: 'btn btn-mini',
					id: 'quota-more-toggle',
					title: t('quota.more.tip'),
					text: expanded ? t('quota.more.hide') : t('quota.more.show', { n: hiddenItems.length }),
					onclick: function () {
						state.quotaShowAll = !expanded
						rerenderQuota()
					}
				})
			))
		}
		return region
	}

	function renderQuotaRow(it, winCols) {
		var type = quotaType(it)
		var ws = windowsOf(it)
		var bal = it.balance
		var balText = null
		var balAlert = false
		if (bal && Array.isArray(bal.items) && bal.items.length) {
			/* W11：多币种按币种字母序；余额 ≤0 追加「（余额不足）」 */
			var sorted = bal.items.slice().sort(function (a, b) {
				return String(a.currency || '').localeCompare(String(b.currency || ''))
			})
			var low = sorted.some(function (b) { return typeof b.total === 'number' && b.total <= 0 })
			balText = sorted.map(function (b) {
				return (b.currency ? b.currency + ' ' : '') + (fmtNum(b.total) != null ? fmtNum(b.total) : t('common.na'))
			}).join(' · ')
			if (low) { balText = balText + ' ' + t('quota.balance.low'); balAlert = true }
		}
		if (bal && bal.isAvailable === false) { balText = t('quota.unavailable'); balAlert = true }

		var usage = []
		ws.forEach(function (w) {
			if (fmtNum(w.used) != null && fmtNum(w.total) != null) {
				usage.push(fmtNum(w.used) + ' / ' + fmtNum(w.total) + (w.currency ? ' ' + w.currency : ''))
			}
		})

		var reset = []
		ws.forEach(function (w) {
			if (w.rateLimited) { reset.push(t('quota.rateLimited')); return }
			var dp = durParts(w.resetsAt)
			reset.push(!dp ? t('quota.reset.none')
				: (dp.kind === 'now' ? t('quota.reset.now')
					: (dp.kind === 'date' ? t('quota.reset.at', { v: dp.date }) : t('quota.reset.after', { v: dp.bare }))))
		})
		/* 动态窗口列之后，多个窗口的重置文案常常相同 → 去重，避免「即将重置 · 即将重置」 */
		reset = reset.filter(function (v, i) { return reset.indexOf(v) === i })
		if (!ws.length && it.period && it.period.end) {
			reset.push(t('quota.period') + ' · ' + ((typeof it.period.daysLeft === 'number') ? t('quota.periodDays', { d: it.period.daysLeft }) : fmtDate(it.period.end)))
		}

		var dash = function (txt) { return txt ? txt : t('common.na') }

		return h('tr', { 'data-provider': it.provider || '' },
			h('td', { class: 'cell-line' },
				h('span', { text: it.displayName || it.provider || '' }),
				(it.family ? h('span', { class: 'line-id mono', text: String(it.family) }) : null)
			),
			h('td', { class: 'cell-type' },
				(it.error && type !== 'unsupported')
					? h('span', { class: 'quota-alert', text: t('quota.type.' + type) })
					: h('span', { text: t('quota.type.' + type) })
			),
			/* W8：每个窗口一列，按 durationHours 对齐 */
			(winCols && winCols.length ? winCols : [{ id: '', label: '' }]).map(function (col) {
				var w = null
				for (var i = 0; i < ws.length; i++) {
					var hk = (ws[i] && typeof ws[i].durationHours === 'number') ? String(ws[i].durationHours) : String((ws[i] && ws[i].key) || '')
					if (hk === col.id) { w = ws[i]; break }
				}
				if (!w) return h('td', { class: 'num col-win' }, h('span', { text: t('common.na') }))
				var txt = null
				if (fmtNum(w.used) != null && fmtNum(w.total) != null) {
					txt = fmtNum(w.used) + ' / ' + fmtNum(w.total) + (w.currency ? ' ' + w.currency : '')
					if (typeof w.percent === 'number') txt = fmtNum(w.percent) + '% · ' + txt
				} else if (typeof w.percent === 'number') txt = fmtNum(w.percent) + '%'
				return h('td', { class: 'num col-win' }, h('span', { class: 'mono-cell', text: dash(txt) }))
			}),
			h('td', { class: 'num' },
				(it.error && !balText)
					? h('span', { class: 'quota-alert', text: errText(it.error) })
					: h('span', { class: balAlert ? 'quota-alert' : '', text: dash(balText) })
			),
			h('td', {}, h('span', { text: dash(reset.join(' · ')) })),
			/* W6：行内刷新——只刷这一条线路 */
			h('td', { class: 'col-action' },
				h('button', {
					type: 'button',
					class: 'btn btn-mini',
					'data-provider': it.provider || '',
					disabled: !!state.quotaLoading,
					title: t('quota.row.tip'),
					'aria-label': t('quota.row.refresh') + ' ' + (it.displayName || it.provider || ''),
					text: (state.quotaLoading && !!state.quotaRowLoading[it.provider]) ? t('quota.row.refreshing') : t('quota.row.refresh'),
					onclick: function () { refreshOne(it.provider) }
				})
			)
		)
	}

	/* 类型只看「有没有数据」；查询失败（error）单独用告警文字展示，不硬说成不支持 */
	function quotaType(it) {
		if (!it) return 'unknown'
		if (!it.supported) return 'unsupported'
		if (Array.isArray(it.windows) && it.windows.length) return 'plan'
		if (it.balance) return 'balance'
		return 'unknown'
	}

	/* ---------- 区块 3：插件偏好（7 项，普通设置项列表：左标签 + 说明，右控件） ---------- */
	/* §9.1：capabilityEditor 控制的分区已从 DSH 设置里删除，这一项失去作用对象 →
	 * 不再出现在列表里（8 项变 7 项），也不再进保存增量。
	 * 形态：用户反馈「设置没必要用表格」→ 改成表单式列表，分组用区块小标题。
	 * 分组语义（features / ui）与顺序不变；控件类型、脏标记、保存增量逻辑全部不变。 */
	var REMOVED_PREF_KEYS = { capabilityEditor: true }

	function prefRows() {
		return [
			{ key: 'badgeAndQuota', group: 'features', kind: 'bool' },
			{ key: 'hoverRefresh', group: 'ui', kind: 'bool' },
			{ key: 'autoRefreshOn', group: 'ui', kind: 'bool' },
			{ key: 'autoRefreshMin', group: 'ui', kind: 'number' },
			{ key: 'showMore', group: 'ui', kind: 'bool' },
			{ key: 'fontSize', group: 'ui', kind: 'select', options: ['small', 'middle', 'large'], labelKey: 'pref.fontSize.' },
			{ key: 'language', group: 'ui', kind: 'select', options: ['system', 'zh', 'en'], labelKey: 'pref.lang.' }
		]
	}

	function prefs() {
		if (!state.data || !state.data.prefs || typeof state.data.prefs !== 'object') {
			if (state.data) state.data.prefs = {}
			return (state.data && state.data.prefs) ? state.data.prefs : {}
		}
		return state.data.prefs
	}

	function setPref(key, value) {
		var p = prefs()
		p[key] = value
		rerenderPrefs()
		updateChrome()
	}

	/* 按 group 归组，保留原有分组顺序（features → ui），组内保持 prefRows() 的顺序 */
	function prefGroups() {
		var list = prefRows()
		var groups = []
		list.forEach(function (item) {
			var g = groups.length ? groups[groups.length - 1] : null
			if (!g || g.name !== item.group) {
				g = { name: item.group, items: [] }
				groups.push(g)
			}
			g.items.push(item)
		})
		return groups
	}

	/* 条目级脏标记：与旧版 prefControl 里的判断完全一致（String 比较，基线缺省时按 "undefined"） */
	function prefDirty(key) {
		return String(prefs()[key]) !== String(baselinePref(key))
	}

	function renderSecPrefs() {
		var blocks = prefGroups().map(function (g) {
			var titleId = 'pref-group-' + g.name
			return h('div', { class: 'pref-group', role: 'group', 'aria-labelledby': titleId },
				h('h3', { class: 'pref-group-title', id: titleId, text: t('pref.group.' + g.name) }),
				h('div', { class: 'pref-list' }, g.items.map(function (item) {
					return h('div', {
						class: 'pref-item' + (prefDirty(item.key) ? ' is-dirty' : ''),
						'data-pref': item.key
					},
						h('div', { class: 'pref-item-text' },
							h('div', { class: 'pref-label', text: t('pref.' + item.key) }),
							h('div', { class: 'pref-desc', text: t('pref.' + item.key + '.desc') }),
							/* W9：这个开关影响 DSH 页面里徽章槽位的注册，改完必须刷新 DSH 页面才生效 */
							item.key === 'badgeAndQuota'
								? h('div', { class: 'pref-note', text: t('pref.badgeAndQuota.apply') })
								: null
						),
						h('div', { class: 'pref-item-ctl' }, prefControl(item))
					)
				}))
			)
		})

		return h('section', { class: 'sec', id: 'sec-prefs', 'aria-labelledby': 'sec-prefs-title' },
			sectionHead('sec-prefs', t('nav.prefs'), t('pref.hint')),
			h('div', { class: 'prefs-wrap', id: 'prefs-wrap' }, blocks)
		)
	}

	function prefControl(item) {
		var p = prefs()
		var cur = p[item.key]
		var key = item.key

		if (item.kind === 'bool') {
			var on = cur === true
			var box = h('input', {
				type: 'checkbox',
				'data-pref-ctl': key,
				'aria-label': t('pref.' + key),
				onchange: function (ev) { setPref(key, !!ev.target.checked) }
			})
			box.checked = on
			return h('span', { class: 'pref-ctl' },
				box,
				h('span', { class: 'pref-state', text: on ? t('value.on') : t('value.off') })
			)
		}

		if (item.kind === 'number') {
			var input = h('input', {
				type: 'number',
				class: 'num-input',
				'data-pref-ctl': key,
				min: '1',
				max: '1440',
				step: '1',
				'aria-label': t('pref.' + key),
				value: String(cur == null ? '' : cur),
				onchange: function (ev) {
					var n = parseInt(ev.target.value, 10)
					if (!(n >= 1)) n = 1
					if (n > 1440) n = 1440
					setPref(key, n)
				}
			})
			/* W10：与旧设置面板一致——「定时刷新」关闭时，间隔输入框禁用并变淡 */
			var linkedOff = key === 'autoRefreshMin' && prefs().autoRefreshOn !== true
			if (linkedOff) {
				input.disabled = true
				input.setAttribute('disabled', 'disabled')
				input.setAttribute('aria-disabled', 'true')
				input.classList.add('is-linked-off')
				input.title = t('pref.autoRefreshMin.off')
			}
			return h('span', { class: 'pref-ctl' + (linkedOff ? ' is-linked-off' : '') },
				input,
				h('span', { class: 'min-unit', text: t('pref.minUnit') })
			)
		}

		var opts = (item.options || []).slice()
		var sv = String(cur == null ? '' : cur)
		if (sv && opts.indexOf(sv) < 0) opts.push(sv) /* 未知取值：补一个选项原样显示，避免误导 */
		var sel = h('select', {
			class: 'select',
			'data-pref-ctl': key,
			'aria-label': t('pref.' + key),
			onchange: function (ev) { setPref(key, ev.target.value) }
		}, opts.map(function (o) {
			return h('option', { value: o, text: t(item.labelKey + o) })
		}))
		sel.value = sv
		return h('span', { class: 'pref-ctl' }, sel)
	}

	function baselinePref(key) {
		var bp = (state.baseline && state.baseline.prefs) ? state.baseline.prefs : {}
		return bp[key]
	}

	/* ================= W1：继承自…（从目录复制图片能力 + 思考等级，不含 compat） ================= */
	function mockCatalog() {
		var out = []
		;(MOCK_STATE.providers || []).forEach(function (p) {
			;(p.models || []).forEach(function (m) {
				var eff = m.reasoningEfforts || {}
				if (!m.image && !Object.keys(eff).length) return
				out.push({ provider: p.id, model: m.id, name: m.name || m.id, image: !!m.image, reasoningEfforts: eff })
			})
		})
		return out
	}

	function openInherit(pid, mid) {
		state.inheritFocus = document.activeElement
		state.inherit = { pid: pid, mid: mid, status: 'loading', error: '', models: null, search: '' }
		renderInheritInto()
		if (isMock) {
			state.inherit.status = 'ready'
			state.inherit.models = mockCatalog()
			renderInheritInto()
			return
		}
		fetch(apiPath('./api/catalog'), { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
			.then(function (res) {
				if (!res.ok) throw new Error('HTTP ' + res.status)
				return res.json()
			})
			.then(function (data) {
				if (!state.inherit) return
				state.inherit.models = (data && Array.isArray(data.models)) ? data.models : []
				state.inherit.status = 'ready'
				renderInheritInto()
			})
			.catch(function (err) {
				if (!state.inherit) return
				state.inherit.status = 'error'
				state.inherit.error = String((err && err.message) || err || 'unknown')
				renderInheritInto()
			})
	}

	function closeInherit() {
		state.inherit = null
		renderInheritInto()
		/* 关闭后把焦点还给「继承自…」触发按钮，键盘用户不迷路 */
		var f = state.inheritFocus
		state.inheritFocus = null
		if (f && typeof f.focus === 'function' && document.contains(f)) f.focus()
	}

	/* 继承弹窗的键盘处理：Esc 关闭 + Tab 焦点陷阱（简单版：首尾循环） */
	function trapInheritTab(ev) {
		if (ev.key !== 'Tab') return
		var dlg = ev.currentTarget
		var all = dlg.querySelectorAll('button, input, select, textarea, a[href]')
		var items = []
		for (var i = 0; i < all.length; i++) {
			var el = all[i]
			if (el.disabled) continue
			if (el.offsetWidth || el.offsetHeight) items.push(el)
		}
		if (!items.length) return
		var first = items[0]
		var last = items[items.length - 1]
		if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus() }
		else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus() }
	}

	function onInheritKey(ev) {
		if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeInherit(); return }
		trapInheritTab(ev)
	}

	/* 选中来源：复制 image + reasoningEfforts（含 wire 值），**绝不碰 compat** */
	function pickInherit(entry) {
		var st = state.inherit
		if (!st || !entry) return
		var f = findModel(st.pid, st.mid)
		if (!f) { closeInherit(); return }
		var m = f.m
		m.image = !!entry.image
		var src = (entry.reasoningEfforts && typeof entry.reasoningEfforts === 'object') ? entry.reasoningEfforts : {}
		var levels = sortLevels(Object.keys(src))
		m.reasoning = levels
		var out = {}
		levels.forEach(function (lv) {
			out[lv] = lv === 'off' ? null : normWire(src[lv])
		})
		m.reasoningEfforts = out
		var label = entry.name || entry.model || ''
		closeInherit()
		rerenderCapability()
		updateChrome()
		setNotice('ok', t('inherit.done') + '：' + label, false, true)
	}

	function renderInheritInto() {
		var app = byId('app')
		if (!app) return
		var root = byId('inherit-root')
		if (!state.inherit) {
			if (root && root.parentNode) root.parentNode.removeChild(root)
			return
		}
		if (!root) {
			root = document.createElement('div')
			root.id = 'inherit-root'
			app.appendChild(root)
		}
		setKids(root, renderInherit())
		/* 刚打开 / 异步列表重画后，若焦点不在弹窗里，把它送回搜索框 */
		if (!root.contains(document.activeElement)) {
			var box = byId('inherit-search')
			if (box) box.focus()
		}
	}

	function renderInherit() {
		var st = state.inherit
		var head = h('div', { class: 'dlg-head' },
			h('div', { class: 'dlg-title', text: t('inherit.title') }),
			h('div', { class: 'dlg-sub', text: t('inherit.subtitle') }),
			h('div', { class: 'dlg-target-row' },
				h('span', { class: 'dlg-target-label', text: t('inherit.target') }),
				h('span', { class: 'dlg-target mono', text: (st.pid || '') + ' / ' + (st.mid || '') })
			)
		)
		var search = h('input', {
			type: 'search',
			class: 'search dlg-search',
			id: 'inherit-search',
			placeholder: t('inherit.search.placeholder'),
			'aria-label': t('inherit.search'),
			value: st.search,
			oninput: function (ev) {
				if (!state.inherit) return
				state.inherit.search = ev.target.value
				/* 只重画列表，保住搜索框焦点 */
				var box = byId('inherit-body')
				if (box) setKids(box, renderInheritBody())
			}
		})

		var body = h('div', { class: 'dlg-body', id: 'inherit-body' }, renderInheritBody())
		var foot = h('div', { class: 'dlg-foot' },
			h('button', { type: 'button', class: 'btn', text: t('inherit.close'), onclick: closeInherit })
		)
		return h('div', {
			class: 'dlg-mask',
			id: 'inherit-mask',
			onclick: function (ev) { if (ev.target === ev.currentTarget) closeInherit() }
		},
			h('div', {
				class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('inherit.title'),
				onkeydown: onInheritKey
			},
				head, search, body, foot)
		)
	}

	function renderInheritBody() {
		var st = state.inherit
		if (!st) return null
		if (st.status === 'loading') return h('p', { class: 'dlg-state', text: t('inherit.loading') })
		if (st.status === 'error') {
			return h('div', { class: 'dlg-state' },
				h('span', { class: 'quota-alert', text: t('inherit.error') + '：' + (st.error || '') }),
				h('button', {
					type: 'button', class: 'btn btn-mini', text: t('inherit.retry'),
					onclick: function () { openInherit(st.pid, st.mid) }
				})
			)
		}
		var q = String(st.search || '').toLowerCase()
		var list = (st.models || []).filter(function (x) {
			if (!q) return true
			return (String(x.provider || '') + ' ' + String(x.model || '') + ' ' + String(x.name || '')).toLowerCase().indexOf(q) >= 0
		})
		if (!list.length) return h('p', { class: 'dlg-state', text: t('inherit.empty') })

		var groups = []
		list.forEach(function (x) {
			var g = groups.length ? groups[groups.length - 1] : null
			if (!g || g.p !== x.provider) { g = { p: x.provider, items: [] }; groups.push(g) }
			g.items.push(x)
		})
		return h('div', { class: 'dlg-list' }, groups.map(function (g) {
			return h('div', { class: 'dlg-group' },
				h('div', { class: 'dlg-group-title mono', text: g.p || '' }),
				h('div', { class: 'dlg-group-items' }, g.items.map(function (x) {
					var lvCount = x.reasoningEfforts ? Object.keys(x.reasoningEfforts).length : 0
					var meta = []
					if (x.image) meta.push(t('inherit.item.image'))
					meta.push(lvCount ? (lvCount + ' ' + t('cap.col.reasoning')) : t('inherit.item.none'))
					return h('button', {
						type: 'button',
						class: 'dlg-item',
						'data-provider': x.provider || '',
						'data-model': x.model || '',
						title: t('inherit.subtitle'),
						onclick: function () { pickInherit(x) }
					},
						h('span', { class: 'dlg-item-name', text: x.name || x.model }),
						h('span', { class: 'dlg-item-id mono', text: x.model }),
						h('span', { class: 'dlg-item-meta', text: meta.join(' · ') })
					)
				}))
			)
		}))
	}

	/* ================= 就地重渲染（保住滚动与输入焦点） ================= */
	/* 主表/余量表/偏好列表各自替换自己的 <section> 节点：
	 * ① 顶栏里的搜索框不会失焦；② 容器内部的滚动位置（主表 max-height 内滚）按原样还原。 */
	function replaceSection(id, fresh, wrapId) {
		var old = byId(id)
		if (!old || !old.parentNode) return false
		var wrap = wrapId ? byId(wrapId) : null
		var top = wrap ? wrap.scrollTop : 0
		var left = wrap ? wrap.scrollLeft : 0
		old.parentNode.replaceChild(fresh, old)
		var nw = wrapId ? byId(wrapId) : null
		if (nw) { nw.scrollTop = top; nw.scrollLeft = left }
		return true
	}

	function rerenderCapability() {
		/* 工具条已搬进本区块：整区重画时把焦点/光标还回去，否则搜索框打一个字就丢焦点 */
		var act = document.activeElement
		var focusId = (act && (act.id === 'search-input' || act.id === 'line-filter' || act.id === 'only-configured')) ? act.id : ''
		var selStart = 0
		var selEnd = 0
		if (focusId === 'search-input') {
			try { selStart = act.selectionStart || 0; selEnd = act.selectionEnd || 0 } catch (err) { /* ignore */ }
		}
		if (!replaceSection('sec-capability', renderSecCapability(), 'cap-wrap')) {
			/* 还没有这一区块（加载中/失败态）时什么都不用做 */
			updateChrome()
			return
		}
		if (focusId) {
			var el = byId(focusId)
			if (el && typeof el.focus === 'function') {
				el.focus()
				if (focusId === 'search-input') {
					try { el.setSelectionRange(selStart, selEnd) } catch (err) { /* ignore */ }
				}
			}
		}
		updateChrome()
		scheduleSpy()
	}

	function rerenderQuota() {
		replaceSection('sec-quota', renderSecQuota(), 'quota-wrap')
		scheduleSpy()
	}

	function rerenderPrefs() {
		replaceSection('sec-prefs', renderSecPrefs(), 'prefs-wrap')
		scheduleSpy()
	}


	/* ================= 编辑动作 ================= */
	function toggleLevel(pid, mid, lv) {
		var f = findModel(pid, mid)
		if (!f) return
		var cur = reasoningLevels(f.m)
		var i = cur.indexOf(lv)
		if (i >= 0) cur.splice(i, 1)
		else cur.push(lv)
		f.m.reasoning = sortLevels(cur)
		rerenderCapability()
		updateChrome()
	}

	/* system 角色是线路级设置：改一行 → 整条线路所有行同步（脏数据只记一条线路级改动） */
	function onRoleChange(pid, value) {
		var p = findProvider(pid)
		if (!p) return
		modelsOf(p).forEach(function (m) { m.devRole = value })
		rerenderCapability()
		updateChrome()
	}

	/* 批量操作：只作用于勾选行；没勾选时提示，而不是静默 */
	function applyBatch(kind) {
		var all = selectedModels()
		/* 批量只作用于当前筛选下可见的勾选行：被搜索 / 线路筛选隐藏的行不静默改掉 */
		var visible = {}
		visibleRows().forEach(function (r) { visible[rowKey(r.p.id, r.m.id)] = true })
		var rows = all.filter(function (x) { return visible[rowKey(x.p.id, x.m.id)] })
		if (!rows.length) {
			setNotice('error', all.length ? t('batch.hiddenOnly') : t('toolbar.pick'), false, true)
			updateChrome()
			return
		}
		rows.forEach(function (x) {
			if (kind === 'image') x.m.image = true
			else if (kind === 'clear') { x.m.image = false; x.m.reasoning = []; x.m.reasoningEfforts = {} }
			else if (kind === 'reasoning') {
				if (!reasoningLevels(x.m).length) {
					var avail = reasoningLevels(baselineModel(x.p.id, x.m.id))
					x.m.reasoning = avail.indexOf('off') >= 0 ? ['off'] : (avail.length ? [avail[0]] : ['off'])
				}
			}
		})
		var skipped = all.length - rows.length
		setNotice('ok', skipped ? t('batch.doneSkipped', { n: rows.length, m: skipped }) : t('batch.done', { n: rows.length }), false, true)
		rerenderCapability()
		updateChrome()
	}

	/* ================= 保存（POST ./api/save，只发增量） ================= */
	function postSave(body) {
		if (isMock) {
			/* 示例数据模式不请求后端（保护真实设置），本地模拟一次成功，便于离线看成功态 */
			return new Promise(function (resolve) {
				window.setTimeout(function () {
					var rev = (state.data && typeof state.data.revision === 'number') ? state.data.revision : 0
					resolve({ status: 200, body: { ok: true, revision: rev + 1, warnings: [] } })
				}, 250)
			})
		}
		return fetch(apiPath('./api/save'), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
			body: JSON.stringify(body)
		}).then(function (res) {
			return res.json().catch(function () { return null }).then(function (payload) {
				return { status: res.status, body: payload }
			})
		})
	}

	function doSave() {
		if (state.saving) return
		var d = diffData()
		var n = d.models.length + d.roles.length
		for (var k in d.prefs) {
			if (Object.prototype.hasOwnProperty.call(d.prefs, k)) n++
		}
		if (!n) {
			setNotice(null, '', false)
			updateChrome()
			return
		}
		var body = {
			revision: (state.data && typeof state.data.revision === 'number') ? state.data.revision : null
		}
		if (d.models.length) body.models = d.models
		if (d.roles.length) body.roles = d.roles
		var prefKeys = []
		for (var pk in d.prefs) {
			if (Object.prototype.hasOwnProperty.call(d.prefs, pk)) prefKeys.push(pk)
		}
		if (prefKeys.length) body.prefs = d.prefs

		state.saving = true
		/* 基线 = 这次真正发出去的快照。保存途中继续编辑的改动，保存成功后仍然是脏的，
		 * 不会被 baseline=clone(state.data) 静默吞掉（原先的静默丢改动 bug）。 */
		var submitted = clone(state.data)
		setNotice(null, '', false)
		updateChrome()

		postSave(body).then(function (r) {
			state.saving = false
			if (r.status === 200 && r.body && r.body.ok !== false) {
				if (typeof r.body.revision === 'number') {
					state.data.revision = r.body.revision
					if (submitted) submitted.revision = r.body.revision
				}
				state.baseline = submitted || state.baseline
				setNotice('ok', isMock ? t('save.mockSaved') : t('save.saved'), false, true)
				render()
				return
			}
			if (r.status === 409) {
				/* 冲突：保留用户改动，给「重新加载」按钮；并锁住保存，避免反复 409 */
				state.saveConflict = true
				setNotice('conflict', t('save.conflict'), true)
				updateChrome()
				return
			}
			var msg = (r.body && r.body.message) ? String(r.body.message) : ('HTTP ' + r.status)
			setNotice('error', t('save.failed') + '：' + msg, false)
			updateChrome()
		})['catch'](function (err) {
			state.saving = false
			setNotice('error', t('save.failed') + '：' + String((err && err.message) || err || 'unknown'), false)
			updateChrome()
		})
	}

	/* W3：撤销修改（草稿 → 最近一次加载 / 保存的基线） */
	function undoAll() {
		if (!state.baseline || state.saving) return
		if (dirtyCount() === 0) { updateChrome(); return }
		state.data = clone(state.baseline)
		state.saveConflict = false
		setNotice('ok', t('undo.done'), false, true)
		render()
		updateChrome()
	}

	/* 离开页面时若有未保存改动 → 提示 */
	function onBeforeUnload(ev) {
		if (state.saving || dirtyCount() === 0) return
		ev.preventDefault()
		ev.returnValue = ''
		return ''
	}

	/* ================= 锚点导航 + scroll-spy ================= */
	var spyRaf = 0
	var pendingHash = ''
	/* 平滑滚动期间先锁住高亮（否则会沿途闪一下别的区块），目标一到位就立刻交还给 scroll-spy */
	var spyTarget = ''
	var spyTargetDown = true
	var spyTargetUntil = 0

	function isWide() {
		return !(window.matchMedia && !window.matchMedia('(min-width: 1024px)').matches)
	}

	/* 粘在视口顶部的元素会挡住区块开头，滚动位置要把它们的高度让出来 */
	function isSticky(el) {
		if (!el || !window.getComputedStyle) return false
		return window.getComputedStyle(el).position === 'sticky'
	}

	function measureOffset() {
		var off = 0
		var top = byId('topbar')
		if (isSticky(top)) off += top.offsetHeight
		var nav = byId('sidenav')
		if (isSticky(nav) && !isWide()) off += nav.offsetHeight
		return off
	}

	function sectionEls() {
		var els = []
		for (var i = 0; i < SECTIONS.length; i++) {
			var el = byId(SECTIONS[i].id)
			if (el) els.push(el)
		}
		return els
	}

	function paintNav() {
		for (var i = 0; i < SECTIONS.length; i++) {
			var a = byId('nav-' + SECTIONS[i].id)
			if (a) a.setAttribute('aria-current', state.active === SECTIONS[i].id ? 'true' : 'false')
		}
	}

	function setActive(id) {
		if (state.active === id) return
		state.active = id
		paintNav()
	}

	function onNavClick(ev, id) {
		if (ev && ev.preventDefault) ev.preventDefault()
		goSection(id, true)
	}

	function reducedMotion() {
		return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
	}

	function lockSpy(id) {
		var el = byId(id)
		spyTarget = id
		spyTargetDown = !!(el && el.getBoundingClientRect().top > measureOffset() + 24)
		spyTargetUntil = Date.now() + 1400
	}

	function goSection(id, smooth) {
		var el = byId(id)
		if (!el) return
		lockSpy(id)
		setActive(id)
		try {
			history.replaceState(null, '', '#' + id)
		} catch (e) {
			pendingHash = ''
		}
		scrollToEl(el, smooth)
	}

	function scrollToEl(el, smooth) {
		var y = Math.round(el.getBoundingClientRect().top + window.pageYOffset - measureOffset())
		if (y < 0) y = 0
		if (smooth && !reducedMotion()) window.scrollTo({ top: y, behavior: 'smooth' })
		else window.scrollTo(0, y)
	}

	function refreshSpy() {
		if (spyTarget) {
			var tel = byId(spyTarget)
			if (tel && Date.now() < spyTargetUntil) {
				var tline = measureOffset() + 24
				var ttop = tel.getBoundingClientRect().top
				/* 还没滚到目标（向下：目标还在基准线下方；向上：目标还在基准线上方）→ 先保持高亮不动 */
				if (spyTargetDown ? ttop > tline + 4 : ttop < tline - 4) return
			}
			spyTarget = ''
		}
		var els = sectionEls()
		if (!els.length) return
		/* 基准线 = 顶部粘性条高度 + 24px 余量：JS 滚动与浏览器原生 #hash 跳转都能落进判定区 */
		var line = measureOffset() + 24
		var best = els[0].id
		for (var i = 0; i < els.length; i++) {
			/* 顶部已经越过「基准线」的最后一个区块 = 当前区块 */
			if (els[i].getBoundingClientRect().top - line <= 2) best = els[i].id
		}
		var doc = document.documentElement
		if (window.innerHeight + window.pageYOffset >= doc.scrollHeight - 4) best = els[els.length - 1].id
		setActive(best)
	}

	function scheduleSpy() {
		if (spyRaf) return
		if (window.requestAnimationFrame) {
			spyRaf = window.requestAnimationFrame(function () { spyRaf = 0; refreshSpy() })
		} else {
			spyRaf = 1
			window.setTimeout(function () { spyRaf = 0; refreshSpy() }, 16)
		}
	}

	/* 刷新后回到同一位置（可选增强）：等取数完成再落位，避免余量表把页面顶开 */
	function applyPendingHash() {
		if (!pendingHash) return
		if (state.stateStatus !== 'ready') return
		if (state.quotaStatus === 'loading') return
		var el = byId(pendingHash)
		pendingHash = ''
		if (el) {
			setActive(el.id)
			scrollToEl(el, false)
		}
	}

	function onScroll() {
		if (state.stateStatus !== 'ready') pendingHash = ''
		scheduleSpy()
	}

	/* ================= 交互：语言 / 主题 ================= */
	function setLang(lg) {
		state.lang = lg === 'en' ? 'en' : 'zh'
		writeLS(LS_LANG, state.lang)
		applyLang()
		render()
	}

	function setTheme(th) {
		state.theme = (th === 'light' || th === 'dark') ? th : 'system'
		writeLS(LS_THEME, state.theme)
		applyTheme()
		renderTopbarInto()
		updateChrome()
	}

	function applyLang() {
		document.documentElement.setAttribute('lang', state.lang === 'en' ? 'en' : 'zh-CN')
	}

	function applyTheme() {
		document.documentElement.setAttribute('data-theme', state.theme)
	}

	function renderTopbarInto() {
		var top = byId('topbar')
		if (top) setKids(top, renderTopbar())
	}

	function renderSidenavInto() {
		var side = byId('sidenav')
		if (side) setKids(side, renderSidenav())
	}

	function render() {
		renderTopbarInto()
		renderSidenavInto()
		var banners = byId('banners')
		if (banners) setKids(banners, renderBanners())
		renderMain()
		renderInheritInto()
		updateChrome()
	}

	/* ================= 取数 ================= */
	function applyState(data) {
		state.data = data
		state.saveConflict = false
		if (!state.data.warnings) state.data.warnings = []
		state.warnings = Array.isArray(state.data.warnings) ? state.data.warnings : []
		state.baseline = clone(data)
	}

	function loadState() {
		state.stateStatus = 'loading'
		state.stateError = ''
		render()
		fetch(apiPath('./api/state'), { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
			.then(function (res) {
				if (!res.ok) throw new Error('HTTP ' + res.status)
				return res.json()
			})
			.then(function (data) {
				if (!data || typeof data !== 'object') throw new Error('bad payload')
				if (data.ok === false) throw new Error('ok:false')
				applyState(data)
				state.stateStatus = 'ready'
				render()
				loadQuota(false)
			})
			.catch(function (err) {
				state.stateStatus = 'error'
				state.stateError = String((err && err.message) || err || 'unknown')
				render()
			})
	}

	function loadQuota(force) {
		if (state.quotaLoading) return
		if (state.quotaStatus === 'ready' && !force) return
		state.quotaLoading = true
		if (!state.quotaData) state.quotaStatus = 'loading'
		rerenderQuota()

		function done(data) {
			state.quotaData = data
			state.quotaStatus = 'ready'
			state.quotaLoading = false
			var banners = byId('banners')
			if (banners) setKids(banners, renderBanners())
			rerenderQuota()
			applyPendingHash()
		}

		function fail(err) {
			state.quotaLoading = false
			/* W5：首轮（还没有任何数据）遇到瞬时故障时，2 秒后自动重试**一次**，之后不再自动重试 */
			if (!state.quotaData && !state.quotaRetryDone && isTransientQuotaError(err)) {
				state.quotaRetryDone = true
				state.quotaRetryTimer = window.setTimeout(function () {
					state.quotaRetryTimer = 0
					loadQuota(true)
				}, 2000)
			}
			if (state.quotaData) {
				/* 已有数据（手动重查失败）：保住表格，只提示 */
				setNotice('error', t('err.quotaTitle') + '：' + String((err && err.message) || err || 'unknown'), false)
				rerenderQuota()
				updateChrome()
			} else {
				state.quotaStatus = 'error'
				state.quotaError = String((err && err.message) || err || 'unknown')
				rerenderQuota()
			}
		}

		if (isMock) {
			window.setTimeout(function () { done(MOCK_QUOTA) }, 120)
			return
		}

		/* §9.2 P0-2：force=1 时让 Host 绕开 5 分钟缓存与失败缓存，重新出网查询。
		 * 首次加载走 loadQuota(false) → 不带参数（吃缓存，快）。 */
		fetch(apiPath('./api/quota') + (force ? '?force=1' : ''), { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
			.then(function (res) {
				if (!res.ok) throw new Error('HTTP ' + res.status)
				return res.json()
			})
			.then(function (data) {
				if (!data || typeof data !== 'object') throw new Error('bad payload')
				done(data)
			})
			.catch(fail)
	}

	/* W6：行内刷新——只查这一条线路（?provider=<id>&force=1，绕过缓存）。
	 * 拿到结果后**按 provider 合并**进现有表格，不动其它行。 */
	function refreshOne(pid) {
		if (!pid || state.quotaLoading) return
		if (isMock) { setNotice('info', t('quota.row.refresh'), false); return }
		state.quotaLoading = true
		state.quotaRowLoading[pid] = true
		rerenderQuota()
		var url = apiPath('./api/quota') + '?provider=' + encodeURIComponent(pid) + '&force=1'
		fetch(url, { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
			.then(function (res) {
				if (!res.ok) throw new Error('HTTP ' + res.status)
				return res.json()
			})
			.then(function (data) {
				var incoming = (data && Array.isArray(data.items)) ? data.items : []
				if (!state.quotaData || !Array.isArray(state.quotaData.items)) state.quotaData = { ok: true, items: incoming.slice() }
				else {
					incoming.forEach(function (it) {
						var idx = -1
						for (var i = 0; i < state.quotaData.items.length; i++) {
							if (state.quotaData.items[i] && state.quotaData.items[i].provider === it.provider) { idx = i; break }
						}
						if (idx >= 0) state.quotaData.items[idx] = it
						else state.quotaData.items.push(it)
					})
				}
				state.quotaStatus = 'ready'
			})
			.catch(function (err) {
				setNotice('error', t('err.quotaTitle') + '：' + String((err && err.message) || err || 'unknown'), false)
			})
			.then(function () {
				state.quotaLoading = false
				state.quotaRowLoading[pid] = false
				rerenderQuota()
				updateChrome()
			})
	}

	/* W5：哪些余量错误算「瞬时」——网络/超时/429/5xx。其它（无 key、不支持、404）不重试。 */
	function isTransientQuotaError(err) {
		var msg = String((err && err.message) || err || '')
		return /network|timeout|timed out|429|\b5\d\d\b|failed to fetch|fetch failed|ECONN|ETIMEDOUT/i.test(msg)
	}

	/* ================= 启动 ================= */
	function detectLang() {
		var saved = readLS(LS_LANG)
		if (saved === 'zh' || saved === 'en') return saved
		var nav = (navigator.language || navigator.userLanguage || 'zh')
		return String(nav).toLowerCase().indexOf('zh') === 0 ? 'zh' : (String(nav).toLowerCase().indexOf('en') === 0 ? 'en' : 'zh')
	}

	function detectTheme() {
		var saved = readLS(LS_THEME)
		if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
		return 'system'
	}

	function boot() {
		state.lang = detectLang()
		state.theme = detectTheme()
		applyLang()
		applyTheme()

		var hash = String(location.hash || '').replace(/^#/, '')
		for (var i = 0; i < SECTIONS.length; i++) {
			if (SECTIONS[i].id === hash) pendingHash = hash
		}
		window.addEventListener('scroll', onScroll, { passive: true })
		window.addEventListener('resize', function () { scheduleSpy() })
		window.addEventListener('beforeunload', onBeforeUnload)

		/* 测试钩子（只读）：给 E2E 脚本看「脏增量 / 勾选数」用，不参与任何渲染 */
		window.__tkDebug = {
			dirtyCount: function () { return dirtyCount() },
			diff: function () { return diffData() },
			selCount: function () { return selCount() },
			state: function () { return state }
		}

		if (isMock) {
			applyState(MOCK_STATE)
			state.stateStatus = 'ready'
			state.quotaStatus = 'ready'
			state.quotaData = MOCK_QUOTA
			render()
			return
		}
		render()
		loadState()
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
	else boot()
})()
