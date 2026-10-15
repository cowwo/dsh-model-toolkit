# tools/ — 开发期验证脚本（不参与插件运行）

本目录的脚本只做**验证与记录**，不参与 `lib/`、`client/` 的运行时逻辑。
全部脚本**不联网**、**不写用户真实 `$DSH_HOME`**、**不重启任何进程**。
在包根目录（`dsh-model-toolkit/`）下直接跑即可，路径都相对脚本自身定位。

## 一键全跑

```sh
node tools/verify-all.mjs
```

按顺序跑完下表的 7 个离线脚本，逐项打印 PASS/FAIL，最后一行是无汇总的 `ALL PASS`；任一失败则整体 exit 1。

## 脚本清单

| 脚本 | 用途 | 运行命令 | 期望输出 | 需要网络 |
| --- | --- | --- | --- | --- |
| `verify-all.mjs` | 总验收：顺序跑完下面所有离线脚本并汇总 | `node tools/verify-all.mjs` | 7 行 `PASS` + `ALL PASS` | 否 |
| `check-typert-manifest.mjs` | typert 清单契约裁判（逐字复刻 `dsh-typert-loader` 的 `requireInvocation` / `requireStrictCodec`；5 个端点全覆盖） | `node tools/check-typert-manifest.mjs . dsh-model-toolkit` | `VERDICT: ACCEPT` + `endpoints covered : 5/5` | 否 |
| `verify-format.mjs` | B 的余量浮层文案/结构 + 悬停状态机（从真实 `client.js` 抽源码执行） | `node tools/verify-format.mjs` | 末行 `全部符合预期` | 否 |
| `verify-resilience.mjs` | B 的瞬时失败重试（network/429/5xx 重试、401 不重试）+ 缓存 TTL（失败 20s / 成功 5min） | `node tools/verify-resilience.mjs` | 末行 `全部符合预期` | 否（`globalThis.fetch` 是剧本化替身，不打厂商接口） |
| `verify-settings.mjs` | B 的设置读写：严格 schema（含未知键剥离）、默认值、写入落盘、脏数据夹回默认值 | `node tools/verify-settings.mjs` | 末行 `全部符合预期（临时目录已清理：…）` | 否 |
| `verify-inherit-nocompat.mjs` | A 的「继承自…」只写 `input` + `reasoningEfforts`、不写 `compat`，并用 `dsh-llm-pi-ai` 自己的 `COMPAT_GATES` 判定这份 ops 不会被设置层拒绝 | `node tools/verify-inherit-nocompat.mjs` | 末行 `VERDICT: PASS —— 继承只写图片+等级，compat 干净，保存不会被拒` | 否（只**读**本机安装的 `dsh-llm-pi-ai` 源码取 gate 表） |
| `verify-role-unset.mjs` | **夹具 A**：线路角色下拉选回「自动」时的 unset 分支——基线 2 个键只删叶子 `…compat.supportsDeveloperRole`，基线 1 个键整块删 `…compat` | `node tools/verify-role-unset.mjs` | 末行 `全部符合预期` | 否 |
| `verify-bulk-clear.mjs` | **夹具 B**：「清空能力」的现状行为记录（全局清空、无二次确认、保存前可撤销） | `node tools/verify-bulk-clear.mjs` | 末行 `全部符合预期（记录的是现状，不是期望）` | 否 |

## 关于 `verify-quota.mjs`

**本包不提供 `verify-quota.mjs`，也不要把它迁进来。**
它会用真实 API key 出网调厂商的余量接口，属于「需要单独征得同意」的出网验证，故意留在包外。

另外，主机侧接口在**运行中进程**里的真实可用性由包内脚本覆盖不到，那部分由包外的只读探针
`../_verify/probe-host-rpc.mjs` 负责（需要 GUI 正在运行，不属于本包发布内容）。

## 共同约定

- **可选参数**：`verify-format.mjs` / `verify-inherit-nocompat.mjs` / `verify-role-unset.mjs` / `verify-bulk-clear.mjs`
  接受 `node tools/xxx.mjs <client.js 路径>`，用同一套断言去测历史版本（例如 `git show` 出来的旧包产物），
  不传则默认指向本包的 `../client/client.js`。
- **写盘**：只有 `verify-settings.mjs` 会写盘，写的是 `os.tmpdir()` 下的临时 `DSH_HOME`，跑完自动删除；
  其余脚本全部只读，`settings.mutate` 用假 bridge 拦截并只记录 ops。
- **夹具的语义**：`verify-role-unset.mjs` 的「1 个键 → 整块删」与 `verify-bulk-clear.mjs` 的全套断言
  记录的都是**当前实现**（含已知风险），不是期望行为。第二阶段若改语义（例如把守卫从
  `compatKeys.length <= 1` 收紧、或给「清空能力」加二次确认），这两个夹具必须同步更新。
