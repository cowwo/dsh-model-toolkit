window.__ModuleLoader__.load({
	id: "dsh-model-toolkit",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		// ---- provider badge / hover panel / quota ----
		// 独立函数作用域：apply / inject / React / 内部辅助都不外泄。
		const __toolkitModule2 = function (require) {

		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let React = require("react");

		// ---- i18n：以中文为 key 源、英文对照；跟随系统时用 DSH 当前界面语言 ----
		const LOCALE_NS = "providerInfo";
		const zh = {
			// 弹窗
			"provider": "提供商",
			"displayName": "显示名称",
			"apiProtocol": "API 协议",
			"apiAddress": "API 地址",
			"apiKeyEnv": "密钥环境变量",
			"currentModel": "当前模型",
			"modelId": "模型 ID",
			"modelDisplayName": "模型展示名",
			"modelDescription": "模型描述",
			"reasoningLevel": "推理等级",
			"currentReasoningLevel": "当前推理等级",
			"contextWindow": "上下文窗口",
			"maxToken": "最大 token",
			"inputModes": "输入模态",
			"compatInfo": "兼容信息",
			"balance": "余量",
			"balanceName": "余额",
			"refresh": "刷新",
			"refreshing": "刷新中…",
			"unknown": "未提供",
			"window": "窗口",
			"noSupportProvider": "当前暂不支持查询当前提供商",
			"expiresOn": "到期",
			"daysUnit": "天",
			"leftDays": "剩",
			"queryFailed": "查询失败",
			"netUnreachable": "网络不可达",
			"queryTimeout": "查询超时",
			"httpRateLimited": "请求过频（429）",
			"httpServerError": "服务端错误",
			"httpStatus": "HTTP 状态",
			"noApiKey": "未配置 API Key",
			"subscriptionRequired": "订阅权限不足",
			"unauthorized": "密钥无效",
			"http404": "接口地址错误",
			"missingUsage": "接口无用量数据",
			"noData": "无数据",
			"insufficient": "（余额不足）",
			"rateLimited": "已限流",
			"noReset": "—",
			// 设置页
			"settings.toolkit": "模型工具箱",
			"settings.toolkitDesc": "所有设置都在独立页面里，点下面的按钮打开",
			"settings.toolkitOpen": "打开模型工具箱 ↗",
			// 窗口标签（浮层各列与收起态共用同一套，对齐要求，不再分紧凑/长两套）
			"quota.win.rolling": "5小时",
			"quota.win.weekly": "周",
			"quota.win.monthly": "月",
		};
		const en = {
			// 弹窗
			"provider": "Provider",
			"displayName": "Display name",
			"apiProtocol": "API protocol",
			"apiAddress": "API address",
			"apiKeyEnv": "Key env var",
			"currentModel": "Current model",
			"modelId": "Model ID",
			"modelDisplayName": "Model display name",
			"modelDescription": "Model description",
			"reasoningLevel": "Reasoning level",
			"currentReasoningLevel": "Current reasoning level",
			"contextWindow": "Context window",
			"maxToken": "Max tokens",
			"inputModes": "Input modes",
			"compatInfo": "Compat info",
			"balance": "Balance",
			"balanceName": "Balance",
			"refresh": "Refresh",
			"refreshing": "Refreshing…",
			"unknown": "Not provided",
			"window": "Window",
			"noSupportProvider": "Queries are not supported for this provider yet",
			"expiresOn": "Expires",
			"daysUnit": "d",
			"leftDays": "left",
			"queryFailed": "Query failed",
			"netUnreachable": "Network unreachable",
			"queryTimeout": "Query timed out",
			"httpRateLimited": "Rate limited (429)",
			"httpServerError": "Server error",
			"httpStatus": "HTTP status",
			"noApiKey": "No API Key configured",
			"subscriptionRequired": "Subscription not sufficient",
			"unauthorized": "Invalid key",
			"http404": "Wrong API address",
			"missingUsage": "No usage data",
			"noData": "No data",
			"insufficient": "(insufficient balance)",
			"rateLimited": "Rate limited",
			"noReset": "—",
			// 设置页
			"settings.toolkit": "Model Toolkit",
			"settings.toolkitDesc": "All settings live on the standalone page — open it with the button below.",
			"settings.toolkitOpen": "Open Model Toolkit ↗",
			// Window labels (shared by the hover popover columns and the collapsed rows)
			"quota.win.rolling": "5h",
			"quota.win.weekly": "wk",
			"quota.win.monthly": "mo",
		};
		/** 当前生效语言："system"（跟随 DSH）时读 DSH 当前语言；"en"/"zh" 为手动强制。 */
		let resolveLang = () => "zh";
		/** 按当前生效语言取词；key 缺失时原样返回（fail loud，不显示空白）。 */
		function tx(key) {
			const lang = resolveLang();
			const dict = lang === "en" ? en : zh;
			return dict[key] != null ? dict[key] : key;
		}

		// ---- 插件设置（持久化于 host 侧 json 文件）----
		const QSettings = { badgeAndQuota: true, hoverRefresh: true, autoRefreshOn: false, autoRefreshMin: 5, showMore: true, fontSize: 'middle', language: 'system' };
		/** 用 host 返回的设置覆盖本地镜像（缺字段保持现状）。 */
		function mergeSettings(s) {
			if (!s) return;
			// 总开关：只有显式 false 才算关（脏数据/缺字段回落默认 true）。
			QSettings.badgeAndQuota = s.badgeAndQuota !== false;
			if (typeof s.hoverRefresh === "boolean") QSettings.hoverRefresh = s.hoverRefresh;
			if (typeof s.autoRefreshOn === "boolean") QSettings.autoRefreshOn = s.autoRefreshOn;
			if (typeof s.autoRefreshMin === "number") QSettings.autoRefreshMin = s.autoRefreshMin;
			if (typeof s.showMore === "boolean") QSettings.showMore = s.showMore;
			if (s.fontSize === "large" || s.fontSize === "middle" || s.fontSize === "small") QSettings.fontSize = s.fontSize;
			if (s.language === "system" || s.language === "en" || s.language === "zh") QSettings.language = s.language;
		}
		/**
		 * 读一次设置：除更新本地镜像外，还 resolve 出 host 返回的原始设置对象
		 * （供「挂载时决定是否注册槽位」使用）。读失败 resolve null，调用方按默认（开）处理。
		 */
		function loadSettings(rpc) {
			try {
				return rpc.call("/api", "providerBadge/settings", { args: { request: { op: "get" } } }).then((resp) => {
					const s = resp && resp.ok && resp.value && resp.value.settings ? resp.value.settings : null;
					mergeSettings(s);
					return s;
				}).catch(() => null);
			} catch (e) { console.warn("[provider-badge] 读取设置失败", e); return Promise.resolve(null); }
		}

		//#region 共享余量存储：悬浮窗查询结果缓存（避免重复打厂商接口）
		// 悬浮窗查过的 provider 余量写在这里，同一 provider 的重复/并发查询直接复用。
		// host 端 providerBadge/balance 另有 5 分钟缓存，二者叠加避免频繁请求。
		const quotaShared = { rpc: null };
		const quotaCache = new Map(); // key: provider 路由键 -> { fetchedAt, value }
		// 客户端缓存 TTL，与 host 侧 providerBadge/balance 同语义（成功 5 分钟 / 失败 20 秒）。
		// 之前只存 fetchedAt 从不判过期，等于把 host 的 5 分钟 TTL 短路掉：关掉
		// 「显示悬浮窗自动刷新」后，同一 provider 会一直显示很久以前的老数字。
		const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000;
		const QUOTA_FAILURE_TTL_MS = 20 * 1000;
		/** 缓存值；超出 TTL（或时间戳异常）视为没有缓存，不复用。 */
		const quotaFresh = (c) => {
			if (!c || !c.value) return null;
			const ttl = c.value.error ? QUOTA_FAILURE_TTL_MS : QUOTA_CACHE_TTL_MS;
			const age = Date.now() - Number(c.fetchedAt);
			return age >= 0 && age < ttl ? c.value : null;
		};
		// 并发去重：同一 provider 的查询在途时就复用同一个 Promise，快速反复悬停不会堆请求。
		const quotaInflight = new Map(); // key: provider + '|' + force -> Promise
		/** 读当前缓存里的余量（不触发网络）——悬浮窗先据此立即渲染，避免“面板等网络”。 */
		const peekQuota = (provider) => quotaFresh(quotaCache.get(provider));
		/** 查询单个 provider 余量；命中 client 缓存直接回，命中后回写缓存；同键并发复用同一 Promise。 */
		async function fetchProviderQuota(provider, cfg, force) {
			if (!quotaShared.rpc) return null;
			const cached = quotaFresh(quotaCache.get(provider));
			if (!force && cached && cached.recognized && cached.supported && !cached.error) {
				return cached;
			}
			const inflightKey = provider + "|" + (force ? "force" : "cached");
			const running = quotaInflight.get(inflightKey);
			if (running) return running;
			const task = (async () => {
				try {
					const resp = await quotaShared.rpc.call("/api", "providerBadge/balance", {
						args: { request: { provider, baseURL: cfg && cfg.baseURL || null, apiKeyEnv: cfg && cfg.apiKeyEnv || null, force: !!force } }
					});
					const b = resp && resp.ok ? (resp.value || null) : null;
					if (b && b.recognized && b.supported && !b.error) {
						quotaCache.set(provider, { fetchedAt: Date.now(), value: b });
					} else {
						quotaCache.delete(provider);
					}
					return b;
				} catch (e) {
					console.warn("[provider-badge] 余量查询失败", e);
					quotaCache.delete(provider);
					return null;
				} finally {
					quotaInflight.delete(inflightKey);
				}
			})();
			quotaInflight.set(inflightKey, task);
			return task;
		}
		//#region 余量数据 → 统一文案（浮层各列与收起态共用同一套，保证同字同序）
		// host 返回统一结构：windows（套餐窗口）/ balance（余额）/ period（订阅到期）。
		// 渲染端只按「有哪些维度」渲染，不认识任何厂商名（见 ADR-0002）。
		const _num2 = (n) => { var v = Number(n); return v === v ? v.toFixed(2) : ""; };
		const _sym = (code) => code === "CNY" ? "¥" : code === "USD" ? "$" : code === "EUR" ? "€" : (code || "") + " ";
		/** 金额：币种符号 + 两位小数；无值返回空串。 */
		const moneyText = (currency, n) => {
			var v = Number(n);
			return (n === null || n === undefined || v !== v) ? "" : _sym(currency) + _num2(v);
		};
		/** 百分比：两位小数。 */
		const pctText = (n) => { var v = Number(n); return v === v ? v.toFixed(2) + "%" : ""; };
		/** 通用时长标签：厂商声明了非 5小时/周/月 的窗口时用它（如 5天 / 5d）。 */
		const durationLabel = (hours) => {
			var h = Number(hours);
			if (!(h > 0)) return null;
			var en2 = resolveLang() === "en";
			return h < 24 ? Math.round(h) + (en2 ? "h" : "小时") : Math.round(h / 24) + (en2 ? "d" : "天");
		};
		/** 窗口标签：常见档位走 i18n 周期名（5小时/周/月），否则按真实时长显示。 */
		const windowLabel = (w) => {
			var key = w && w.key;
			if (key) {
				var k = tx("quota.win." + key);
				if (k !== "quota.win." + key) return k;
			}
			return durationLabel(w && w.durationHours) || key || tx("window");
		};
		/** 窗口排序：按真实时长升序（5小时 → 周 → 月），缺失时长的排最后。 */
		const sortedWindows = (b) => ((b && b.windows) || []).slice().sort((a, c) => {
			var ha = a && a.durationHours != null ? a.durationHours : Infinity;
			var hc = c && c.durationHours != null ? c.durationHours : Infinity;
			return ha - hc;
		});
		/** 窗口重置倒计时（天/时/分）。 */
		const countdownStr = (resetsAt) => {
			if (!resetsAt) return null;
			var t = Date.parse(resetsAt);
			if (t !== t) return null;
			var diffMs = t - Date.now();
			if (diffMs <= 0) return null;
			var hours = Math.floor(diffMs / 3600000);
			var minutes = Math.floor((diffMs % 3600000) / 60000);
			if (hours > 24) return Math.floor(hours / 24) + "d" + (hours % 24) + "h";
			if (hours > 0) return hours + "h" + minutes + "m";
			return minutes + "m";
		};
		/**
		 * 一个窗口拆成三段：`pct`（比例）/ `money`（`已用/总额`，不带括号）/ `tail`（限流标记 + 重置倒计时）。
		 * 浮层拿这三段按列对齐渲染（见 gridCell / quotaGrid）。
		 * 金额与倒计时属于「更多信息」（`opts.more`，默认开）；每个窗口都带自己的重置倒计时，
		 * 「月」行也不例外——它的重置时刻与「到期」相同，但两行各给一半信息（月行＝还有多久，
		 * 到期行＝哪天），两行都留着才与 5小时 / 周 对齐。
		 */
		const windowCells = (w, opts) => {
			if (!w) return null;
			var more = !!(opts && opts.more);
			var pct = pctText(w.percent);
			var money = (more && pct && w.used != null && w.total != null)
				? moneyText(w.currency, w.used) + "/" + moneyText(w.currency, w.total)
				: "";
			var tail = [];
			if (w.rateLimited) tail.push(tx("rateLimited"));
			if (more && opts && opts.countdown) {
				// 厂商没给重置时间时（如 Command Code 的 5 小时窗还没被任何请求打开，接口回 resetAt: 0，
				// 或窗口已过期）给个占位，别让这一行的尾列空着——OpenCode Go 每行都有倒计时，两边看起来才一致。
				var cd = w.resetsAt ? countdownStr(w.resetsAt) : null;
				tail.push(cd || tx("noReset"));
			}
			return { pct: pct, money: money, tail: tail.join(" · ") };
		};
		/**
		 * 浮层的分列版：在三段之上决定「分隔点」放哪——某段后面还有内容时，该段以 ` ·` 结尾。
		 * 右对齐的单元格里，结尾字符天然对齐成一列，所以 `4.00%` 与 `77.00%` 宽度不同、
		 * 金额 `$0.48/$12.00` 与 `$46.20/$60.00` 长度不同，各列的点也不会错位。
		 */
		const windowColumns = (w, opts) => {
			var c = windowCells(w, opts);
			if (!c) return null;
			var pct = c.pct, money = c.money, tail = c.tail;
			if (tail && money) money += " ·";
			if ((money || tail) && pct) pct += " ·";
			return { pct: pct, money: money, tail: tail };
		};
		/**
		 * 收起态（不勾「显示更多信息」）的窗口行文本：只有比例，外加厂商给的限流标记，拼成一段。
		 * 收起态没有金额/倒计时列可对齐，所以整段作为一个右对齐的值渲染，
		 * 贴着浮层右边缘 —— 与「到期」以及上方「提供商 / 当前模型」各行的值对齐（见 balanceRows 的 cols）。
		 */
		const compactWindowText = (w) => {
			var c = windowCells(w, { more: false, countdown: false });
			if (!c) return "";
			return [c.pct, c.tail].filter(Boolean).join(" · ");
		};
		/** 余额（余额型）：按币种字母升序稳定显示（DeepSeek 接口的币种顺序不稳定），多币种用 " / " 连接。 */
		const balanceValue = (bal) => {
			var items = ((bal && bal.items) || []).slice()
				.sort((a, c) => String(a && a.currency || "").localeCompare(String(c && c.currency || "")));
			var parts = items.filter((i) => i && i.total != null).map((i) => moneyText(i.currency, i.total)).filter(Boolean);
			if (!parts.length) return "";
			return parts.join(" / ") + (bal.isAvailable === false ? tx("insufficient") : "");
		};
		/**
		 * 到期（订阅计费周期结束）：`2026-10-08`；「剩 28 天」属于「更多信息」（`opts.more`，默认开）。
		 * 「到期」行不参与窗口行的列对齐，按浮层普通的「标签 + 右对齐文本」行渲染。
		 */
		const periodValue = (p, opts) => {
			if (!p || !p.end) return "";
			var d = new Date(p.end);
			if (d.getTime() !== d.getTime()) return "";
			var pad2 = (n) => String(n).padStart(2, "0");
			var out = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
			if (opts && opts.more && p.daysLeft != null && p.daysLeft >= 0) out += " · " + tx("leftDays") + " " + p.daysLeft + tx("daysUnit");
			return out;
		};
		/**
		 * 出错 / 暂不支持 → 文案（浮层展示同一句话）。
		 * 兜底不再一律「查询失败」：把原始 error 拆成能指路的三类——网络不可达 / 查询超时 / HTTP 状态码。
		 * 用户看到「网络不可达」就知道该查代理或梯子，看到「请求过频（429）」就知道是厂商在限流，
		 * 而不是一句无从下手的「查询失败」（ADR-0001：显式失败，不静默、也不含混）。
		 */
		function quotaErrorText(b) {
			if (!b) return "";
			// 未识别厂商 / 已识别但暂不支持查询 → 统一提示「暂不支持查询当前提供商」。
			if (!b.supported || b.recognized === false) return tx("noSupportProvider");
			if (b.error === "no-api-key") return tx("noApiKey");
			if (b.error === "subscription-required") return tx("subscriptionRequired");
			if (b.error === "unauthorized") return tx("unauthorized");
			if (b.error === "http-404") return tx("http404");
			if (b.error === "missing-usage" || b.error === "missing-windows" || b.error === "no-data") return tx("missingUsage");
			if (b.error === "network") return tx("netUnreachable");
			if (b.error === "timeout") return tx("queryTimeout");
			var m = /^http-(\d{3})$/.exec(b.error || "");
			if (m) {
				var code = Number(m[1]);
				if (code === 429) return tx("httpRateLimited");
				return (code >= 500 ? tx("httpServerError") : tx("httpStatus")) + " " + code;
			}
			return tx("queryFailed");
		}
		//#endregion

		//#region 提供商徽章 + 悬浮信息浮层
		/** 徽章文本：显示名称优先，回退 Provider ID（提供商路由键）。 */
		function labelFor(value) {
			const current = value && value.current;
			const provider = current && current.provider;
			if (!provider) return null;
			const group = (value.groups || []).find((g) => g && g.id === provider);
			return (group && group.name) || provider;
		}
		let decoratorNoticeShown = false;
		/** 装饰失效的显式提示（ADR-0001：显式失败，不静默）。两种承载方式共用。 */
		function noticeDecoratorFailure() {
			if (decoratorNoticeShown) return;
			decoratorNoticeShown = true;
			const el = document.createElement("div");
			el.textContent = "provider 装饰失效";
			Object.assign(el.style, {
				position: "fixed", right: "16px", bottom: "16px", zIndex: 9999,
				padding: "6px 10px", borderRadius: "8px", fontSize: 12,
				color: "var(--dsw-alias-label-secondary)",
				background: "var(--dsw-alias-bg-layer-3)",
				border: "1px solid var(--dsw-alias-border-l2)"
			});
			document.body.appendChild(el);
		}

		/**
		 * 悬浮浮层控制器：拥有浮层 DOM、悬停状态机（唤起延迟 / 收起宽限 / 代际取消）、
		 * 渐进渲染与后台刷新。热区（徽章）与定位锚点由调用方提供，两种承载方式共用同一套逻辑：
		 *   ① 官方槽位 conversation.input.right 里的 React 徽章（推荐，见 makeSlotBadge）
		 *   ② 旧版 DSH 回退：往模型座按钮内注入 DOM 徽章（seatAnchorMode）
		 */
		function createTipController(opts) {
			const sessions = opts.sessions;
			const api = opts.api;
			const rpc = opts.rpc;
			const fixedSessionId = typeof opts.sessionId === "string" ? opts.sessionId : null;
			const getAnchor = opts.getAnchor || (() => null);   // 浮层定位锚点（模型座容器）
			const getHotzone = opts.getHotzone || (() => null); // 悬停热区（徽章元素）
			const seatAnchorMode = !!opts.seatAnchorMode;       // 徽章是否嵌在模型座按钮内（旧版回退路径）
			const SHOW_DELAY = 120;      // 悬停唤起延迟（数据已缓存时几乎无感）
			const HIDE_DELAY = 100;      // 移出后的宽限，便于顺势挪进浮窗
			const LEAVE_GRACE = 120;     // 旧版回退路径：从徽章移入按钮本体时的宽限
			const UNKNOWN = "未提供"; // 兼容外部引用（实际显示走 tx("unknown")）
			// 悬停会话代际：enter/leave/点击时自增；showTip 的每个 await 后校验，过期结果直接丢弃，
			// 从而避免“悬停时没反应、移开后请求回来才忽然弹出”。
			let showSeq = 0;
			// 缓存：provider 配置（settings.describe 的 llm-pi-ai.providers[provider]）与目录真值（rpc modelInfo）
			let providerCfgCache = null;
			let providerCfgKey = null;
			let modelInfoCache = null;
			let modelInfoKey = null;
			/** 只读缓存（不发请求）：悬浮窗先用缓存同步渲染，慢数据后台补齐。 */
			const peekProviderCfg = (provider) => (providerCfgCache && providerCfgKey === provider ? providerCfgCache : null);
			const peekModelInfo = (provider, model) => (modelInfoCache && modelInfoKey === provider + "/" + model ? modelInfoCache : null);

			// ---- 悬浮浮层 ----
			let tip = null;
			let showTimer = null;
			let hideTimer = null;
			// 方案1：记录鼠标是否在浮窗/按钮上（悬停区）。在悬停区内时滚动不隐藏浮窗。
			let hovering = false;
			// 手动刷新：当前余量区块容器与其上下文（provider/cfg），刷新时只重绘数据行。
			let lastBalanceBox = null;
			let lastBalanceCtx = null;

			const row = (label, value) => {
				const r = document.createElement("div");
				Object.assign(r.style, {
					display: "flex", justifyContent: "space-between", gap: "16px",
					padding: "2px 0", fontSize: 12, lineHeight: "18px",
					fontFamily: "var(--dsw-font-family-mono, monospace)"
				});
				const l = document.createElement("span");
				l.textContent = label;
				Object.assign(l.style, { color: "#8a93a5", flex: "none" });
				const v = document.createElement("span");
				v.textContent = value || UNKNOWN;
				Object.assign(v.style, { color: "#e6e9f0", flex: "1 1 auto", minWidth: "0", whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "right" });
				r.appendChild(l);
				r.appendChild(v);
				return r;
			};
			/** 网格里的一个单元格：标签列左对齐、值列右对齐；column/span 控制它落在哪几列。 */
			const gridCell = (text, opts) => {
				const el = document.createElement("span");
				const o = opts || {};
				el.textContent = text == null ? "" : String(text);
				Object.assign(el.style, {
					color: o.label ? "#8a93a5" : "#e6e9f0",
					textAlign: o.label ? "left" : "right",
					whiteSpace: "pre-wrap", wordBreak: "break-word",
					justifySelf: o.label ? "start" : "end",
					gridColumn: o.column != null ? String(o.column) : (o.span || "auto")
				});
				return el;
			};
			/**
			 * 余量区块的列对齐：cols=4 时 = 标签 | 比例 | 金额 | 尾列（限流标记 + 重置倒计时）。
			 * 所有行塞进同一个 grid 容器：列宽由最宽的一格决定，各列右边缘因此天然对齐；
			 * 某行缺列时留空格子（不挤位），跨列文案用 span 占满右侧几列。
			 * cols=2 是收起态（不勾「显示更多信息」）：只剩「标签 | 值」两列，值贴浮层右边缘——
			 * 若这时还留着空的后两列，两个 columnGap（10px×2）会把比例顶得离右边缘差 20px，
			 * 跟下面「到期」和上面「提供商 / 当前模型」各行的值对不齐。
			 */
			const quotaGrid = (rows, cols) => {
				const g = document.createElement("div");
				Object.assign(g.style, {
					display: "grid",
					gridTemplateColumns: cols === 2
						? "max-content minmax(0, 1fr)"
						: "max-content minmax(0, 1fr) minmax(0, max-content) minmax(0, max-content)",
					columnGap: "10px", rowGap: "2px", alignItems: "baseline",
					fontSize: 12, lineHeight: "18px",
					fontFamily: "var(--dsw-font-family-mono, monospace)"
				});
				for (var i = 0; i < rows.length; i++) for (var j = 0; j < rows[i].length; j++) g.appendChild(rows[i][j]);
				return g;
			};
			const heading = (text) => {
				const h = document.createElement("div");
				h.textContent = text;
				Object.assign(h.style, {
					margin: "6px 0 4px", fontSize: 11, fontWeight: 600,
					color: "#aab2c0", letterSpacing: ".02em"
				});
				return h;
			};
			const ensureTip = () => {
				if (tip) return tip;
				tip = document.createElement("div");
				tip.setAttribute("data-provider-badge-tip", "");
				Object.assign(tip.style, {
					position: "fixed", zIndex: 99999, display: "none",
					minWidth: "220px", maxWidth: "360px", padding: "8px 12px",
					borderRadius: "10px", fontSize: 12, lineHeight: "18px",
					color: "#e6e9f0",
					background: "#1f2430",
					border: "1px solid #2c3242",
					boxShadow: "0 6px 24px rgba(0,0,0,.28)",
					maxHeight: "calc(100vh - 120px)", overflowY: "auto", overflowX: "hidden"
				});
				document.body.appendChild(tip);
				// 浮窗自身也监听鼠标：悬停到浮窗上时保持显示（可停留、可点刷新）。
				tip.addEventListener("mouseenter", () => {
					hovering = true;
					if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
				});
				tip.addEventListener("mouseleave", () => {
					hovering = false;
					if (hideTimer) clearTimeout(hideTimer);
					hideTimer = setTimeout(() => { if (!hovering) hideTip(); }, HIDE_DELAY);
				});
				return tip;
			};
			const position = (anchor) => {
				const r = anchor.getBoundingClientRect();
				const t = ensureTip();
				const vw = window.innerWidth, vh = window.innerHeight;
				const m = /scale\((\d+(?:\.\d+)?)\)/.exec(t.style.transform || "");
				const scale = m ? parseFloat(m[1]) : 1;
				const GAP = 8;
				const aboveSpace = r.top - GAP;          // 选择器上方可用高度
				const belowSpace = vh - r.bottom - GAP;  // 选择器下方可用高度
				let top, origin;
				if (aboveSpace >= 140) {
					// 上方优先：面板永远贴选择器上方 —— 限高=上方可用÷缩放系数（保证视觉高度不超），
					// 底边贴选择器顶（transform-origin: bottom center → 大中小的视觉底边都贴在选择器上），
					// 面板放不下就在面板内滚动，绝不挪到别处。
					// 视觉顶/底都留 8px：th*scale ≤ aboveSpace-16，保证缩放后视觉完全不超屏
					const capH = Math.max(60, Math.min(vh - 16, Math.floor((aboveSpace - 16) / scale)));
					t.style.maxHeight = capH + "px";
					const th = t.offsetHeight || 0;
					top = r.top - th - GAP;
					origin = "bottom center";
				} else {
					// 选择器几乎贴屏顶：才放选择器下方，同样限高+贴边
					const capH = Math.max(60, Math.min(vh - 16, Math.floor((belowSpace - 16) / scale)));
					t.style.maxHeight = capH + "px";
					const th = t.offsetHeight || 0;
					top = r.bottom + GAP;
					origin = "top center";
				}
				const tw = t.offsetWidth || 0;
				let left = r.left + r.width / 2 - tw / 2;
				left = Math.max(8, Math.min(left, vw - tw - 8));
				t.style.transformOrigin = origin;
				t.style.left = left + "px";
				t.style.top = top + "px";
			};

			const resolveProviderCfg = async (provider) => {
				if (providerCfgCache && providerCfgKey === provider) return providerCfgCache;
				try {
					const { result } = await api.settings.describe({});
					const cfg = result && result.ok
						? (result.value.namespaces || []).find((n) => n && n.ns === "llm-pi-ai")?.value?.providers?.[provider]
						: null;
					providerCfgCache = cfg || null;
					providerCfgKey = provider;
					return providerCfgCache;
				} catch (e) {
					console.warn("[provider-badge] describe 失败", e);
					return null;
				}
			};
			const resolveModelInfo = async (provider, model) => {
				const key = provider + "/" + model;
				if (modelInfoCache && modelInfoKey === key) return modelInfoCache;
				try {
					const resp = await rpc.call("/api", "providerBadge/modelInfo", { args: { request: { provider, model } } });
					const mi = resp && resp.ok ? (resp.value || null) : null;
					modelInfoCache = mi;
					modelInfoKey = key;
					return mi;
				} catch (e) {
					console.warn("[provider-badge] modelInfo 失败", e);
					return null;
				}
			};

			// ---- 余量（余额 / 套餐窗口 / 到期）----
			// 识图开启时，`value.current.provider` 会被 DSH 分流成一个合成 provider（如 `ocgo-02-vision`），
			// 它在 `llm-pi-ai.providers` 里没有配置条目（baseURL 取不到），导致家族识别失败、余量不展示。
			// 余量识别应始终基于「主模型座选中的主 provider」，而不是识图分流出的 vision provider：
			// 剥掉 `-vision` 等后缀还原主 provider，用主 provider 的配置去识别厂商 + 查询余量。
			// 注意：仅用于余量查询，不影响浮层里 Provider ID / 显示名称 / API 地址等任何页面显示。
			const bareProvider = (provider) => {
				if (typeof provider !== "string" || !provider) return provider;
				return provider.replace(/(?:-vision|-vision-exp|-vision-preview|-vision-latest)$/i, "");
			};
			// 悬浮窗余量查询：直接走模块级共享存储（同 provider 复用缓存，不重复出网）。
			const resolveBalance = (provider, cfg, force) => fetchProviderQuota(provider, cfg, force);
			/**
			 * 余量浮层区块：按「有哪些维度」渲染 —— 窗口行（5小时 → 周 → 月）→ 余额行 → 到期行。
			 * 这里不认识任何厂商名；套餐型与充值型的区别只体现在返回了哪些维度（见 ADR-0002）。
			 * 「显示更多信息」关闭时，窗口只留比例数字、到期只留日期（见 setShowMore）。
			 */
			const balanceRows = (b) => {
				if (!b) return null;
				// 暂不支持查询 / 出错：标签 + 状态文案（文案占满右侧）。
				if (!b.supported || b.error) {
					return [quotaGrid([[gridCell(tx("balance"), { label: true }), gridCell(quotaErrorText(b), { span: "2 / -1" })]], 2)];
				}
				var more = QSettings.showMore;
				// 网格列数跟着模式走：勾了「显示更多信息」是四列（标签 | 比例 | 金额 | 倒计时），
				// 没勾就只有两列 —— 收起态的比例要贴右边缘，与「到期」和上方各行的值对齐。
				var cols = more ? 4 : 2;
				var grid = [];
				var wins = sortedWindows(b);
				for (var i = 0; i < wins.length; i++) {
					var w = wins[i];
					if (!more) {
						// 收起态：比例（含「已限流」标记）作为一个值右对齐，没有金额/倒计时列。
						grid.push([gridCell(windowLabel(w), { label: true }), gridCell(compactWindowText(w) || tx("noData"), { span: "2 / -1" })]);
						continue;
					}
					var c = windowColumns(w, { more: more, countdown: true });
					var pct = c ? c.pct : "";
					var money = c ? c.money : "";
					var tail = c ? c.tail : "";
					if (!pct && !money && !tail) {
						grid.push([gridCell(windowLabel(w), { label: true }), gridCell(tx("noData"), { span: "2 / -1" })]);
						continue;
					}
					grid.push([
						gridCell(windowLabel(w), { label: true }),
						gridCell(pct, { column: 2 }),
						gridCell(money, { column: 3 }),
						gridCell(tail, { column: 4 })
					]);
				}
				var balText = balanceValue(b.balance);
				if (balText) grid.push([gridCell(tx("balanceName"), { label: true }), gridCell(balText, { span: "2 / -1" })]);
				var out = grid.length ? [quotaGrid(grid, cols)] : [];
				// 到期不参与窗口列的网格对齐：单独一行、标签在左、文本右对齐（与浮层其它区块的行式一致）。
				var perText = periodValue(b.period, { more: more });
				if (perText) out.push(row(tx("expiresOn"), perText));
				// 什么数据都没有时给一行「无数据」，避免空白区块。
				if (!out.length) out.push(quotaGrid([[gridCell(tx("balance"), { label: true }), gridCell(tx("noData"), { span: "2 / -1" })]], 2));
				return out;
			};

			// 余量区块的 DOM：balanceRows 直接返回现成元素（单个 4 列网格容器），透传即可。
			const buildRowEls = (b) => balanceRows(b);
			// 点「刷新」：绕过 client + host 缓存，强制重新查询，并只重绘余量数据行。
			const onRefreshBalance = async () => {
				const ctx2 = lastBalanceCtx;
				if (!ctx2 || !lastBalanceBox) return;
				const btn = lastBalanceBox.btn;
				if (btn) btn.textContent = tx("refreshing");
				try {
					const bal = await resolveBalance(ctx2.provider, ctx2.cfg, true);
					lastBalanceBox.body.innerHTML = "";
					const els = bal ? buildRowEls(bal) : null;
					if (els && els.length) {
						for (var i = 0; i < els.length; i++) lastBalanceBox.body.appendChild(els[i]);
					} else {
						lastBalanceBox.body.appendChild(row(tx("balance"), tx("queryFailed")));
					}
				} catch (e) {
					console.warn("[provider-badge] 刷新余量失败", e);
					lastBalanceBox.body.innerHTML = "";
					lastBalanceBox.body.appendChild(row(tx("balance"), tx("queryFailed")));
				} finally {
					if (btn) btn.textContent = tx("refresh");
				}
			};
			// 在浮窗里挂载「余量」区块：标题行（含刷新按钮）+ 数据行。
			// 返回容器元素，刷新时可只重绘数据行、不扰动浮窗其它内容。
			const mountBalanceBlock = (t) => {
				const box = document.createElement("div");
				const head = document.createElement("div");
				Object.assign(head.style, {
					display: "flex", alignItems: "center", gap: "2px",
					margin: "6px 0 4px", fontSize: 11, fontWeight: 600, color: "#aab2c0", letterSpacing: ".02em"
				});
				const label = document.createElement("span");
				label.textContent = tx("balance");
				const btn = document.createElement("button");
				btn.textContent = tx("refresh");
				// 刷新按钮紧跟「余量」文字（红框位置），不再右对齐。
				Object.assign(btn.style, {
					marginLeft: "0", padding: "0 4px", fontSize: 10, lineHeight: "14px", cursor: "pointer",
					color: "var(--dsw-alias-label-secondary)", background: "transparent",
					border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 6
				});
				btn.addEventListener("click", onRefreshBalance);
				head.appendChild(label);
				head.appendChild(btn);
				const body = document.createElement("div");
				Object.assign(body.style, { display: "block" });
				box.appendChild(head);
				box.appendChild(body);
				t.appendChild(box);
				return { box, body, btn };
			};
			// 同步渲染面板：只用手上已有的数据（内存缓存），不发任何请求 —— 保证悬停立刻可见。
			// bal 为 null 且 balancePending 时，余量区块先渲染「刷新中…」占位，后台查询回来再重绘。
			const renderTip = (value, cfg, mi, bal, balancePending, balanceProvider, balanceCfg) => {
				const provider = value.current.provider;
				const model = value.current.model;
				const group = (value.groups || []).find((g) => g && g.id === provider);
				const modelEntry = group && group.models
					? (group.models || []).find((m) => m && m.id === model)
					: null;
				const efforts = (modelEntry && modelEntry.reasoning && modelEntry.reasoning.efforts) || [];
				const currentEffortId = value.current.reasoningEffort || (modelEntry && modelEntry.reasoning && modelEntry.reasoning.defaultEffort);
				const currentEffort = efforts.find((e) => e && e.id === currentEffortId);
				const effortLabel = (currentEffort && currentEffort.name) || currentEffortId || "Default";
				const compatObj = (cfg && cfg.models && cfg.models.find && cfg.models.find((m) => m && m.id === model)?.compat);
				const compatText = compatObj && typeof compatObj === "object" && Object.keys(compatObj).length > 0
					? JSON.stringify(compatObj)
					: null;

				const t = ensureTip();
				t.innerHTML = "";
				t.appendChild(heading(tx("provider")));
				t.appendChild(row(tx("displayName"), (group && group.name) || provider));
				t.appendChild(row("Provider ID", provider));
				t.appendChild(row(tx("apiProtocol"), cfg && cfg.api || null));
				t.appendChild(row(tx("apiAddress"), cfg && cfg.baseURL || null));
				t.appendChild(row(tx("apiKeyEnv"), cfg && cfg.apiKeyEnv || null));
				t.appendChild(heading(tx("currentModel")));
				t.appendChild(row(tx("modelId"), model));
				t.appendChild(row(tx("modelDisplayName"), (modelEntry && modelEntry.name) || model));
				t.appendChild(row(tx("modelDescription"), modelEntry && modelEntry.description || null));
				t.appendChild(row(tx("reasoningLevel"), efforts.map((e) => e && e.name || e.id).join(" / ") || null));
				t.appendChild(row(tx("currentReasoningLevel"), effortLabel));
				t.appendChild(row(tx("contextWindow"), mi && mi.contextWindow != null ? String(mi.contextWindow) : null));
				t.appendChild(row(tx("maxToken"), mi && mi.maxTokens != null ? String(mi.maxTokens) : null));
				t.appendChild(row(tx("inputModes"), mi && mi.input && mi.input.length ? mi.input.join(" / ") : null));
				t.appendChild(row(tx("compatInfo"), compatText));
				// ---- 余量（余额/限额）----
				// 识别用 provider 与展示用 provider 解耦：识图开启时 current.provider 是 `xxx-vision`，
				// 这里剥掉 -vision 后缀还原主 provider，用主 provider 的配置（baseURL/密钥）去识别厂商并查余量；
				// 浮层上方的 Provider ID / 显示名称 / API 地址 / 密钥等展示字段仍用原始 provider，不受影响。
				if (bal || balancePending) {
					const mb = mountBalanceBlock(t);
					lastBalanceBox = mb;
					lastBalanceCtx = { provider: balanceProvider, cfg: balanceCfg };
					if (bal) {
						const els = buildRowEls(bal);
						if (els && els.length) {
							for (var bi = 0; bi < els.length; bi++) mb.body.appendChild(els[bi]);
						} else {
							mb.body.appendChild(row(tx("balance"), tx("queryFailed")));
						}
					} else {
						// 首次查询/后台强刷尚未回来：先给占位，回来后再重绘，避免“悬停没反应”。
						mb.body.appendChild(row(tx("balance"), tx("refreshing")));
					}
				}

				// 字体大小：大/中/小。用 transform scale + transform-origin: bottom center —— 缩放以「底边中心」（贴住模型选择器的那条边）为原点，
				// 这样无论大中小，面板底边都始终贴着选择器，不会像 zoom（左上角为原点）一样切换时位置飘移。
				t.style.transform = QSettings.fontSize === "large" ? "scale(1.15)" : QSettings.fontSize === "small" ? "scale(0.85)" : "scale(1)";
				t.style.display = "block";
				// 锚定模型选择器容器（无则退化为徽章本身）：弹窗紧贴选择器上方，水平与它中心对齐。
				position(getAnchor() || getHotzone());
			};

			/**
			 * 悬停唤起浮层：先同步渲染（缓存命中即时可见），慢数据（首次的 provider 配置 / 目录真值 /
			 * 余量）在后台补齐后重绘。每个 await 后都用 seq 校验悬停会话是否仍有效，过期即丢弃。
			 */
			const showTip = async (seq) => {
				if (!getHotzone()) return;
				const live = () => seq === showSeq && hovering;
				try {
					const sessionId = fixedSessionId || sessions.list.getSnapshot().current;
					if (typeof sessionId !== "string") return;
					const { result } = await api.sessions.models({ sessionId });
					if (!live()) return;
					const value = result && result.ok ? result.value : null;
					if (!value || !value.current) return;
					const provider = value.current.provider;
					const model = value.current.model;
					const balanceProvider = bareProvider(provider);

					// 1) 先渲染：全部来自内存缓存，不发请求（首次未缓存的行显示“未提供”，余量显示“刷新中…”）。
					const cfgCached = peekProviderCfg(provider);
					const miCached = peekModelInfo(provider, model);
					const balCached = peekQuota(balanceProvider);
					const needCfg = !cfgCached;
					const needMi = !miCached;
					// 开了「悬停自动刷新」时即使有缓存也要后台强刷一次（不阻塞显示）。
					const needBal = !balCached || !!QSettings.hoverRefresh;
					renderTip(value, cfgCached, miCached, balCached, needBal, balanceProvider,
						balanceProvider === provider ? cfgCached : null);
					if (!needCfg && !needMi && !needBal) return; // 全命中：到此为止（丝滑路径）

					// 2) 后台补齐/刷新；任何一个 await 之后鼠标已离开就丢弃，绝不“移出后忽然弹出”。
					const cfg = cfgCached || await resolveProviderCfg(provider);
					if (!live()) return;
					const mi = miCached || await resolveModelInfo(provider, model);
					if (!live()) return;
					const balanceCfg = balanceProvider === provider ? cfg : await resolveProviderCfg(balanceProvider);
					if (!live()) return;
					let bal = balCached;
					if (needBal) {
						bal = await resolveBalance(balanceProvider, balanceCfg, !!QSettings.hoverRefresh);
						if (!live()) return;
					}
					renderTip(value, cfg, mi, bal, false, balanceProvider, balanceCfg);
				} catch (e) {
					console.warn("[provider-badge] 浮层刷新失败", e);
				}
			};
			const hideTip = () => {
				if (tip) tip.style.display = "none";
			};
			//#region 悬停事件的节点判定（relatedTarget / target 不保证是 Node）
			// 原生鼠标事件的 relatedTarget 在「指针移出页面」时不可靠：移到浏览器 UI / DevTools /
			// 另一个窗口时，Chrome 会给出 window 这类**非 Node** 的 EventTarget，React 的合成事件
			// 原样透传。而 Node.contains() 只接受 Node，传进去会抛
			// 「Failed to execute 'contains' on 'Node': parameter 1 is not of type 'Node'」——
			// 一旦在 onLeave 里抛出，后面的 hovering=false / showSeq++ / 收起定时器全都不会执行，
			// 状态机就卡在「还悬停着」：浮层不消失、过期悬停会话也不再作废（"移开后忽然弹出"复发）。
			// 所以凡是要 contains 的入参先过这道判定（用 nodeType 而不是 instanceof Node：
			// 跨 realm 的节点 instanceof 会误判，nodeType 不会）。
			const isNodeLike = (x) => !!x && typeof x === "object" && typeof x.nodeType === "number";
			const containsNode = (root, n) => !!(root && isNodeLike(n) && typeof root.contains === "function" && root.contains(n));
			//#endregion
			// 悬浮热区只绑在提供商徽章小标签上：悬停标签才弹浮窗；
			// 移向按钮本体短暂宽限（LEAVE_GRACE）后收起——避免标签小、擦边就丢悬停；
			// 若模型下拉已展开（aria-expanded=true）则立即收起，绝不遮挡正在选的菜单。
			const onEnter = () => {
				hovering = true;
				if (hideTimer) clearTimeout(hideTimer);
				hideTimer = null;
				if (showTimer) clearTimeout(showTimer);
				const seq = ++showSeq; // 本次悬停会话的代际
				showTimer = setTimeout(() => { showTimer = null; showTip(seq); }, SHOW_DELAY);
			};
			const onLeave = (e) => {
				const next = e && e.relatedTarget;
				const intoTip = !!(tip && next && (next === tip || containsNode(tip, next)));
				hovering = false;
				if (showTimer) clearTimeout(showTimer);
				showTimer = null;
				if (hideTimer) clearTimeout(hideTimer);
				hideTimer = null;
				// 只要不是挪进浮窗，就结束本次悬停会话：在途的 showTip 结果一律作废，
				// 这样不会出现“悬停时没反应、移开后请求回来才忽然弹出”。
				if (!intoTip) showSeq++;
				const anchorEl = getAnchor();
				const stayingOnSeat = !!(seatAnchorMode && anchorEl && (next === anchorEl || containsNode(anchorEl, next)));
				if (stayingOnSeat) {
					const menuOpen = !!(anchorEl.getAttribute && anchorEl.getAttribute("aria-expanded") === "true");
					if (menuOpen) { hideTip(); return; }
					hideTimer = setTimeout(() => { if (!hovering) hideTip(); }, LEAVE_GRACE);
					return;
				}
				hideTimer = setTimeout(() => { if (!hovering) hideTip(); }, HIDE_DELAY);
			};
			// 滚动/尺寸变化：鼠标不在悬停区（浮窗/徽章）时隐藏，避免浮层错位；停在浮窗上时滚动不打断。
			const onWindowScroll = () => { if (!hovering) hideTip(); };
			const safeAdd = (target, type, fn, opts) => { try { target.addEventListener(type, fn, opts); return true; } catch (e) { return false; } };
			const safeRemove = (target, type, fn, opts) => { try { target.removeEventListener(type, fn, opts); } catch (e) { /* 忽略 */ } };
			safeAdd(window, "scroll", onWindowScroll, { passive: true, capture: true });
			safeAdd(window, "resize", hideTip);
			// 点击浮窗与“正在操作的模型座”之外的任何位置 → 立即收起。
			// 注意：旧版回退路径里徽章嵌在按钮内部，点它也会冒泡打开模型下拉，所以点锚点内一律收起。
			const onDocMouseDown = (ev) => {
				const target = ev && ev.target;
				const hot = getHotzone();
				const anchorEl = getAnchor();
				const inTip = containsNode(tip, target);
				if (inTip) return;
				const inHot = !!(hot && (hot === target || containsNode(hot, target)));
				const inSeat = !!(seatAnchorMode && anchorEl && (target === anchorEl || containsNode(anchorEl, target)));
				if (inHot && !inSeat) return;
				hovering = false;
				showSeq++;
				if (showTimer) { clearTimeout(showTimer); showTimer = null; }
				if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
				hideTip();
			};
			safeAdd(document, "mousedown", onDocMouseDown, true);
			// 读取持久化设置（悬停立即刷新 / 自动刷新间隔），并开启自动刷新调度。
			loadSettings(rpc);
			// 自调度 setTimeout：每次循环重新读取当前间隔与开关，改设置后无需重启即生效。
			const scheduleAutoRefresh = () => {
				const minutes = Math.max(1, QSettings.autoRefreshMin || 5);
				setTimeout(() => {
					try {
						if (QSettings.autoRefreshOn && tip && tip.style.display === "block" && lastBalanceCtx && lastBalanceBox) onRefreshBalance();
					} catch (e) { console.warn("[provider-badge] 自动刷新失败", e); }
					scheduleAutoRefresh();
				}, minutes * 60 * 1000);
			};
			scheduleAutoRefresh();
			return {
				onEnter,
				onLeave,
				hide: () => {
					hovering = false;
					showSeq++;
					if (showTimer) { clearTimeout(showTimer); showTimer = null; }
					if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
					hideTip();
				},
				isVisible: () => !!(tip && tip.style.display === "block"),
				dispose: () => {
					if (showTimer) clearTimeout(showTimer);
					if (hideTimer) clearTimeout(hideTimer);
					showSeq++;
					safeRemove(document, "mousedown", onDocMouseDown, true);
					safeRemove(window, "scroll", onWindowScroll, true);
					safeRemove(window, "resize", hideTip);
					if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
					tip = null;
				}
			};
		}

		/**
		 * 旧版 DSH 回退承载：往模型座按钮内注入 DOM 徽章 + 轮询文本。
		 * 新版走官方槽位（makeSlotBadge）；仅当槽位不可用（旧版没有该槽）时才走这里。
		 */
		function installProviderBadge(sessions, api, rpc) {
			const SLOT = '[data-slot="conversation.input.model"]';
			const ATTACH_CHECK_MS = 300;
			let badge = null;
			let badgeLabel = null;
			let seatBtnEl = null;
			let lastText = null;
			const controller = createTipController({
				sessions, api, rpc,
				seatAnchorMode: true,
				getAnchor: () => seatBtnEl,
				getHotzone: () => badge
			});
			const onEnter = () => controller.onEnter();
			const onLeave = (e) => controller.onLeave(e);
			let boundEl = null;
			const attachHover = (el) => {
				if (boundEl === el) return;
				if (boundEl) {
					boundEl.removeEventListener("mouseenter", onEnter);
					boundEl.removeEventListener("mouseleave", onLeave);
				}
				boundEl = el;
				el.addEventListener("mouseenter", onEnter);
				el.addEventListener("mouseleave", onLeave);
			};
			// ---- 徽章 + 悬停挂载 ----
			const tick = async () => {
				try {
					const seatBtn = document.querySelector(SLOT + " button");
					if (!seatBtn) return;
					seatBtnEl = seatBtn;
					if (!badge) {
						badge = document.createElement("span");
						// 与官方槽位徽章（makeSlotBadge）保持同一套 V14「键帽」样式，
						// 避免旧版 DSH 回退到本路径时观感不一致。
						Object.assign(badge.style, {
							display: "inline-flex", alignItems: "center", flex: "none",
							position: "relative", boxSizing: "border-box",
							padding: "1px 5px", minHeight: "17px", borderRadius: 4, fontSize: 10, lineHeight: "14px",
							color: "var(--dsw-alias-label-secondary)",
							background: "var(--dsw-alias-bg-layer-3)",
							border: "0.5px solid var(--dsw-alias-border-l2)",
							boxShadow: "0 1px 0 var(--dsw-alias-border-l3)",
							fontWeight: 600,
							whiteSpace: "nowrap"
						});
						// 透明外扩热区：视觉不变、命中范围各方向 +6px，避免标签太小“擦边即丢悬停”。
						const hit = document.createElement("span");
						Object.assign(hit.style, { position: "absolute", left: "-6px", right: "-6px", top: "-6px", bottom: "-6px" });
						badge.appendChild(hit);
						// 文本单独一个子节点：tick 只改它的内容，不会把热区节点一起清掉。
						badgeLabel = document.createElement("span");
						Object.assign(badgeLabel.style, { position: "relative", pointerEvents: "none" });
						badge.appendChild(badgeLabel);
					}
					if (badge.parentNode !== seatBtn) seatBtn.insertBefore(badge, seatBtn.firstChild);
					attachHover(badge);
					const sessionId = sessions.list.getSnapshot().current;
					if (typeof sessionId !== "string") return;
					const { result } = await api.sessions.models({ sessionId });
					const text = result && result.ok ? labelFor(result.value) : null;
					if (badgeLabel) badgeLabel.textContent = text || ""; else badge.textContent = text || "";
					if ((text || null) !== lastText) {
						lastText = text || null;
						if (!text) noticeDecoratorFailure();
					}
				} catch (e) {
					console.warn("[provider-badge] tick 失败", e);
					noticeDecoratorFailure();
				}
			};
			// 徽章存在性轻量看护：React 重挂/会话切换会把外来节点摘掉，尽快补回。
			const ensureBadgeAttached = () => {
				try {
					const seatBtn = document.querySelector(SLOT + " button");
					if (!seatBtn || !badge) return;
					if (seatBtnEl !== seatBtn) seatBtnEl = seatBtn;
					if (badge.parentNode !== seatBtn) seatBtn.insertBefore(badge, seatBtn.firstChild);
				} catch (e) { /* 忽略：下一轮再看护 */ }
			};
			setInterval(ensureBadgeAttached, ATTACH_CHECK_MS);
			// 2s 轮询（最简形态，不耦合 React 生命周期）：刷新徽章文本 + 兜底补挂。
			setInterval(tick, 2000);
			tick();
		}

		/**
		 * 徽章与模型座的实际间距。
		 * DSH 的 InputBar `.trailing` 容器（徽章与模型座的共同父级）是 `gap: 12px`；
		 * 槽位锚点 `<div data-slot=… style="display:contents">` 不产生盒子，所以徽章就是该
		 * flex 行的直接子项 —— 用负 margin-right 抵消掉多余部分，把 12px 压到 2px。
		 * 改成其他值：目标间距 = 12 - BADGE_GAP_PULL（2px → 10，4px → 8，6px → 6）。
		 */
		const BADGE_GAP_PULL = 10;

		/**
		 * 官方槽位承载（推荐）：徽章作为 conversation.input.right 的贡献项 —— 模型座左侧的官方空槽。
		 * 位置与排列完全交给 DSH（槽位锚点是 display:contents，徽章成为 trailing flex 行里的一项），
		 * 徽章不再是模型按钮的一部分；文本订阅模型目录 store 变化，浮层复用 createTipController。
		 */
		function makeSlotBadge(sessions, api, rpc) {
			return function ProviderBadge(props) {
				const sessionId = props && props.sessionId;
				const hostRef = React.useRef(null);
				const controllerRef = React.useRef(null);
				const [text, setText] = React.useState("");
				React.useEffect(() => {
					const controller = createTipController({
						sessions, api, rpc, sessionId,
						// 锚点优先用模型座（保持“紧贴选择器上方”的观感），取不到时退化为徽章自身。
						getAnchor: () => document.querySelector('[data-slot="conversation.input.model"] button') || hostRef.current,
						getHotzone: () => hostRef.current
					});
					controllerRef.current = controller;
					return () => { controllerRef.current = null; controller.dispose(); };
				}, []);
				React.useEffect(() => {
					let alive = true;
					let reading = false;
					const currentId = () => (typeof sessionId === "string" ? sessionId : sessions.list.getSnapshot().current);
					const apply = (result) => {
						if (!alive) return;
						setText(result && result.ok ? (labelFor(result.value) || "") : "");
					};
					// 订阅回调必须**只读**：绝不能调用会写 store 的 models()（它在状态 ≠ ready 时会
					// await directory.load()，而 load() 必然重新发布状态且把 selecting 原样写回），
					// 否则「通知 → load → 再通知」会形成纯微任务的自持循环，饿死事件循环。
					// reading 闸门是纯防御：被通知期间 store 可能再次发布，重入直接丢弃。
					const read = () => {
						if (reading) return;
						reading = true;
						const id = currentId();
						if (typeof id !== "string") { reading = false; return; }
						if (typeof api.modelsSnapshot === "function") {
							try { apply(api.modelsSnapshot({ sessionId: id }).result); }
							catch (e) { /* 目录尚未就绪：保持现状，等下一次通知 */ }
							reading = false;
							return;
						}
						// 旧版数据源没有只读入口：异步读取，只用于 2s 轮询兜底（宏任务，不会重入）。
						api.sessions.models({ sessionId: id }).then(
							({ result }) => { apply(result); reading = false; },
							() => { reading = false; }
						);
					};
					read();
					// 目录 store 变化即刷新（比轮询即时）；旧版数据源没有 subscribe 时退回 2s 轮询。
					let unsubscribe = null;
					try { if (api.subscribe) unsubscribe = api.subscribe(currentId(), read); } catch (e) { unsubscribe = null; }
					const timer = unsubscribe ? null : setInterval(read, 2000);
					return () => { alive = false; if (unsubscribe) unsubscribe(); if (timer) clearInterval(timer); };
				}, [sessionId]);
				if (!text) return null;
				return React.createElement("span", {
					ref: hostRef,
					"data-provider-badge": "",
					title: text,
					// 样式候选 V14「键帽（kbd）」，按反馈收紧一档：整体更小、描边更细、字重更强。
					// 几何：14px 行高 + 1px×2 内边距 + 0.5px×2 描边 = 17px，正好等于 minHeight，盒子不虚高。
					// 描边 0.5px 是 DSH 自己的惯例（主题包内多处 .5px solid），比 1px 更轻、不抢模型座。
					// 字重 600 用于补偿缩小后的字号：10px 下 500 会发虚，600 才能保持笔画清晰。
					style: {
						display: "inline-flex", alignItems: "center", flex: "none",
						marginRight: -BADGE_GAP_PULL,
						padding: "1px 5px", minHeight: "17px", borderRadius: 4, fontSize: 10, lineHeight: "14px",
						color: "var(--dsw-alias-label-secondary)",
						background: "var(--dsw-alias-bg-layer-3)",
						border: "0.5px solid var(--dsw-alias-border-l2)",
						boxShadow: "0 1px 0 var(--dsw-alias-border-l3)",
						fontWeight: 600,
						whiteSpace: "nowrap", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis",
						cursor: "default"
					},
					onMouseEnter: () => { if (controllerRef.current) controllerRef.current.onEnter(); },
					onMouseLeave: (e) => { if (controllerRef.current) controllerRef.current.onLeave(e); }
				}, text);
			};
		}
		//#region 模型标签：子智能体浮层行 / 助手轮尾 / 用户消息行（纯追加 DOM）
		/**
		 * 设计约束（与官方槽位徽章完全解耦）：
		 *  - 只往官方节点里**追加**我们自己的 span：不删、不改、不遮蔽任何官方节点；
		 *  - 命中判断只用稳定属性：role / aria-label / data-clock / data-turn-tail /
		 *    data-chat-turn；必要时用 CSS Module 类名的**后缀**（_content/_summary/_metrics），
		 *    不用带哈希前缀的整串类名（每次构建都会变）；
		 *  - 拿不到数据、接口 404、会话 id 缺失一律静默降级（不显示、不刷屏，只记一次日志）；
		 *  - 每轮渲染都是「对账」：本轮没触达的标签全部移除 —— 重复触发不会重复，关开关即清空。
		 */
		const ML_ATTR = "data-dsh-model-label";
		const ML_TEXT_ATTR = "data-dsh-model-label-text";
		const ML_EXTERNAL_ATTR = "data-dsh-model-label-external";
		const ML_API_BASE = "/dsh-model-toolkit/api";
		const ML_TICK_MS = 3000;              // 运行中行的兜底刷新间隔
		const ML_CACHE_KEY = "dsh-model-label-cache-v1";   // 会话 id → 上一份取数结果（跨刷新保留）
		const ML_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 缓存最长存活 7 天
		const ML_CACHE_MAX_SESSIONS = 12;                  // 最多记 12 个会话，超出丢最旧的
		const ML_CACHE_FRESH_MS = 60 * 1000;               // 60 秒内的缓存视为“新鲜”，只渲染不打接口
		const ML_DEBOUNCE_MS = 16;            // MutationObserver 合并窗口：压到一帧，避免 React 重渲染后标签"闪一下"
		const ML_SETTINGS_EVERY_TICKS = 10;   // 约 30 秒重读一次开关，改设置免刷新
		const ML_FAIL_BACKOFF_MS = 60000;     // 接口失败后的静默退避
		const ML_FETCH_MIN_MS = 1500;         // 取数最小间隔：流式输出时 DOM 变化很密，只重渲染不重取数
		const ML_MIN_WIDTH_MESSAGE = 420;     // 助手轮尾行容器 < 420px 时隐藏标签
		const ML_MIN_WIDTH_USER = 150;        // 用户消息的动作行更窄（时间 + 复制），阈值单独给
		const ML_MIN_WIDTH_SUBAGENT = 150;    // 浮层树的内容列实测约 210px（整个菜单 330px），阈值取 150 才不会被误判隐藏
		const ML_SELECTOR = {
			tree: 'div[role="tree"][aria-label="子智能体会话"], div[role="tree"][aria-label="Subagent sessions"]',
			treeRow: 'div[role="treeitem"]',
			assistantRow: 'div[data-clock="end"]',
			userRow: 'div[data-clock="start"]'
		};
		const ML_DEFAULTS = { subagentModelLabel: true, changedModelBadge: true, messageQuestionModelLabel: true, messageAnswerModelLabel: true };
		/** 设置镜像；缺字段按默认全开（四个开关）。 */
		const mlSettings = Object.assign({}, ML_DEFAULTS);
		/** 当前已安装实例：重复安装先拆旧实例，全局只保留一份。 */
		let mlInstalled = null;

		/**
		 * 用 host 返回的设置覆盖镜像（只认四个键；缺字段保持默认）。
		 * 老 host 只给 messageModelLabel（总开关）：新键缺失时按它推导（显式 false → 两个都关），
		 * 与 lib/index.js 的 clampSettings 同一口径。
		 */
		function mergeModelLabelSettings(input) {
			if (!input || typeof input !== "object") return mlSettings;
			if (typeof input.subagentModelLabel === "boolean") mlSettings.subagentModelLabel = input.subagentModelLabel;
			if (typeof input.changedModelBadge === "boolean") mlSettings.changedModelBadge = input.changedModelBadge;
			const legacy = typeof input.messageModelLabel === "boolean" ? input.messageModelLabel !== false : null;
			mlSettings.messageQuestionModelLabel = typeof input.messageQuestionModelLabel === "boolean"
				? input.messageQuestionModelLabel
				: (legacy === null ? mlSettings.messageQuestionModelLabel : legacy);
			mlSettings.messageAnswerModelLabel = typeof input.messageAnswerModelLabel === "boolean"
				? input.messageAnswerModelLabel
				: (legacy === null ? mlSettings.messageAnswerModelLabel : legacy);
			return mlSettings;
		}

		/** 从 RPC 回包里挑出设置对象（兼容 { settings } / 直接平铺两种形状）。 */
		function pickModelLabelSettingsPayload(resp) {
			if (!resp || typeof resp !== "object") return null;
			const value = resp.value && typeof resp.value === "object" ? resp.value : null;
			if (value && value.settings && typeof value.settings === "object") return value.settings;
			const flat = value || resp;
			if (typeof flat.subagentModelLabel === "boolean"
				|| typeof flat.changedModelBadge === "boolean"
				|| typeof flat.messageQuestionModelLabel === "boolean"
				|| typeof flat.messageAnswerModelLabel === "boolean"
				|| typeof flat.messageModelLabel === "boolean") return flat;
			return null;
		}

		/**
		 * 读开关。两条路，任一成功即可：
		 *  1) 老路：providerBadge/settings RPC（部分宿主/版本没有这个 RPC）；
		 *  2) 新路：直接 GET /dsh-model-toolkit/api/state 里的 prefs（同一份设置文件）。
		 * 都失败就返回 null，调用方按默认（四个开关全开）处理，绝不报错刷屏。
		 */
		function readModelLabelSettings(rpc) {
			const viaRpc = (() => {
				if (!rpc || typeof rpc.call !== "function") return Promise.resolve(null);
				try {
					return Promise.resolve(rpc.call("/api", "providerBadge/settings", { args: { request: { op: "get" } } }))
						.then((resp) => (resp && resp.ok ? pickModelLabelSettingsPayload(resp) : null))
						.catch(() => null);
				} catch (e) { return Promise.resolve(null); }
			})();
			const viaState = () => {
				try {
					const fetchImpl = typeof fetch === "function" ? fetch : null;
					if (!fetchImpl) return Promise.resolve(null);
					return Promise.resolve(fetchImpl(ML_API_BASE + "/state", { credentials: "same-origin", headers: { accept: "application/json" } }))
						.then((resp) => (resp && resp.ok ? resp.json() : null))
						.then((body) => pickModelLabelSettingsPayload(body && body.prefs ? { ok: true, value: { settings: body.prefs } } : null))
						.catch(() => null);
				} catch (e) { return Promise.resolve(null); }
			};
			return Promise.resolve(viaRpc).then((found) => found || viaState());
		}

		/**
		 * 标签数据缓存：会话 id → { rows, turns, at }。
		 * 作用：打开浮层/刷新页面时**先用缓存立刻渲染**，再后台校正；
		 * 不用等接口回来才出现文字。内存优先，localStorage 只做跨刷新持久化（失败忽略）。
		 */
		const labelCacheMemory = new Map();
		let labelCacheLoaded = false;
		function loadLabelCacheStore() {
			if (labelCacheLoaded) return;
			labelCacheLoaded = true;
			try {
				const raw = typeof localStorage !== "undefined" && localStorage ? localStorage.getItem(ML_CACHE_KEY) : null;
				if (!raw) return;
				const parsed = JSON.parse(raw);
				const sessions = parsed && parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : null;
				if (!sessions) return;
				const now = Date.now();
				for (const sid of Object.keys(sessions)) {
					const item = sessions[sid];
					if (!item || typeof item !== "object") continue;
					if (!Number.isFinite(item.at) || now - item.at > ML_CACHE_TTL_MS) continue;
					labelCacheMemory.set(sid, item);
				}
			} catch (e) { /* 缓存坏了就当没有 */ }
		}
		function persistLabelCacheStore() {
			try {
				if (typeof localStorage === "undefined" || !localStorage) return;
				const sessions = {};
				labelCacheMemory.forEach((v, k) => { sessions[k] = v; });
				localStorage.setItem(ML_CACHE_KEY, JSON.stringify({ v: 1, sessions }));
			} catch (e) { /* 配额满/禁用：只影响跨刷新，不影响本次显示 */ }
		}
		function pruneLabelCache() {
			const now = Date.now();
			labelCacheMemory.forEach((v, k) => {
				if (!v || !Number.isFinite(v.at) || now - v.at > ML_CACHE_TTL_MS) labelCacheMemory.delete(k);
			});
			if (labelCacheMemory.size <= ML_CACHE_MAX_SESSIONS) return;
			const sorted = [...labelCacheMemory.entries()].sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
			for (const [k] of sorted.slice(ML_CACHE_MAX_SESSIONS)) labelCacheMemory.delete(k);
		}
		function readLabelCache(sessionId) {
			if (!sessionId) return null;
			loadLabelCacheStore();
			const hit = labelCacheMemory.get(sessionId);
			if (!hit) return null;
			if (!Number.isFinite(hit.at) || Date.now() - hit.at > ML_CACHE_TTL_MS) {
				labelCacheMemory.delete(sessionId);
				return null;
			}
			return hit;
		}
		function writeLabelCache(sessionId, patch) {
			if (!sessionId) return;
			loadLabelCacheStore();
			const prev = labelCacheMemory.get(sessionId) || {};
			const next = {
				rows: Array.isArray(patch.rows) ? patch.rows : (Array.isArray(prev.rows) ? prev.rows : null),
				turns: Array.isArray(patch.turns) ? patch.turns : (Array.isArray(prev.turns) ? prev.turns : null),
				at: Date.now()
			};
			labelCacheMemory.set(sessionId, next);
			pruneLabelCache();
			persistLabelCacheStore();
		}

		/**
		 * 当前根会话 id。取不到返回 null（标签静默不显示），按以下顺序：
		 *  1) sessions store 快照的 current（老版本 DSH 才有）；
		 *  2) 聊天容器的 data-conversation-session / data-sidebar-right-session
		 *     （DSH 0.2.x 的会话列表快照里没有 current，活动会话只挂在 DOM 上）；
		 *  3) sessions.current。
		 */
		function modelLabelSessionId(sessions) {
			const fromStore = () => {
				try {
					const list = sessions && sessions.list;
					const snap = list && typeof list.getSnapshot === "function" ? list.getSnapshot() : null;
					if (snap && typeof snap.current === "string" && snap.current) return snap.current;
				} catch (e) { /* 继续兜底 */ }
				try {
					if (sessions && typeof sessions.current === "string" && sessions.current) return sessions.current;
				} catch (e) { /* 继续兜底 */ }
				return null;
			};
			const fromDom = () => {
				try {
					const doc = typeof document !== "undefined" ? document : null;
					if (!doc) return null;
					const el = doc.querySelector("[data-conversation-session]") || doc.querySelector("[data-sidebar-right-session]");
					if (!el) return null;
					const raw = el.getAttribute("data-conversation-session") || el.getAttribute("data-sidebar-right-session");
					return typeof raw === "string" && raw ? raw : null;
				} catch (e) { return null; }
			};
			return () => fromStore() || fromDom();
		}

		/** provider/model 文本：斜杠两侧不留空格；缺一侧就只显示另一侧。 */
		function modelLabelText(row) {
			if (!row || typeof row !== "object") return "";
			const provider = typeof row.providerName === "string" && row.providerName
				? row.providerName
				: (typeof row.providerId === "string" ? row.providerId : "");
			const model = typeof row.model === "string" ? row.model : "";
			if (!provider) return model;
			if (!model) return provider;
			return provider + "/" + model;
		}

		/**
		 * 子会话用过的模型个数。接口给 usedCount 时以其为准；
		 * 只给 changedCount（换模型次数）时按「次数 + 1」（首次选中的那个也算一个）换算。
		 */
		function subagentUsedCount(row) {
			if (!row) return 0;
			if (typeof row.usedCount === "number" && row.usedCount >= 0) return row.usedCount;
			const changed = Number(row.changedCount);
			if (!(changed >= 0)) return 0;
			return changed > 0 ? changed + 1 : 0;
		}

		/** 子智能体行文本：provider/model，换过模型且开关开启时追加「 · 用过 N 个」。 */
		function subagentModelLabelText(row) {
			const base = modelLabelText(row);
			if (!base) return "";
			const used = subagentUsedCount(row);
			if (!mlSettings.changedModelBadge || used <= 1) return base;
			return base + " · 用过 " + used + " 个";
		}

		/** 类名后缀判断（CSS Module 的哈希前缀不可靠，后缀稳定）。 */
		function hasClassSuffix(el, suffix) {
			const cls = el && el.className;
			if (typeof cls !== "string" || !cls) return false;
			const parts = cls.split(/\s+/);
			for (let i = 0; i < parts.length; i++) if (parts[i].endsWith(suffix)) return true;
			return false;
		}

		/** 子智能体行的「内容列」：treeitem > div.clickarea > span.content（含 label + summary）。 */
		function subagentContentColumn(row) {
			let clickarea = null;
			const rowKids = row && row.children ? row.children : [];
			for (let i = 0; i < rowKids.length; i++) {
				if (rowKids[i].tagName === "DIV") { clickarea = rowKids[i]; break; }
			}
			const kids = Array.from((clickarea || row).children || []);
			let col = kids.find((el) => hasClassSuffix(el, "_content")) || null;
			if (!col) {
				// 结构兜底：第一个非按钮、非指标区、且至少两个子元素的那一列
				col = kids.find((el) => el.tagName !== "BUTTON" && !hasClassSuffix(el, "_metrics") && el.children.length >= 2) || null;
			}
			return col;
		}

		/** 行标题：内容列第一个子元素的文本（= 子会话 label），取不到时用 aria-label 首段。 */
		function subagentRowTitle(item, col) {
			const kids = Array.from((col && col.children) || []);
			const first = kids.find((el) => !(el.getAttribute && el.getAttribute(ML_ATTR))) || null;
			const text = first && typeof first.textContent === "string" ? first.textContent.trim() : "";
			if (text) return text;
			const aria = item.getAttribute("aria-label") || "";
			return aria.split(" ")[0] || "";
		}

		/**
		 * DOM 行 → 接口行。匹配强度依次为：
		 *  1) 标题/sessionTitle 精确；
		 *  2) 标题互相包含；
		 *  3) 接口标题（常是会话标题 “工作目录 /root/...”）与整行文本互相包含；
		 *  4) 只有一行时兜底。
		 * 每行只用一次，避免同名行错配到同一份数据。
		 */
		function matchSubagentRow(title, rows, used, rowText) {
			const norm = (v) => String(v == null ? "" : v).trim();
			const target = norm(title);
			const extra = norm(rowText);
			if (!rows || rows.length === 0) return null;
			const free = rows.filter((r) => r && !used.has(r));
			if (free.length === 0) return null;
			const fieldsOf = (r) => [norm(r.title), norm(r.sessionTitle)].filter(Boolean);
			let hit = target ? free.find((r) => fieldsOf(r).some((f) => f === target)) || null : null;
			if (!hit && target) {
				hit = free.find((r) => fieldsOf(r).some((f) => f.includes(target) || target.includes(f))) || null;
			}
			if (!hit && extra) {
				hit = free.find((r) => fieldsOf(r).some((f) => {
					const probe = f.replace(/^工作目录s*/, "");
					return probe.length >= 8 && (extra.includes(probe) || probe.includes(extra.slice(0, 24)));
				})) || null;
			}
			if (!hit && free.length === 1 && rows.length === 1) hit = free[0];
			if (hit) used.add(hit);
			return hit;
		}

		/** 只读遍历：拼出「不含我们自己标签」的文本（不碰任何官方节点）。 */
		function textWithoutOwnLabels(host) {
			let out = "";
			const walk = (node) => {
				const kids = node.childNodes || [];
				for (let i = 0; i < kids.length; i++) {
					const child = kids[i];
					if (child.nodeType === 1) {
						if (child.getAttribute && child.getAttribute(ML_ATTR)) continue;
						walk(child);
					} else if (child.nodeType === 3) {
						out += child.nodeValue || "";
					}
				}
			};
			walk(host);
			return out;
		}

		/** 官方已渲染同类模型文本（xxx/yyy）时让位：不插入我们的标签。 */
		function hasOfficialModelText(host) {
			const text = textWithoutOwnLabels(host);
			return /(^|[\s·|])[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+($|[\s·|])/.test(text);
		}

		/** 创建一个标签节点；消息行（助手/用户）左侧带分隔竖线。 */
		function createModelLabelNode(doc, kind) {
			const node = doc.createElement("span");
			node.setAttribute(ML_ATTR, kind);
			const style = [
				"display:inline-flex", "align-items:center", "flex:none", "gap:4px",
				"font-size:10px", "line-height:15px", "font-weight:400",
				"color:var(--dsw-alias-label-tertiary)",
				"white-space:nowrap", "font-variant-numeric:tabular-nums", "pointer-events:none"
			];
			if (kind !== "subagent") {
				style.push("margin-left:8px", "padding-left:8px", "border-left:0.5px solid var(--dsw-alias-border-l2)");
			}
			node.style.cssText = style.join(";");
			const text = doc.createElement("span");
			text.setAttribute(ML_TEXT_ATTR, kind);
			text.style.fontWeight = "500";
			node.appendChild(text);
			return node;
		}

		/** 高亮用的蓝：浅色主题深蓝、深色主题浅蓝（按页面实际底色判断，不依赖具体主题变量名）。 */
		const ML_COLOR_LIGHT = "#2563eb";
		const ML_COLOR_DARK = "#7aa2ff";
		function pageLooksDark(doc) {
			try {
				const win = doc.defaultView || (typeof window !== "undefined" ? window : null);
				if (!win || typeof win.getComputedStyle !== "function") return false;
				const probe = (el) => {
					if (!el) return null;
					const raw = win.getComputedStyle(el).backgroundColor || "";
					const m = /rgba?\(([^)]+)\)/.exec(raw);
					if (!m) return null;
					const parts = m[1].split(",").map((v) => Number(v.trim()));
					if (parts.length < 3 || parts.some((v) => !Number.isFinite(v))) return null;
					const alpha = parts.length > 3 ? parts[3] : 1;
					if (alpha < 0.5) return null; // 透明底色说明要看更外层
					return parts;
				};
				const rgb = probe(doc.body) || probe(doc.documentElement);
				if (!rgb) return false;
				const [r, g, b] = rgb;
				const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
				return luminance < 0.45;
			} catch (e) { return false; }
		}
		function applyModelLabelColor(doc, node) {
			const next = pageLooksDark(doc) ? ML_COLOR_DARK : ML_COLOR_LIGHT;
			if (node.style.color !== next) node.style.color = next;
		}

		/** 取 host 直接子级里属于我们的标签（按 kind 过滤）。 */
		function ownModelLabels(host, kind) {
			const out = [];
			const kids = host && host.children ? host.children : [];
			for (let i = 0; i < kids.length; i++) {
				const el = kids[i];
				if (!el || !el.getAttribute) continue;
				const marked = el.getAttribute(ML_ATTR);
				if (!marked) continue;
				if (kind == null || marked === kind) out.push(el);
			}
			return out;
		}

		/** 拿到（必要时创建）host 下唯一的标签节点；顺手清掉重复节点。 */
		function ensureModelLabel(doc, host, kind) {
			const existing = ownModelLabels(host, kind);
			for (let i = 1; i < existing.length; i++) {
				if (existing[i].parentNode) existing[i].parentNode.removeChild(existing[i]);
			}
			if (existing.length > 0) return existing[0];
			const node = createModelLabelNode(doc, kind);
			host.appendChild(node);
			return node;
		}

		/** 子智能体标签挂在「摘要行之后」，且不进指标区。 */
		function placeSubagentLabel(col, node) {
			const kids = Array.from(col.children || []);
			let anchor = null;
			for (let i = 0; i < kids.length; i++) {
				const el = kids[i];
				if (el === node) continue;
				if (el.getAttribute && el.getAttribute(ML_ATTR)) continue;
				if (hasClassSuffix(el, "_metrics")) break;
				anchor = el;
			}
			if (!anchor) {
				if (node.parentNode !== col) col.appendChild(node);
				return;
			}
			if (anchor.nextSibling !== node) col.insertBefore(node, anchor.nextSibling);
		}

		/** 只在文字真的变了才写 DOM（避免无意义的重排/重绘）。 */
		function setModelLabelText(node, text) {
			const target = node.querySelector("[" + ML_TEXT_ATTR + "]") || node;
			if (target.textContent !== text) target.textContent = text;
		}

		/** 外部（mode=external）标记：灰色「外部」小字。 */
		function setModelLabelExternal(doc, node, external) {
			const kids = Array.from(node.children || []);
			let mark = kids.find((el) => el.getAttribute && el.getAttribute(ML_EXTERNAL_ATTR) != null) || null;
			if (!external) {
				if (mark && mark.parentNode) mark.parentNode.removeChild(mark);
				return;
			}
			if (!mark) {
				mark = doc.createElement("span");
				mark.setAttribute(ML_EXTERNAL_ATTR, "");
				mark.style.cssText = "color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));opacity:.7";
				node.appendChild(mark);
			}
			if (mark.textContent !== "外部") mark.textContent = "外部";
		}

		/** 容器可用宽度（量不到就当未知，未知时不隐藏）。 */
		function modelLabelHostWidth(host) {
			if (!host || typeof host.getBoundingClientRect !== "function") return null;
			try {
				const rect = host.getBoundingClientRect();
				const w = rect && rect.width > 0 ? rect.width : (host.clientWidth || 0);
				return w > 0 ? w : null;
			} catch (e) { return null; }
		}

		/** 容器太窄就隐藏我们的标签；官方元素永远优先（只改自己节点的 display）。 */
		function applyModelLabelWidthGate(node, host, minWidth) {
			const w = modelLabelHostWidth(host);
			const display = w !== null && w < minWidth ? "none" : "inline-flex";
			if (node.style.display !== display) node.style.display = display;
		}

		/** 移除 host 下我们的标签（让位/数据消失时用）。 */
		function dropModelLabelIn(host, kind) {
			const mine = ownModelLabels(host, kind);
			for (let i = 0; i < mine.length; i++) {
				if (mine[i].parentNode) mine[i].parentNode.removeChild(mine[i]);
			}
		}

		/** 移除本轮没触达的标签：开关关闭、行消失、让位都由这一句兜住。 */
		function dropStaleModelLabels(doc, keep) {
			const all = doc.querySelectorAll("[" + ML_ATTR + "]");
			for (let i = 0; i < all.length; i++) {
				const node = all[i];
				if (!keep.has(node) && node.parentNode) node.parentNode.removeChild(node);
			}
		}

		/** 轮号：优先 data-turn-tail（助手轮尾），其次最近的 data-chat-turn（用户消息行）。 */
		function modelLabelTurnNumber(rowEl) {
			const tail = rowEl.closest("[data-turn-tail]");
			if (tail) {
				const n = Number(tail.getAttribute("data-turn-tail"));
				if (Number.isFinite(n)) return n;
			}
			const chat = rowEl.closest("[data-chat-turn]");
			if (chat) {
				const n = Number(chat.getAttribute("data-chat-turn"));
				if (Number.isFinite(n)) return n;
			}
			return null;
		}

		/** 轮号 → 接口行：精确命中优先，命中失败时才退一位（接口 0 基/1 基差异兜底）。 */
		function pickTurnModel(list, turnNum) {
			if (!list || turnNum === null) return null;
			const pick = (n) => list.find((t) => t && Number(t.index) === n) || null;
			return pick(turnNum) || pick(turnNum - 1) || pick(turnNum + 1) || null;
		}

		/** 单个接口的静默取数器：失败只记一次日志，并按退避窗口跳过后续请求。 */
		function createModelLabelEndpoint(path) {
			const state = { failedAt: 0, warned: false, inflight: null };
			return function read(sessionId, fetchImpl) {
				if (!sessionId || typeof fetchImpl !== "function") return Promise.resolve(null);
				const now = Date.now();
				if (state.failedAt && now - state.failedAt < ML_FAIL_BACKOFF_MS) return Promise.resolve(null);
				if (state.inflight) return state.inflight;
				const url = ML_API_BASE + path + "?sessionId=" + encodeURIComponent(sessionId);
				const task = Promise.resolve()
					.then(() => fetchImpl(url, { method: "GET", credentials: "same-origin", headers: { accept: "application/json" } }))
					.then((resp) => {
						if (!resp || !resp.ok) throw new Error("HTTP " + (resp ? resp.status : "?"));
						return resp.json();
					})
					.then((body) => { state.failedAt = 0; return body && typeof body === "object" ? body : null; })
					.catch(() => {
						state.failedAt = Date.now();
						if (!state.warned) {
							state.warned = true;
							console.info("[model-label] " + path + " 不可用，模型标签静默降级");
						}
						return null;
					})
					.finally(() => { state.inflight = null; });
				state.inflight = task;
				return task;
			};
		}
		const readSubagentsEndpoint = createModelLabelEndpoint("/subagents");
		const readTurnsEndpoint = createModelLabelEndpoint("/turns");

		/**
		 * 安装三处模型标签（纯追加 DOM）。
		 * @param options { document, sessions, rpc, fetch, getSessionId, readSettings, settings }
		 * @returns { refresh, render, dispose, setSettings, getSettings } 或 null
		 */
		function installModelLabels(options) {
			const opts = options || {};
			const doc = opts.document || (typeof document !== "undefined" ? document : null);
			if (!doc || !doc.body) return null;
			const win = doc.defaultView || (typeof window !== "undefined" ? window : null);
			if (mlInstalled) {
				try { mlInstalled.dispose(); } catch (e) { /* 旧实例自清失败忽略 */ }
			}
			const fetchImpl = typeof opts.fetch === "function"
				? opts.fetch
				: (win && typeof win.fetch === "function" ? win.fetch.bind(win) : null);
			const getSessionId = typeof opts.getSessionId === "function"
				? opts.getSessionId
				: modelLabelSessionId(opts.sessions);
			const timers = win && typeof win.setTimeout === "function" ? win : { setTimeout, clearTimeout, setInterval, clearInterval };
			mergeModelLabelSettings(opts.settings);
			let disposed = false;
			let debounceTimer = null;
			let tickTimer = null;
			let ticks = 0;
			let subagentRows = null;
			let turns = null;
			let observer = null;
			let settingsBusy = false;
			let lastFetchAt = 0;
			let lastSessionId = null;

			const query = (sel) => { try { return doc.querySelectorAll(sel); } catch (e) { return []; } };

			/** 子智能体浮层行：内容列里追加 provider/model。 */
			const renderSubagents = (keep) => {
				const trees = query(ML_SELECTOR.tree);
				if (trees.length === 0) return;
				if (!subagentRows || subagentRows.length === 0) return;
				const used = new Set();
				// 按树逐个取行：拼接多个选择器时逗号会切断作用域，必须分开查。
				const items = [];
				trees.forEach((tree) => {
					const rowsInTree = tree.querySelectorAll(ML_SELECTOR.treeRow);
					rowsInTree.forEach((item) => items.push(item));
				});
				items.forEach((item) => {
					const col = subagentContentColumn(item);
					if (!col) return;
					const data = matchSubagentRow(subagentRowTitle(item, col), subagentRows, used, col.textContent || "");
					if (!data) return;
					// 让位：内容列里官方已经渲染了同类模型文本 → 不插入
					if (hasOfficialModelText(col)) { dropModelLabelIn(col, "subagent"); return; }
					const external = data.mode === "external" || item.getAttribute("aria-disabled") === "true";
					const text = subagentModelLabelText(data);
					if (!text && !external) { dropModelLabelIn(col, "subagent"); return; }
					const node = ensureModelLabel(doc, col, "subagent");
					placeSubagentLabel(col, node);
					setModelLabelText(node, text);
					applyModelLabelColor(doc, node);
					setModelLabelExternal(doc, node, external);
					applyModelLabelWidthGate(node, col, ML_MIN_WIDTH_SUBAGENT);
					keep.add(node);
				});
			};

			/** 助手轮尾 / 用户消息行：动作行末尾追加（带左分隔竖线）。 */
			const renderTurnRows = (keep) => {
				if (!turns || turns.length === 0) return;
				const rows = query(ML_SELECTOR.assistantRow + ", " + ML_SELECTOR.userRow);
				rows.forEach((rowEl) => {
					const kind = rowEl.getAttribute("data-clock") === "start" ? "user" : "assistant";
					// 用户行与助手行各有一个独立开关：关掉的那一侧直接清掉我们的节点。
					const enabled = kind === "user" ? mlSettings.messageQuestionModelLabel : mlSettings.messageAnswerModelLabel;
					if (!enabled) { dropModelLabelIn(rowEl, kind); return; }
					const turnNum = modelLabelTurnNumber(rowEl);
					if (turnNum === null) return;
					const pick = pickTurnModel(turns, turnNum);
					if (!pick) { dropModelLabelIn(rowEl, kind); return; }
					const text = modelLabelText(pick);
					if (!text) { dropModelLabelIn(rowEl, kind); return; }
					// 让位：该行官方已有同类文本
					if (hasOfficialModelText(rowEl)) { dropModelLabelIn(rowEl, kind); return; }
					const node = ensureModelLabel(doc, rowEl, kind);
					setModelLabelText(node, text);
					applyModelLabelColor(doc, node);
					// 用户消息那一行本身就很窄（只有时间 + 复制），用更小的阈值，否则永远不会显示。
					applyModelLabelWidthGate(node, rowEl, kind === "user" ? ML_MIN_WIDTH_USER : ML_MIN_WIDTH_MESSAGE);
					keep.add(node);
				});
			};

			const render = () => {
				if (disposed) return;
				const keep = new Set();
				try {
					if (mlSettings.subagentModelLabel) renderSubagents(keep);
					if (mlSettings.messageQuestionModelLabel || mlSettings.messageAnswerModelLabel) renderTurnRows(keep);
				} catch (e) {
					console.warn("[model-label] 渲染失败", e);
				} finally {
					dropStaleModelLabels(doc, keep);
				}
			};

			/**
			 * 取数。关键点：**只有明确成功且带数据时才覆盖缓存**。
			 * 老实现一遇到「会话 id 短暂为空 / 接口失败 / 浮层暂时关掉」就把缓存清成 null，
			 * 下一次 render 立刻把已显示的标签全删掉，再等下一轮重新加回来 —— 这就是
			 * 用户看到的「一瞬间消失又出现」。现在改成：失败/暂时不需要时保留上一次好数据。
			 */
			const loadData = async (force) => {
				const sessionId = getSessionId();
				// 不再依赖“浮层是否打开”：页面一加载就把数据备好，打开浮层直接用现成的。
				const wantSubagents = mlSettings.subagentModelLabel;
				const wantTurns = mlSettings.messageQuestionModelLabel || mlSettings.messageAnswerModelLabel;
				// 会话 id 一瞬取不到（切会话、DOM 重建）：保留旧数据，直接不动。
				if (typeof sessionId !== "string" || !sessionId) return;
				// 换会话时先把缓存灌进来（旧会话的模型不能带到新会话上）。
				const sessionChanged = sessionId !== lastSessionId;
				if (sessionChanged) {
					lastSessionId = sessionId;
					lastFetchAt = 0;
					hydrateFromCache(sessionId);
				}
				const cached = readLabelCache(sessionId);
				const cacheFresh = !!cached && Number.isFinite(cached.at) && Date.now() - cached.at < ML_CACHE_FRESH_MS;
				// 新鲜缓存 + 两类数据都在：只渲染，不打接口 —— “打开就有”就靠这一条。
				if (!force && cacheFresh && Array.isArray(subagentRows) && Array.isArray(turns)) {
					lastFetchAt = Date.now();
					return;
				}
				// 节流：复用上一轮数据，只重渲染。
				if (!force && !sessionChanged && Date.now() - lastFetchAt < ML_FETCH_MIN_MS) return;
				lastFetchAt = Date.now();
				let changed = false;
				const jobs = [];
				jobs.push(wantSubagents
					? readSubagentsEndpoint(sessionId, fetchImpl).then((body) => {
						if (body && Array.isArray(body.rows)) {
							const nextRaw = JSON.stringify(body.rows);
							if (nextRaw !== JSON.stringify(subagentRows)) changed = true;
							subagentRows = body.rows;
						}
					})
					: Promise.resolve());
				jobs.push(wantTurns
					? readTurnsEndpoint(sessionId, fetchImpl).then((body) => {
						if (body && Array.isArray(body.turns)) {
							const nextRaw = JSON.stringify(body.turns);
							if (nextRaw !== JSON.stringify(turns)) changed = true;
							turns = body.turns;
						}
					})
					: Promise.resolve());
				await Promise.all(jobs);
				// 取到了就写回缓存：下次打开/刷新页面直接命中。
				if (Array.isArray(subagentRows) || Array.isArray(turns)) {
					if (changed || !cached) writeLabelCache(sessionId, { rows: subagentRows, turns });
				}
			};

			/** 会话切换时同步吃缓存：拿到就立刻有一份可渲染的数据。 */
			const hydrateFromCache = (sessionId) => {
				if (!sessionId) return;
				const cached = readLabelCache(sessionId);
				subagentRows = cached && Array.isArray(cached.rows) ? cached.rows : null;
				turns = cached && Array.isArray(cached.turns) ? cached.turns : null;
			};

			/**
			 * 一轮完整刷新：**先渲染（用内存/缓存里的现成数据）→ 再取数 → 再渲染校正**。
			 * 这样打开浮层或刷新页面时，标签是同步出现的，不会有一段“空白等待期”。
			 */
			const pass = async (force) => {
				if (disposed) return;
				const sessionId = getSessionId();
				if (typeof sessionId === "string" && sessionId && sessionId !== lastSessionId) {
					lastSessionId = sessionId;
					lastFetchAt = 0;
					hydrateFromCache(sessionId);
				}
				try { render(); } catch (e) { /* 渲染失败不影响取数 */ }
				try {
					await loadData(force === true);
					render();
				} catch (e) {
					console.warn("[model-label] 刷新失败", e);
				}
			};

			const schedule = () => {
				if (disposed || debounceTimer !== null) return;
				debounceTimer = timers.setTimeout(() => {
					debounceTimer = null;
					pass();
				}, ML_DEBOUNCE_MS);
			};

			/** 我们自己节点的改动（含文本更新）不触发下一轮，避免自激循环。 */
			const isOwnNode = (node) => {
				let n = node;
				if (!n) return false;
				if (n.nodeType === 3) n = n.parentNode;
				if (!n || n.nodeType !== 1 || typeof n.closest !== "function") return false;
				try { return !!n.closest("[" + ML_ATTR + "]"); } catch (e) { return false; }
			};
			const isOwnMutation = (record) => {
				if (!record) return false;
				if (isOwnNode(record.target)) return true;
				if (record.type !== "childList") return false;
				const nodes = [];
				const added = record.addedNodes || [];
				const removed = record.removedNodes || [];
				for (let i = 0; i < added.length; i++) nodes.push(added[i]);
				for (let i = 0; i < removed.length; i++) nodes.push(removed[i]);
				if (nodes.length === 0) return false;
				for (let i = 0; i < nodes.length; i++) if (!isOwnNode(nodes[i])) return false;
				return true;
			};
			const onMutations = (records) => {
				if (disposed) return;
				for (let i = 0; i < records.length; i++) {
					if (!isOwnMutation(records[i])) { schedule(); return; }
				}
			};

			const readSettingsOnce = () => {
				if (typeof opts.readSettings === "function") {
					return Promise.resolve()
						.then(() => opts.readSettings())
						.then((s) => { mergeModelLabelSettings(s); })
						.catch(() => {});
				}
				if (settingsBusy || !opts.rpc) return Promise.resolve();
				settingsBusy = true;
				return readModelLabelSettings(opts.rpc)
					.then((s) => { mergeModelLabelSettings(s); })
					.finally(() => { settingsBusy = false; });
			};

			const onResize = () => schedule();
			const tick = () => {
				if (disposed) return;
				ticks += 1;
				const active = query(ML_SELECTOR.tree + ", " + ML_SELECTOR.assistantRow + ", " + ML_SELECTOR.userRow).length > 0;
				if (!active) return;
				if (ticks % ML_SETTINGS_EVERY_TICKS === 0) readSettingsOnce().then(pass).catch(() => {});
				else pass();
			};

			const handle = {
				refresh: () => pass(true),
				render,
				setSettings: (next) => { mergeModelLabelSettings(next); render(); },
				getSettings: () => Object.assign({}, mlSettings)
			};
			handle.dispose = () => {
				if (disposed) return;
				disposed = true;
				try { if (observer) observer.disconnect(); } catch (e) { /* ignore */ }
				observer = null;
				if (debounceTimer !== null) { timers.clearTimeout(debounceTimer); debounceTimer = null; }
				if (tickTimer !== null) { timers.clearInterval(tickTimer); tickTimer = null; }
				try { if (win && typeof win.removeEventListener === "function") win.removeEventListener("resize", onResize); } catch (e) { /* ignore */ }
				subagentRows = null;
				turns = null;
				dropStaleModelLabels(doc, new Set());
				if (mlInstalled === handle) mlInstalled = null;
			};

			mlInstalled = handle;
			// 首轮：先读开关（取不到按默认），再取数渲染。
			readSettingsOnce().then(pass).catch(() => { pass(); });
			try {
				if (win && typeof win.MutationObserver === "function") {
					observer = new win.MutationObserver(onMutations);
					observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
				}
			} catch (e) {
				console.warn("[model-label] MutationObserver 不可用，退回 3 秒轮询", e);
			}
			tickTimer = timers.setInterval(tick, ML_TICK_MS);
			try { if (win && typeof win.addEventListener === "function") win.addEventListener("resize", onResize); } catch (e) { /* ignore */ }
			return handle;
		}
		//#endregion

		//#endregion

		const inject = ["sessions", "connection", "slots"];
		exports.installModelLabels = installModelLabels;
		// ----「模型工具箱」极简入口 ----
		// 设置面板只保留这一个分区：功能全部迁到独立整页（dsh-model-toolkit/，另开标签页）。
		// 样式一律用 DSH 主题令牌字面量（var(--dsw-alias-*)，对应原「次要按钮」观感）。
		function ModelToolkitEntryPage() {
			return React.createElement("div", { style: { background: "var(--dsw-alias-bg-layer-1)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 12, padding: "14px" } },
				React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "var(--dsw-alias-label-primary)", marginBottom: 6 } }, tx("settings.toolkit")),
				React.createElement("div", { style: { fontSize: 13, color: "var(--dsw-alias-label-secondary)", marginBottom: 12, lineHeight: "20px" } }, tx("settings.toolkitDesc")),
				React.createElement("a", {
					href: "dsh-model-toolkit/", target: "_blank", rel: "noopener noreferrer",
					style: {
						textDecoration: "none", display: "inline-flex", alignItems: "center",
						border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8,
						padding: "5px 12px", background: "transparent",
						color: "var(--dsw-alias-label-secondary)", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap"
					}
				}, tx("settings.toolkitOpen"))
			);
		}

		//#region DSH ≥ 0.1.2（connection.api 已移除）的数据门面
		// 0.1.2-rc.1 起 dsh-client-connection 的 connection 服务不再暴露旧版 `api`
		// （sessions.models / settings.describe 曾挂在上面），高层取数改为：
		//   当前会话模型/提供商/分组  → modelDirectories 目录服务（每会话 ModelDirectory.store：
		//      快照 { current:{provider,model,reasoningEffort?}, groups:[{id,name,models:[…]}], … }，
		//      与旧 sessions.models 的 { current, groups } 语义一致，也是模型座自身渲染所依赖的数据）
		//   提供商配置（llm-pi-ai.providers）→ ctx.remote.settings.describe()
		// 这里把它们适配回 installProviderBadge 内部原有的 api.sessions.models /
		// api.settings.describe 形状，徽章/浮层/余量逻辑无需改动。
		function createModernDataFacade(dirs, remote) {
			return {
				sessions: {
					models: async (arg) => {
						const sessionId = arg && arg.sessionId;
						if (typeof sessionId !== "string") return { result: { ok: false } };
						let directory = null;
						try {
							directory = dirs.directoryFor(sessionId);
						} catch (e) {
							// 会话作用域尚未就绪（如刚打开/子代理会话）→ 下次轮询再试，不报错。
							return { result: { ok: false } };
						}
						let snap = directory.store.getSnapshot();
						if (snap.status !== "ready") {
							// 目录加载失败（如模型目录不可用）→ 抛出让调用方按“装饰失效”显式提示，
							// 与旧版 api 调用出错时一致；仅“作用域/目录未就绪”属瞬时态，静默等下次轮询。
							await directory.load();
							snap = directory.store.getSnapshot();
						}
						// 目录已就绪但还没有当前选择（如无模型可用的会话）→ ok，调用方按“无提供商”处理。
						return { result: { ok: true, value: snap } };
					},
					/**
					 * **只读**读取目录快照：绝不触发 load()、绝不写 store、绝不通知订阅者。
					 * 专供订阅回调使用 —— 在 store 通知期间调用任何会写 store 的方法都会形成自持循环。
					 * @returns { result: { ok: true, value: snapshot } }，或目录/作用域未就绪时的 { ok: false }。
					 */
					modelsSnapshot: (arg) => {
						const sessionId = arg && arg.sessionId;
						if (typeof sessionId !== "string") return { result: { ok: false } };
						try {
							return { result: { ok: true, value: dirs.directoryFor(sessionId).store.getSnapshot() } };
						} catch (e) {
							// 会话作用域尚未就绪（如刚打开/子代理会话）→ 静默，等下一次通知。
							return { result: { ok: false } };
						}
					}
				},
				settings: {
					describe: async () => {
						try {
							const resp = await remote.settings.describe();
							return { result: resp };
						} catch (e) {
							console.warn("[provider-badge] settings.describe 失败", e);
							return { result: null };
						}
					}
				},
				/**
				 * 订阅该会话的模型目录变化（切模型/换提供商即时回调），供槽位徽章替代轮询。
				 * @returns 退订函数；目录尚未就绪时返回 null（调用方退回轮询）。
				 */
				subscribe: (sessionId, cb) => {
					if (typeof sessionId !== "string") return null;
					try {
						const directory = dirs.directoryFor(sessionId);
						return directory.store.subscribe(() => { try { cb(); } catch (e) { console.warn("[provider-badge] 订阅回调失败", e); } });
					} catch (e) {
						return null;
					}
				}
			};
		}
		//#endregion

		function apply(ctx) {
			// 注册 i18n 字典（跟随系统时由 DSH locale 决定语言）
			// 必须走 ctx.inject(["locale"])：直接读 ctx.locale 会抛
			// "cannot get property locale without inject"，且不会有任何注册效果。
			try {
				ctx.inject(["locale"], (loc) => {
					if (loc.locale && typeof loc.locale.register === "function") {
						loc.effect(() => loc.locale.register(LOCALE_NS, { zh, en }), "provider-info: locales");
					}
				});
			} catch (e) { console.warn("[provider-badge] 注册字典失败", e); }
			// resolveLang：手动 language 优先；system 时跟随 DSH 当前界面语言
			resolveLang = () => {
				const pref = QSettings.language;
				if (pref === "en" || pref === "zh") return pref;
				try {
					// 可选读取：locale 未就绪时为 undefined，回退 "zh"。
					const locale = ctx.get("locale");
					const active = locale && locale.getLocale ? locale.getLocale().active : null;
					return (active === "zh" || active === "en") ? active : "zh";
				} catch (e) { return "zh"; }
			};
			ctx.inject(["sessions", "connection", "slots"], (scoped) => {
				quotaShared.rpc = scoped.connection && scoped.connection.rpc || null;
				const sessions = scoped.sessions;
				const slots = scoped.slots;
				// 挂载时读一次设置：据此决定徽章槽位是否注册。
				// 读失败 / 缺字段按默认（开）处理。
				const switchFlags = loadSettings(quotaShared.rpc).then((s) => ({
					badgeAndQuota: !s || s.badgeAndQuota !== false
				}));
				// 模型标签三处挂载（子智能体浮层行 / 助手轮尾 / 用户消息行）：
				// 纯追加 DOM，不注册、不遮蔽任何官方槽位；失败只记日志，不影响徽章。
				try {
					installModelLabels({ sessions, rpc: quotaShared.rpc });
				} catch (e) { console.warn("[model-label] 安装失败", e); }
				// 数据路径选择：
				//  - 旧版 DSH（connection 服务还带 api 字段，如 0.1.1-rc.x）→ 原逻辑直用 connection.api。
				//  - 新版 DSH（0.1.2+，connection.api 已移除）→ 等 modelDirectories / remote 服务
				//    就绪后，用门面把目录 store + remote.settings.describe 适配回相同形状。
				const legacyApi = scoped.connection && scoped.connection.api;
				// 徽章承载：优先官方槽位 conversation.input.right（模型座左侧的官方空槽，结构上与选择器分离）；
				// 若槽位在 1.2s 内仍未就绪（旧版 DSH 没有该槽），回退到“往模型座按钮内注入 DOM”。
				const FALLBACK_AFTER_MS = 1200;
				const mountBadge = (dataApi) => {
					let mounted = false;
					let fallbackTimer = null;
					let disposeSlot = null;
					let gateDisabled = false;
					const installFallback = () => {
						if (mounted || gateDisabled) return;
						try { installProviderBadge(sessions, dataApi, quotaShared.rpc); }
						catch (e) { console.warn("[provider-badge] 安装失败", e); noticeDecoratorFailure(); }
					};
					/** 总开关关闭：注销槽位并取消 DOM 兜底（徽章/浮层/余量查询随之全部不再出现）。 */
					const unmountBadge = () => {
						gateDisabled = true;
						if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
						if (!disposeSlot) return;
						try { disposeSlot(); } catch (e) { console.warn("[provider-badge] dispose badge slot failed", e); }
						disposeSlot = null;
						mounted = false;
					};
					try {
						if (slots && slots.inject && slots.register) {
							slots.inject("conversation.input.right", () => {
								if (gateDisabled) return;
								try {
									disposeSlot = slots.register({
										name: "conversation.input.right",
										id: "provider-info",
										order: 15,
										locale: LOCALE_NS,
										inject: (sessionId) => ({ sessionId })
									}, makeSlotBadge(sessions, dataApi, quotaShared.rpc));
									mounted = true;
									if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
								} catch (e) {
									console.warn("[provider-badge] 注册官方槽位失败", e);
								}
							});
						}
					} catch (e) {
						console.warn("[provider-badge] 槽位不可用", e);
					}
					fallbackTimer = setTimeout(() => { fallbackTimer = null; installFallback(); }, FALLBACK_AFTER_MS);
					switchFlags.then((flags) => { if (!flags.badgeAndQuota) unmountBadge(); });
				};
				if (legacyApi) {
					mountBadge(legacyApi);
				} else {
					ctx.inject(["modelDirectories", "remote", "remote.settings"], (scoped2) => {
						mountBadge(createModernDataFacade(scoped2.modelDirectories, scoped2.remote));
					});
				}
				if (slots && slots.inject) {
					try {
						slots.inject("settings.section", () => slots.register({
							name: "settings.section",
							id: "model-toolkit",
							order: 12,
							label: tx("settings.toolkit")
						}, ModelToolkitEntryPage));
					} catch (e) {
						console.warn("[model-toolkit] 注册设置分区失败", e);
					}
				}
			});
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
		};

		const m2 = __toolkitModule2(require);

		const inject = ["slots", "connection", "sessions"];
		exports.installModelLabels = m2.installModelLabels;
		function apply(ctx) {
			m2.apply(ctx);
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
