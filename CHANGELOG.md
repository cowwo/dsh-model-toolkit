# Changelog

本仓库记录 `dsh-model-toolkit` 的变更。格式参考
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

发布时在版本号后补上日期（`## [x.y.z] - YYYY-MM-DD`）。

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
