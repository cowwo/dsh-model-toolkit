/* 共享目录查询：A、B 两个包的 catalogLookup() 原本逐字重复，合并后抽成单一实现。 */
import { getBuiltinModels, getBuiltinProviders } from '@earendil-works/pi-ai/providers/all'

/**
 * Look up a source model in the pi-ai built-in catalog, preferring the exact
 * provider route, then any route, then a suffix-stripped sibling
 * (e.g. `deepseek-v4-flash-vision-exp` → `deepseek-v4-flash`).
 * @returns the catalog model plus an `exact` flag, or null.
 */
function catalogLookup(provider, model) {
	try {
		const own = getBuiltinModels(provider).find((m) => m.id === model)
		if (own) return { model: own, exact: true }
	} catch { /* best-effort */ }
	try {
		for (const p of getBuiltinProviders()) {
			const m = getBuiltinModels(p).find((x) => x.id === model)
			if (m) return { model: m, exact: true }
		}
	} catch { /* best-effort */ }
	const stripped = model.replace(/(?:-vision-exp|-exp|-preview|-latest|-v[0-9]+)$/, '')
	if (stripped !== model) {
		try {
			for (const p of getBuiltinProviders()) {
				const m = getBuiltinModels(p).find((x) => x.id === stripped)
				if (m) return { model: m, exact: false }
			}
		} catch { /* best-effort */ }
	}
	return null
}

export { catalogLookup }
