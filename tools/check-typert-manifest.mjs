// Lead acceptance harness for a typert manifest — faithful replica of
// @deepseek-ai/dsh-typert-loader/lib/index.js requireInvocation()/requireStrictCodec().
//
// Why this exists:
//   * the repo's verify-typert-zod.mjs is STALE — it probes `codec.schema._zod`, but the real
//     manifest codec is `{ mode, typeSymbol, create }` (no `schema`), so it always REJECTs.
//   * the merged manifest carries 5 endpoints; this harness validates ALL of them.
//
// Real gates replicated (line numbers = dsh-typert-loader/lib/index.js):
//   :80       manifest.package must equal the resolved package.json name
//   :166,185,199  requireStrictCodec on Context receiver / each parameter / result
//   :206-213  strict predicate: mode==='strict', typeSymbol is a non-empty string,
//             decode/encode optional but must be functions, create() must be a function
//   :150-192  invocation envelope: id/service/namespace/method strings, receiver.kind,
//             parameter name/wire strings, unique wires, source in {json,lookup}
//
// Usage: node check-typert-manifest.mjs <plugin-package-dir> [expected-package-name]
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve, join } from 'node:path'
import { realpathSync, readFileSync } from 'node:fs'

const pkg = '(harness)'
const requireObject = (value, subject) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${subject} must be an object`)
  return value
}
const requireString = (obj, key, subject) => {
  if (typeof obj[key] !== 'string' || obj[key].length === 0) throw new Error(`${subject} ${key} must be a non-empty string`)
}
const requireArray = (value, subject) => {
  if (!Array.isArray(value)) throw new Error(`${subject} must be an array`)
  return value
}
const requireStrictCodec = (value, subject) => {
  const codec = requireObject(value, subject)
  if (codec.mode !== 'strict') throw new Error(`${subject} must use a strict codec`)
  requireString(codec, 'typeSymbol', subject)
  for (const method of ['decode', 'encode']) {
    if (codec[method] !== undefined && typeof codec[method] !== 'function') throw new Error(`${subject} ${method} must be a function`)
  }
  if (typeof codec.create !== 'function') throw new Error(`${subject} has no create() factory`)
}
const requireInvocation = (invocation) => {
  const inv = requireObject(invocation, 'invocation')
  for (const key of ['id', 'service', 'namespace', 'method']) requireString(inv, key, 'invocation')
  const receiver = requireObject(inv.invocation, `invocation "${inv.id}" receiver`)
  if (receiver.kind === 'context') {
    requireString(receiver, 'context', `invocation "${inv.id}" Context receiver`)
    requireString(receiver, 'wire', `invocation "${inv.id}" Context receiver`)
    requireStrictCodec(receiver.codec, `invocation "${inv.id}" Context codec`)
  } else if (receiver.kind !== 'direct') {
    throw new Error(`invocation "${inv.id}" receiver kind must be "direct" or "context"`)
  }
  const wires = new Set()
  for (const raw of requireArray(inv.parameters, `invocation "${inv.id}" parameters`)) {
    const parameter = requireObject(raw, `invocation "${inv.id}" parameter`)
    requireString(parameter, 'name', `invocation "${inv.id}" parameter`)
    requireString(parameter, 'wire', `invocation "${inv.id}" parameter`)
    if (wires.has(parameter.wire)) throw new Error(`invocation "${inv.id}" repeats wire field "${parameter.wire}"`)
    wires.add(parameter.wire)
    if (parameter.source === 'lookup') requireString(parameter, 'lookup', `invocation "${inv.id}" lookup parameter`)
    else if (parameter.source !== 'json') throw new Error(`invocation "${inv.id}" parameter source must be "json" or "lookup"`)
    requireStrictCodec(parameter.codec, `invocation "${inv.id}" parameter codec`)
  }
  requireStrictCodec(inv.result, `invocation "${inv.id}" result codec`)
}

const realDir = realpathSync(resolve(process.argv[2]))
const expectedPkg = process.argv[3] ?? null
const req = createRequire(join(realDir, 'noop.js'))

let zodVersion = '(unresolvable)'
try { zodVersion = req('zod/package.json').version } catch {}

const pkgName = JSON.parse(readFileSync(join(realDir, 'package.json'), 'utf8')).name
const mod = await import(pathToFileURL(join(realDir, 'lib/typert.host.js')).href)
const TYPERT = mod.TYPERT ?? mod.default?.TYPERT

const fails = []
const invs = TYPERT?.invocations ?? []

console.log(`dir               : ${realDir}`)
console.log(`package.json name : ${pkgName}`)
console.log(`manifest.package  : ${TYPERT?.package}`)
console.log(`zod resolved      : ${zodVersion}`)
console.log(`invocations       : ${invs.length}`)

if (!TYPERT) fails.push('no TYPERT export found in lib/typert.host.js')
if (TYPERT && TYPERT.package !== pkgName) fails.push(`manifest.package "${TYPERT.package}" != package.json name "${pkgName}"`)
if (expectedPkg && pkgName !== expectedPkg) fails.push(`package.json name "${pkgName}" != expected "${expectedPkg}"`)

const ids = []
for (const [i, inv] of invs.entries()) {
  const id = inv?.id ?? '(no id)'
  try {
    requireInvocation(inv)
    console.log(`  #${i} ${id}  OK`)
  } catch (err) {
    console.log(`  #${i} ${id}  FAIL: ${err.message}`)
    fails.push(err.message)
  }
  ids.push(id)
}

const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
if (dupes.length) fails.push(`duplicate invocation id(s): ${[...new Set(dupes)].join(', ')}`)

const expectedEndpoints = [
  'modelCapability/source',
  'providerBadge/modelInfo',
  'providerBadge/balance',
  'providerBadge/settings',
  'providerBadge/providers',
]
const joined = ids.join('\n')
const missing = expectedEndpoints.filter((e) => !joined.includes(e))
if (expectedPkg) {
  if (missing.length) fails.push(`missing endpoint(s): ${missing.join(', ')}`)
  console.log(`endpoints covered : ${expectedEndpoints.length - missing.length}/${expectedEndpoints.length}`)
} else {
  console.log(`endpoints present : ${expectedEndpoints.filter((e) => joined.includes(e)).join(', ') || '(none of the merged set)'}`)
}

if (fails.length) {
  console.log('\nVERDICT: REJECT')
  for (const f of fails) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('\nVERDICT: ACCEPT')
process.exit(0)
