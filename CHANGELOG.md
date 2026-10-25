# Changelog

本仓库记录 `dsh-model-toolkit` 的变更。格式参考
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

发布时在版本号后补上日期（`## [x.y.z] - YYYY-MM-DD`）。

## [0.5.2] - 2026-10-25

**消息模型开关拆分**：删掉「显示时机」下拉，改为「用户问题」「模型回答」两个独立开关；开关打开即每轮显示。

### Changed

- 设置项收敛为 4 项：`subagentModelLabel`、`changedModelBadge`、`messageQuestionModelLabel`、`messageAnswerModelLabel`。
- 移除 `messageModelLabelMode`（change-only / always）与 `messageModelLabel` 总开关。
- 用户消息行与助手轮尾各自独立控制，可以只显示其中一处；不再判断「模型是否变化」。

### Migration

- 首次读取时自动迁移：旧 `messageModelLabel: false` → 两个新开关都关；其余情况都开。
- 迁移后写回配置文件并删除旧键（`messageModelLabel`、`messageModelLabelMode`），无需手动编辑。

## [0.5.1] - 2026-10-25

**模型名蓝色高亮 + 打开即显示**：三处模型标识统一改成蓝色；数据改为「进会话就预取 + 本地缓存」，打开浮层或刷新页面不再等接口。

### Changed

- **三处统一蓝色高亮**：子智能体第 3 行、助手轮尾、用户消息行的 `provider/model` 全部用蓝色（字重 500）；
  浅色主题 `#2563eb`，深色主题按页面实际底色自动切 `#7aa2ff`。
- **预取 + 本地缓存**：进入会话即取数，结果按会话 id 存进 `localStorage`（保留 7 天、最多 12 个会话）；
  打开浮层先用缓存同步渲染再后台校正，60 秒内的缓存不重复请求。
- **合并窗口 60ms → 16ms**：React 重渲染后标签立刻补回，肉眼看不到空档。

## [0.5.0] - 2026-10-25

**模型标识（model label）**：在子智能体浮层、助手回复轮尾、用户消息行追加 `提供商/模型` 字样。
全部是**纯追加**节点：不删除、不改写、不移动、不隐藏任何官方元素；官方以后若自带同类信息则自动让位。

### Added

- **子智能体浮层**：每行新增第 3 行显示该子会话最近实际使用的 `provider/model`；
  外部执行行显示灰色「外部」；该子会话用过多个模型时追加「用过 N 个」。
- **消息行**：助手回复轮尾与用户消息行动作行末尾追加 `provider/model`，
  支持「仅在模型变化时」与「每条都标」两种时机；两者都保留官方按钮、用量与时间。
- **主机侧两条只读接口**：`GET /dsh-model-toolkit/api/subagents?sessionId=` 与
  `GET /dsh-model-toolkit/api/turns?sessionId=`（400/405/500/503 分支齐全，会话租约用完即释放）。
- **设置页「模型标识」分组**：`subagentModelLabel`、`messageModelLabel`、
  `messageModelLabelMode`（change-only / always）、`changedModelBadge`，存 `dsh-provider-info.json`。

### Fixed

- 可选服务读取未声明 inject 导致接口永久 503：改用 `ctx.get()` 兜底 + `ctx.inject()` 捕获。
- 新版 DSH 的会话列表快照没有 `current` 字段：改从聊天容器的 `data-conversation-session` 取当前会话。
- `providerBadge/settings` RPC 不可用时设置读不到：回退 `GET /api/state` 的 prefs。
- 宽度阈值按真实布局重测（子智能体内容列约 210px、用户消息动作行更窄），避免标签被误判「放不下」而隐藏。
- 取数失败/浮层暂时关闭时不再清空缓存，修复标签「一瞬间消失又出现」的闪烁。

## [0.2.0] - 2026-10-19

**独立整页设置页落地**：设置面板收敛为「模型工具箱」单入口，全部能力搬进 `web/` 独立页（三张表 + 锚点导航 + 增量保存）。

### Changed

- **独立设置页布局修订（方案 A，控件按归属下沉）**：顶栏只保留全局动作（语言 / 主题 / 撤销修改 / 保存）；
  搜索、线路筛选、只看已配置、批量操作下沉到「模型能力」区块；「余量最紧」摘要移入「线路余量」区块；
  「生成于 / 修订」移到页脚；<1024px 新增吸底保存条。契约见 `_spec/webpage-v1.md` §11。
- compat 徽标改为模型 ID 下方一行（11px、弱化色），修复与 ID 粘连、被截断；能力表列宽调整，
  1440px 下零横向滚动。
- 无障碍：两个表格的 `<th>` 全部 `scope="col"`；通知条 `role="status"` + `aria-live="polite"`；
  「继承自…」弹窗支持 Esc 关闭 / Tab 焦点陷阱 / 关闭后归还焦点；保存按钮保存中带 `aria-busy`。

### Fixed

- **「撤销修改」按钮点了没反应**：调用未定义的 `undoAll()`，浏览器抛 `ReferenceError`，改动撤不掉——已实现。
- **保存途中继续编辑会被静默吞掉**：保存成功后基线曾被写成「当前草稿」，在途期间的改动被当成已保存；
  现在基线 = 本次实际提交的快照，剩余改动仍算脏。
- **409 版本冲突后反复 409**：冲突后不更新 revision、保存按钮仍可点；现在冲突后锁住保存，只留「重新加载」。
- **余量整表失败时表格错位**：错误行两个 `td` 的 colspan 相加（6+5）超过表头 6 列；合并为单个 `td`。
- **批量操作会改到被搜索/筛选隐藏的勾选行**：现在只作用于当前可见的勾选行，并提示跳过的行数。
- **「清空能力」只清等级键、不清 `reasoningEfforts`**：旧 wire 值会复活；现在两者同步清空。

### Added

- 开发用浏览器交互验收脚本（本地开发用，**不随 npm 包发布**，仓库里也没有）：覆盖撤销、保存途中继续编辑、
  409 锁保存、余量错误行、布局归属、compat 徽标、1440/390 溢出、页脚修订号 +1、窄屏吸底条状态同步。
- `tools/verify-webpage.mjs`：页面契约的离线验收（假 `ctx` + 真插件代码，30 项断言）。

## [0.1.0]

**首个版本：由 `dsh-model-fit` 0.2.3 与 `dsh-provider-info` 0.17.0 两个已发布插件合并而成。**
合并的单位是「一个 npm 包、一个插件条目、一个浏览器条目」——两块功能装一次就有，代价见下方「已知未处理项」。

### Added

- **合并后的包结构**
  - 一个包 `dsh-model-toolkit`（同时发布裸名与 `@cowwo/dsh-model-toolkit`），版本 `0.1.0`。
  - 一个插件条目：插件 id / 行 id 为 `model-toolkit`（`cordis.patch.yml` 只插入这一行）。
  - `lib/index.js` 单入口挂两个 Service：`ModelCapabilityService`（来自 `dsh-model-fit`）与
    `ProviderBadgeService`（来自 `dsh-provider-info`）。
  - 两份 typert 清单合并成一份（`lib/typert.host.js`），共 5 个端点：`modelCapability/source`、
    `providerBadge/modelInfo`、`providerBadge/balance`、`providerBadge/settings`、`providerBadge/providers`。
  - 两个 client bundle 合并成 `client/client.js` 一个文件，内部保留两个互相独立的作用域。
  - 设置页仍是两个分区（刻意未做 UI 融合）：「模型能力管理」（`settings.section` id `model-fit`，order 12）
    与「提供商信息」（id `provider-info`，order 13）。
- **「能力编辑」这一半（原 `dsh-model-fit` 0.2.3 的全部功能）**
  - 为手动添加的模型设置图片输入（`input`）与推理强度（`reasoningEfforts`，含可编辑的线上取值）。
  - 「继承自…」：从 pi-ai 目录模型继承**图片输入与思考等级**；`compat` 不继承，避免命中 DSH 的目录专有字段
    导致设置层拒绝整次保存。
  - 线路级「系统消息角色」：写入 `providers.<providerId>.compat.supportsDeveloperRole`，绕开只认 `system`
    的上游返回的 `developer` 422。
  - 批量开视觉 / 批量开推理 / 清空能力，搜索与「只看已设置」，跨供应商一次 `settings.mutate` 保存，撤销修改。
  - 数据仍写 DSH 的 `llm-pi-ai` 设置命名空间。
- **「徽章与余量」这一半（原 `dsh-provider-info` 0.17.0 的全部功能）**
  - 输入框模型座左侧的提供商徽章（显示名优先，回退 Provider ID），走官方槽位
    `conversation.input.right`，旧版 DSH 回退为 DOM 注入。
  - 悬停信息浮层：提供商 5 行 + 当前模型 9 行 + 余量区块（余额型回金额，套餐型回窗口用量；只读、不扣费）。
  - 设置页「提供商信息」：原有 6 个设置项 + 全部提供商余量表格
    （`提供商 | 5小时 | 周 | 月 | 余额 | 到期 | 操作`）。
  - 数据仍写插件自有文件 `$DSH_HOME/dsh-provider-info.json`（**文件名保持不改**，所以老用户零迁移），权限 `0600`。
  - 出网只查 DeepSeek（余额）、OpenCode Go（5小时/周/月窗口）、Command Code（5小时/周窗口 + 月度池 + 到期）三家。
- **两个功能开关**（新增，取代原来「两个插件可以分别禁用」的能力）

  | 键 | 默认 | 关闭后 | 在哪勾 | 何时生效 |
  | --- | --- | --- | --- | --- |
  | `capabilityEditor` | `true` | 设置页不再显示「模型能力管理」，也不再写入用户的模型配置 | 设置 → 提供商信息 | 刷新页面后 |
  | `badgeAndQuota` | `true` | 输入框不再显示徽章、悬停浮层与余量查询；设置页「提供商信息」仍可打开 | 设置 → 提供商信息 | 刷新页面后 |

  两个键都存在 `~/.dsh/dsh-provider-info.json` 里。它们只关功能，不关插件。
- `docs/adr/0001-one-package-one-plugin-entry.md`（为什么是一个包一个条目）与
  `docs/adr/0002-two-persistence-stores.md`（为什么保留两套持久化）；`GLOSSARY.md` 领域词汇表。

### Changed

- **零迁移**：合并只搬代码、不搬数据。两块功能的老用户升级后，能力数据仍在 `llm-pi-ai` 设置命名空间，
  徽章那一半的 6 个设置仍从同名的 `dsh-provider-info.json` 读取，无需任何迁移代码。
- 两个开关的默认值都是 `true`，因此从旧插件迁过来的行为与「两个旧插件都装着并启用」一致。
- 安装单位从两个 profile bundle 变成一个：先移除 `dsh-model-fit` 与 `dsh-provider-info`，再装
  `dsh-model-toolkit`（增删 bundle 需重启 `dsh web`）。

### Fixed

- **写设置失败时不再假报「已保存」。** 保存结果以真实返回值判定，失败显示红色横幅与真实错误，不再出现
  「界面说保存成功、配置其实没落盘」的假成功（旧疾 ①）。
- **客户端余量缓存补上 TTL。** 此前关闭「显示悬浮窗自动刷新」后，客户端可能长期复用一份旧余量数字；
  现在缓存带 TTL，过期自动重查，界面不会一直挂着过期数据（旧疾 ②）。
- **文档口径更正：密钥值确实会被宿主进程读取。** 原 `dsh-provider-info` README 声称「密钥值从头到尾不会被读取」，
  与事实不符：宿主进程调用 `ctx.credentials.resolve("<环境变量名>")` 读取密钥值，**只**用于向对应厂商发出
  HTTP 请求。如实口径为——密钥值不会进入浏览器、不会写入任何文件、不会回传前端；浏览器侧只拿到「密钥环境变量的名字」（旧疾 ③）。

### 已知未处理项

- **「清空能力」的全局删除语义未改（计划第二阶段处理）。** 该按钮会一次性删除**所有线路、所有模型**的
  `input` / `reasoningEfforts` / `compat`，**包括用户手写的字段**（如 `thinkingFormat`、`maxTokensField`）；
  没有二次确认，保存后不可逆。本版本如实记录该风险，不做静默更改；最小改法是加二次确认。
- **两块功能仍是设置页里两个独立分区**，尚未做 UI 融合。
- **浏览器侧只有一个插件条目，无法单独禁用其中一半**——这是「一个包一个条目」明确付出的代价，只能用
  `capabilityEditor` / `badgeAndQuota` 近似；它们不是 DSH 的插件开关，插件页上看到的仍是「一个插件、一个开关」。
