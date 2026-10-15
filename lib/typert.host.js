/* Merged typert host manifest for dsh-model-toolkit.
 * 一个 npm 包只能注册一份 typert 清单（dsh-typert-loader/lib/index.js:40,295），
 * 因此把 dsh-model-fit 与 dsh-provider-info 的两份合成这一份。
 * invocation id / typeSymbol / codec / create() 工厂 / service 描述均原样保留；
 * typeSymbol 里的旧包前缀不动（registry 只校验非空字符串，无归属校验）。
 */
import { z } from 'zod'

/* ---------------- dsh-model-fit schemas ---------------- */
const sourceRequestSchema = z.object({
	provider: z.string().min(1),
	model: z.string().min(1)
})

const sourceResultSchema = z.object({
	input: z.array(z.string()),
	levels: z.array(z.string()),
	wire: z.record(z.string(), z.union([z.string(), z.null()])).nullable(),
	compat: z.record(z.string(), z.unknown()).nullable(),
	exact: z.boolean()
}).nullable()

/* -------------- dsh-provider-info schemas -------------- */
const modelInfoRequestSchema = z.object({
	provider: z.string().min(1),
	model: z.string().min(1)
})

const modelInfoResultSchema = z.object({
	contextWindow: z.number().int().positive().nullable().optional(),
	maxTokens: z.number().int().positive().nullable().optional(),
	input: z.array(z.string()).nullable().optional()
}).nullable()

// ---- 余量 schema（统一结构：windows / balance / period，见 ADR-0002）----
const balanceWindowSchema = z.object({
	key: z.string(),
	durationHours: z.number().nullable().optional(),
	percent: z.number().nullable().optional(),
	used: z.number().nullable().optional(),
	total: z.number().nullable().optional(),
	currency: z.string().nullable().optional(),
	resetsAt: z.string().nullable().optional(),
	rateLimited: z.boolean().nullable().optional()
})

const balanceItemSchema = z.object({
	currency: z.string().nullable().optional(),
	total: z.number().nullable().optional()
})

const balancePayloadSchema = z.object({
	isAvailable: z.boolean().nullable().optional(),
	items: z.array(balanceItemSchema).nullable().optional()
}).nullable()

const balancePeriodSchema = z.object({
	end: z.string().nullable().optional(),
	daysLeft: z.number().nullable().optional()
}).nullable()

const balanceResultSchema = z.object({
	supported: z.boolean(),
	recognized: z.boolean().optional(),
	family: z.string().nullable().optional(),
	error: z.string().nullable().optional(),
	// 余额型：币种 + 金额（可多币种）
	balance: balancePayloadSchema.optional(),
	// 套餐型：配额窗口（key = 语义槽位，durationHours = 真实时长，used/total = 已用与总额）
	windows: z.array(balanceWindowSchema).nullable().optional(),
	// 套餐型：订阅计费周期到期（只有厂商提供时才有）
	period: balancePeriodSchema.optional()
}).nullable()

const balanceRequestSchema = z.object({
	provider: z.string().min(1),
	baseURL: z.string().nullable().optional(),
	apiKeyEnv: z.string().nullable().optional(),
	force: z.boolean().nullable().optional()
})

const settingsSchema = z.object({
	// 两个总开关必须显式列进 schema：zod object 会静默剥离未知键，
	// 漏在这里会让界面上的勾选框"能翻动、请求成功、却什么都没存"。
	capabilityEditor: z.boolean().nullable().optional(),
	badgeAndQuota: z.boolean().nullable().optional(),
	hoverRefresh: z.boolean().nullable().optional(),
	autoRefreshOn: z.boolean().nullable().optional(),
	autoRefreshMin: z.number().nullable().optional(),
	showMore: z.boolean().nullable().optional(),
	fontSize: z.enum(['large', 'middle', 'small']).nullable().optional(),
	language: z.enum(['system', 'en', 'zh']).nullable().optional()
})

const settingsRequestSchema = z.object({
	op: z.enum(['get', 'set']),
	patch: z.object({
		// 同上：patch 是 z.object，未知键会被剥离，因此这两个键必须在这里。
		capabilityEditor: z.boolean().optional(),
		badgeAndQuota: z.boolean().optional(),
		hoverRefresh: z.boolean().optional(),
		autoRefreshOn: z.boolean().optional(),
		autoRefreshMin: z.number().optional(),
		showMore: z.boolean().optional(),
		fontSize: z.enum(['large', 'middle', 'small']).optional(),
		language: z.enum(['system', 'en', 'zh']).optional()
	}).optional()
})

const settingsResultSchema = z.object({
	settings: settingsSchema
})

// ---- 提供商枚举 schema ----
const providerEntrySchema = z.object({
	provider: z.string(),
	displayName: z.string().nullable().optional(),
	baseURL: z.string().nullable().optional(),
	apiKeyEnv: z.string().nullable().optional()
})
const providersRequestSchema = z.object({}).strict()
const providersResultSchema = z.object({
	providers: z.array(providerEntrySchema)
})

export const TYPERT = {
	package: 'dsh-model-toolkit',
	face: 'host',
	schemas: [],
	invocations: [
		{
			id: 'dsh-model-toolkit#modelCapability/source',
			service: 'modelCapability',
			namespace: 'modelCapability',
			method: 'source',
			invocation: { kind: 'direct' },
			parameters: [
				{
					name: 'request',
					wire: 'request',
					source: 'json',
					codec: {
						mode: 'strict',
						typeSymbol: 'dsh-model-toolkit#modelCapability/source:request',
						create: () => sourceRequestSchema
					}
				}
			],
			result: {
				mode: 'strict',
				typeSymbol: 'dsh-model-toolkit#modelCapability/source:result',
				create: () => sourceResultSchema
			},
			sourceLocation: { file: 'lib/index.js', line: 1, column: 1 }
		},
		{
			id: 'dsh-model-toolkit#providerBadge/modelInfo',
			service: 'providerBadge',
			namespace: 'providerBadge',
			method: 'modelInfo',
			invocation: { kind: 'direct' },
			parameters: [
				{
					name: 'request',
					wire: 'request',
					source: 'json',
					codec: {
						mode: 'strict',
						typeSymbol: 'dsh-model-toolkit#providerBadge/modelInfo:request',
						create: () => modelInfoRequestSchema
					}
				}
			],
			result: {
				mode: 'strict',
				typeSymbol: 'dsh-model-toolkit#providerBadge/modelInfo:result',
				create: () => modelInfoResultSchema
			},
			sourceLocation: { file: 'lib/index.js', line: 1, column: 1 }
		},
		{
			id: 'dsh-model-toolkit#providerBadge/balance',
			service: 'providerBadge',
			namespace: 'providerBadge',
			method: 'balance',
			invocation: { kind: 'direct' },
			parameters: [
				{
					name: 'request',
					wire: 'request',
					source: 'json',
					codec: {
						mode: 'strict',
						typeSymbol: 'dsh-model-toolkit#providerBadge/balance:request',
						create: () => balanceRequestSchema
					}
				}
			],
			result: {
				mode: 'strict',
				typeSymbol: 'dsh-model-toolkit#providerBadge/balance:result',
				create: () => balanceResultSchema
			},
			sourceLocation: { file: 'lib/index.js', line: 1, column: 1 }
		},
		{
			id: 'dsh-model-toolkit#providerBadge/settings',
			service: 'providerBadge',
			namespace: 'providerBadge',
			method: 'settings',
			invocation: { kind: 'direct' },
			parameters: [
				{
					name: 'request',
					wire: 'request',
					source: 'json',
					codec: {
						mode: 'strict',
						typeSymbol: 'dsh-model-toolkit#providerBadge/settings:request',
						create: () => settingsRequestSchema
					}
				}
			],
			result: {
				mode: 'strict',
				typeSymbol: 'dsh-model-toolkit#providerBadge/settings:result',
				create: () => settingsResultSchema
			},
			sourceLocation: { file: 'lib/index.js', line: 1, column: 1 }
		},
		{
			id: 'dsh-model-toolkit#providerBadge/providers',
			service: 'providerBadge',
			namespace: 'providerBadge',
			method: 'providers',
			invocation: { kind: 'direct' },
			parameters: [
				{
					name: 'request',
					wire: 'request',
					source: 'json',
					codec: {
						mode: 'strict',
						typeSymbol: 'dsh-model-toolkit#providerBadge/providers:request',
						create: () => providersRequestSchema
					}
				}
			],
			result: {
				mode: 'strict',
				typeSymbol: 'dsh-model-toolkit#providerBadge/providers:result',
				create: () => providersResultSchema
			},
			sourceLocation: { file: 'lib/index.js', line: 1, column: 1 }
		}
	],
	model: {
		services: [
			{
				description: 'Reads a source model capability for one-click inheritance.',
				summary: 'Reads a source model capability for one-click inheritance.',
				jsDoc: '/** Reads a source model capability for one-click inheritance. */',
				tags: [],
				key: 'modelCapability',
				exportName: 'ModelCapabilityService',
				members: [
					{
						kind: 'method',
						name: 'source',
						signature: 'async source(request: { provider: string; model: string }): Promise<{ input: string[]; levels: string[]; wire: Record<string, string | null> | null; compat: Record<string, unknown> | null; exact: boolean } | null>',
						description: 'Resolve input modalities, reasoning levels, wire spellings and compat of a source model.',
						summary: 'Resolve a source model capability.',
						jsDoc: '/** Resolve a source model capability. */',
						tags: []
					}
				],
				types: []
			},
			{
				description: "Reads the current model's catalog info (context window, max tokens, input modalities) and the current provider's remaining quota (balance or subscription limits).",
				summary: "Reads the current model's catalog info and the provider's remaining quota.",
				jsDoc: "/** Reads the current model's catalog info and the provider's remaining quota. */",
				tags: [],
				key: 'providerBadge',
				exportName: 'ProviderBadgeService',
				members: [
					{
						kind: 'method',
						name: 'modelInfo',
						signature: 'async modelInfo(request: { provider: string; model: string }): Promise<{ contextWindow?: number | null; maxTokens?: number | null; input?: string[] | null } | null>',
						description: "Resolve a model's catalog info.",
						summary: "Resolve a model's catalog info.",
						jsDoc: "/** Resolve a model's catalog info. */",
						tags: []
					},
					{
						kind: 'method',
						name: 'balance',
						signature: 'async balance(request: { provider: string; baseURL?: string | null; apiKeyEnv?: string | null }): Promise<{ supported: boolean; recognized?: boolean; family?: string | null; error?: string | null; balance?: object | null; windows?: object[] | null; period?: object | null } | null>',
						description: "Query the current provider's remaining balance or subscription limits.",
						summary: "Query the provider's remaining balance or limits.",
						jsDoc: "/** Query the provider's remaining balance or limits. */",
						tags: []
					},
					{
						kind: 'method',
						name: 'settings',
						signature: 'async settings(request: { op: string; patch?: object }): Promise<{ settings: { capabilityEditor?: boolean | null; badgeAndQuota?: boolean | null; hoverRefresh?: boolean | null; autoRefreshOn?: boolean | null; autoRefreshMin?: number | null; showMore?: boolean | null; fontSize?: string | null; language?: string | null } }>',
						description: "Read or write the plugin's quota-refresh settings.",
						summary: "Read or write the plugin settings.",
						jsDoc: "/** Read or write the plugin settings. */",
						tags: []
					}
				],
				types: []
			}
		],
		events: [],
		objects: []
	}
}
