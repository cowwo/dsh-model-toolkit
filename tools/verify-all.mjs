#!/usr/bin/env node
/**
 * 总验收脚本：按顺序跑完本目录下**所有离线验证脚本**，打印汇总表。
 *
 * 用法（在包根目录或本目录下都可以）：
 *   node tools/verify-all.mjs
 *
 * 全过 exit 0，任一失败 exit 1。
 *
 * 说明：
 * - 全部脚本都不联网、不写用户真实 `$DSH_HOME`、不重启任何进程。
 * - **不包含** `verify-quota.mjs`：那会用真实凭据出网调厂商接口，必须单独征得同意后手动跑。
 * - 主机侧接口在**运行中进程**里的真实可用性，由包外的只读探针
 *   `../_verify/probe-host-rpc.mjs` 负责（需要 GUI 在跑，不放在这里）。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgDir = dirname(here)
const pkgName = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).name

/** 顺序有意义：契约 → 文案/数据逻辑 → 行为夹具 */
const SUITE = [
  ['check-typert-manifest.mjs', ['.', pkgName], 'typert 清单契约（5 个端点 + 严格 codec）'],
  ['verify-format.mjs', [], '余量文案与悬停状态机（从真实 client.js 抽源码执行）'],
  ['verify-resilience.mjs', [], '瞬时失败重试 + 缓存 TTL'],
  ['verify-settings.mjs', [], '设置读写 + 严格 schema + 脏数据夹回默认值'],
  ['verify-inherit-nocompat.mjs', [], '「继承自…」只写图片+等级、不碰 compat'],
  ['verify-role-unset.mjs', [], '线路角色下拉的 unset 分支（只删叶子 vs 整块删）'],
  ['verify-bulk-clear.mjs', [], '「清空能力」的现状行为（已知风险，记录用）'],
]

const rows = []
let failed = 0
for (const [file, args, desc] of SUITE) {
  const started = Date.now()
  const r = spawnSync(process.execPath, [join(here, file), ...args], { cwd: pkgDir, encoding: 'utf8' })
  const ms = Date.now() - started
  const ok = r.status === 0
  if (!ok) failed++
  rows.push({ file, ok, ms, desc, out: `${r.stdout ?? ''}${r.stderr ?? ''}` })
  process.stdout.write(`\n${'='.repeat(72)}\n${ok ? '[PASS]' : '[FAIL]'} ${file}  (${ms}ms)\n${'='.repeat(72)}\n`)
  const tail = (r.stdout ?? '').trimEnd().split('\n').slice(-6).join('\n')
  if (tail) process.stdout.write(tail + '\n')
  if (!ok && r.stderr) process.stdout.write(r.stderr.trimEnd().split('\n').slice(-8).join('\n') + '\n')
}

process.stdout.write(`\n${'='.repeat(72)}\n汇总\n${'='.repeat(72)}\n`)
for (const r of rows) {
  process.stdout.write(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.file.padEnd(32)} ${String(r.ms).padStart(6)}ms  ${r.desc}\n`)
}
process.stdout.write(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}（共 ${rows.length} 个离线脚本）\n`)
process.stdout.write(`提醒：出网验证 tools/verify-quota.mjs 需单独征得同意；主机侧真实可用性见 ../_verify/probe-host-rpc.mjs\n`)
process.exit(failed === 0 ? 0 : 1)
