# dsh-model-toolkit

**模型工具包**是一个 DSH（DeepSeek Harness）插件，同时做两件事：在设置页为**手动添加的模型**声明能力
（图片输入、推理强度、系统消息角色），以及在输入框的**模型座**左侧显示**提供商徽章**——悬停弹出信息浮层，
并可查询余量。它由两个原本独立的插件 `dsh-model-fit` 与 `dsh-provider-info` 合并而来，现在只需装一个。

> English docs: [README.md](https://github.com/cowwo/dsh-model-toolkit/blob/main/README.md)

| | |
| --- | --- |
| 包名 | `dsh-model-toolkit`（同时发布为 `@cowwo/dsh-model-toolkit`） |
| 当前版本 | `0.1.0` |
| 插件 id | `model-toolkit` |
| 类型 | DSH Web Profile Bundle（正式插件，非动态调试插件） |
| 运行依赖 | `zod@^4` —— 真实 dependency：`lib/typert.host.js` 直接 import 它，而 DSH 的 typert 校验要求 schema 必须是 **zod v4**（判据是内部标记 `_zod`）。 |
| peer 依赖（可选） | `@deepseek-ai/cordis`、`@deepseek-ai/schemastery`、`@deepseek-ai/dsh-typert-protocol`、`@deepseek-ai/dsh-client-connection`、`@deepseek-ai/dsh-client-runtime`、`@earendil-works/pi-ai` —— 运行时由 DSH 安装目录提供；范围统一为 `*`，不把插件钉死在某个 DSH 版本上。 |

---

## 它能干什么

### 1. 能力编辑 —— **设置 → 模型能力管理**

DSH 的模型供应方分两类：**内置**（自带完整目录，含推理强度与图片能力）和**手动添加**（只填 Provider ID、
地址、协议，模型列表自行填写）。手动添加的模型在原生「模型」设置页里既选不了推理强度，也开不了图片输入。
这一半把缺失的信息直接写进 `llm-pi-ai` 设置命名空间，运行时由 pi-ai 适配器解析生效，因此请求时图片与推理真正可用。

这个分区把**所有供应商的所有模型平铺展示**（每张卡片带所属供应商徽章），包含：

- **图片输入** —— 每个模型一个复选框；勾选 = `input: ['text','image']`，取消 = `input: ['text']`。
- **推理强度**（界面文案叫「思考等级」）—— 等级 pill（`off / high / max`，更多里有
  `minimal / low / medium / xhigh`）。选中等级后还能**就地编辑线上取值**，把等级映射成上游真正接受的字符串。
- **继承自…** —— 从 pi-ai 目录里挑一个模型，把它的图片模态与思考等级（含线上取值）套到当前模型。
  `compat` **故意不继承**：目录条目的 `compat` 混着 DSH 只允许目录自己设置的字段，抄进配置会让设置层
  拒绝整次保存。目标模型原有的 `compat` 原样保留。
- **批量操作** —— 把所有 `vision`/`omni` 模型批量开图片、给尚无推理配置的模型设为 `off/high/max`，
  或「清空能力」（风险见下方「已知限制」）。
- **搜索与过滤** —— 按模型名 / 模型 id / 供应商名搜索，另有「只看已设置」。
- **线路级系统消息角色** —— 按线路的下拉，写入 `providers.<providerId>.compat.supportsDeveloperRole`。
  某些上游只认 `system` 角色，而 DSH 对推理模型默认发 OpenAI 的 `developer` 角色，会间歇性 422
  （形如 `unknown variant 'developer'`）；选「强制 system」即可从源头绕开。「自动」= 删除该字段，
  交回 pi-ai 推断。只有认这个字段的协议（`openai-completions` / `openai-responses` /
  `azure-openai-responses` / `openai-codex-responses`）可编辑，其它线路置灰并给出原因。
- **一次保存** —— 所有有变更的供应商合并成一次 `settings.mutate`、共用一个 `expectedRevision`，
  要么全落盘要么全不落。保存结果显示真实的成功/失败（写失败时绝不会假报「已保存」）。

### 2. 徽章与余量 —— **模型座左侧**与**设置 → 提供商信息**

输入框里的「模型座」显示当前选中的模型。这一半在它左侧渲染一个小**徽章**（走官方槽位
`conversation.input.right`，旧版 DSH 没有该槽位时自动回退为 DOM 注入），显示该模型的来源——优先
提供商的**显示名**，拿不到时回退 **Provider ID**。

鼠标悬停徽章会弹出一个只读浮层，内容分三段：

- **提供商区块** —— 5 行：显示名称、Provider ID、API 协议、API 地址、密钥环境变量名；
- **当前模型区块** —— 9 行：模型 ID、模型展示名、模型描述、推理等级、当前推理等级、上下文窗口、
  最大 token、输入模态、兼容信息（缺失的值显示「未提供」）；
- **余量区块** —— 当前提供商的余额或套餐限额，带「刷新」按钮（绕过缓存；查询是只读的，不扣费、不消耗 token）。

设置页的「**提供商信息**」分区包含上文那 6 个设置项、两个功能开关，以及一张**全部提供商余量**表格，
列名为 `提供商 | 5小时 | 周 | 月 | 余额 | 到期 | 操作`。表格与浮层用的是同一份数据、同一套文案；
某个维度没有数据就留空。

原有 6 个设置项（保存在插件自己的 JSON 文件里）：

| 设置项 | 默认 | 作用 |
| --- | --- | --- |
| 显示悬浮窗自动刷新 | 开 | 浮窗打开时立即重新查询最新余量（绕开缓存）。关闭则走缓存。 |
| 定时刷新 | 关 | 浮窗打开时按设定间隔定时重新查询余量。 |
| 定时刷新间隔(分钟) | 5（最低 1） | 上一项的间隔；未开启定时刷新时该项禁用变灰。 |
| 显示更多信息 | 开 | 窗口行额外显示金额（已用/总额）、浮层显示重置倒计时、到期显示剩余天数。 |
| 字体大小 | 中 | 只缩放浮层（小 / 中 / 大）。 |
| 界面语言 | 跟随系统(dsh) | 浮层与这个设置分区的语言；在这里强制语言不会改动 DSH 自身的语言设置。 |

## 两个功能开关

两个开关都在**设置 → 提供商信息**分区里勾选，保存在插件自己的 JSON 文件中。它们存在的原因是：合并后浏览器侧
只有一个插件条目，无法再从 DSH 插件页单独禁用一半功能，所以改由插件内部提供开关。

| 键 | 默认 | 关闭后 | 在哪勾 | 何时生效 |
| --- | --- | --- | --- | --- |
| `capabilityEditor` | `true` | 设置页不再显示「模型能力管理」，也不会再写入你的模型配置。 | **设置 → 提供商信息**里的复选框 | **刷新页面**后 |
| `badgeAndQuota` | `true` | 输入框不再显示提供商徽章、悬停浮层与余量查询；但设置页「提供商信息」仍可打开（开关本身在这里）。 | **设置 → 提供商信息**里的复选框 | **刷新页面**后 |

它们是**功能开关**，不是插件开关：无论开关怎么设，插件本身都处于加载状态。

---

## 安装

本插件是 **profile bundle**：安装会改动 profile 的 `package.json` 与 `dsh.profile.bundles`。
因此**增删 bundle 需要重启 `dsh web`**（bundle 在启动时组合）。只改客户端代码的话，刷新页面即可。

### 方式一：用 `link:` 挂载本地目录

本地开发目录用的就是这种方式。在 web profile 里同时加上依赖与 bundle 条目：

```jsonc
// ~/.dsh/profiles/web/package.json
{
  "dsh": {
    "profile": {
      "bundles": [
        // …
        "dsh-model-toolkit"
      ]
    }
  },
  "dependencies": {
    // …
    "dsh-model-toolkit": "link:/path/to/dsh-model-toolkit"
  }
}
```

然后安装这个链接并重启：

```sh
cd ~/.dsh/profiles/web
npm install          # 或：pnpm install
# 重启 dsh web
```

### 方式二：从 npm 安装

```sh
# 裸名
dsh plugin --profile web add dsh-model-toolkit

# 或用 scoped 名（同一个包、同一个版本）
dsh plugin --profile web add @cowwo/dsh-model-toolkit

# 重启 dsh web，然后刷新页面
```

### 卸载 / 还原

```sh
dsh plugin --profile web remove dsh-model-toolkit
# 重启 dsh web：插件行与两个设置分区都消失
```

- 卸载插件**不会**删除你写的模型能力数据：它仍在 `llm-pi-ai` 设置命名空间里并继续生效。想清掉，请在
  **卸载之前**用「清空能力」并保存（注意下面的警告），或手工编辑 `llm-pi-ai` 配置。
- 徽章与余量那一半的设置仍在 `$DSH_HOME/dsh-provider-info.json`；删掉该文件即把这一半恢复为默认值。

---

## 数据存在哪两处

合并刻意保留**两处**存储——用户数据一件都不用搬，因此没有迁移步骤（见
`docs/adr/0002-two-persistence-stores.md`）。

| 哪一半 | 写在哪里 | 存了什么 |
| --- | --- | --- |
| 能力编辑 | DSH 的 `llm-pi-ai` **设置命名空间** | 模型级：`providers.<providerId>.models[]` 的 `input`、`reasoningEfforts`、`compat`。线路级：`providers.<providerId>.compat.supportsDeveloperRole`。走官方 `settings.mutate` 路径写入，即时生效，与原生「模型」设置页读的是同一份数据。 |
| 徽章与余量 | 插件自有文件 `$DSH_HOME/dsh-provider-info.json`（默认 `~/.dsh/dsh-provider-info.json`，权限 `0600`） | 只存这一半的设置：上面 6 个设置项 + 两个功能开关。**文件名刻意不改**（沿用独立插件 `dsh-provider-info` 的名字），老用户的设置因此零迁移。余量查询结果只在内存缓存里，不写进这个文件。 |

---

## 出网与密钥

徽章与余量那一半会向厂商接口发**出网 HTTP 请求**，读取你的余额或套餐用量。目前认识三家厂商：

| 厂商 | 读什么 |
| --- | --- |
| DeepSeek | 账户余额（多币种）。 |
| OpenCode Go | 5 小时 / 周 / 月三个滚动用量窗口（百分比、重置时间，金额按套餐价折算）。 |
| Command Code | 5 小时 / 周两个窗口 + 月度池，以及按计费周期推出的订阅「到期」。 |

已识别但不支持的厂商会显示「当前暂不支持查询当前提供商」；没配密钥的显示「未配置 API Key」。
这些请求都是**只读**的：不扣费、不消耗 token。失败会按原因分类显示（`网络不可达` / `查询超时` /
`请求过频（429）` / 服务端错误 / HTTP 状态），不会一律糊成「查询失败」。

**什么时机会出网：**

- **悬停徽章**时，若「显示悬浮窗自动刷新」（默认**开**）打开，则每次浮窗打开都重新查询、绕开缓存；
  关掉该设置就改用缓存值。
- **打开 设置 → 提供商信息** 会为「全部提供商余量」表格查一轮（属于瞬时失败的行约 1.8 秒后自动重试一次；
  缺密钥这类确定性错误不重试）。
- **定时刷新**（默认关）在浮窗打开时按设定间隔重新查询。
- 浮层里的**「刷新」按钮**总是绕过缓存强制查询。
- host 端把成功的单 provider 结果缓存 **5 分钟**；失败结果只做 **20 秒**短去重，一次网络抖动不会把
  「查询失败」钉在屏幕上好几分钟。客户端余量缓存也带 TTL，所以关掉自动刷新后不会长期显示旧数字。
- 瞬时失败（`ECONNRESET`、超时、`429`、`5xx`）host 端自动重试一次；`401/403/404` 这类确定性错误不重试。
  host 控制台会打一行 `[provider-badge] 余量查询失败 { provider, family, error }` 供排查。

**没有总开关。** 若想让插件完全不再联系厂商，请关掉 **`badgeAndQuota`**：它会整体停用徽章、悬停浮层与余量查询。

**密钥值的如实说明：**

- 浏览器侧拿不到密钥值，只知道**密钥环境变量的名字**（浮层里的「密钥环境变量」一行）。
- **宿主进程会读取密钥值**——它调用 `ctx.credentials.resolve("<环境变量名>")`——并且**只**把它用于向对应厂商
  发出的那次 HTTP 请求。
- 密钥值**不会写入任何文件**，也**不会回传前端**。

这里更正了独立插件 `dsh-provider-info` 早期 README 里「密钥值从头到尾不会被读取」的说法：宿主必须读它才能向厂商发请求。

---

## 已知限制

1. **「清空能力」是全局删除，且不可撤销。** 这个按钮会一次性删除**所有线路、所有模型**的 `input`、
   `reasoningEfforts` 和 `compat`——包括你手写的字段（如 `thinkingFormat`、`maxTokensField`）。
   **没有二次确认**，保存后**不可逆**。这是已知风险，计划在第二阶段处理（最小改法是加二次确认）。
2. **两块功能目前仍是设置页里两个独立分区。** 合并把它们放进了同一个包、同一个插件条目，
   但「模型能力管理」与「提供商信息」尚未做 UI 融合。
3. **浏览器侧只有一个插件条目，无法单独禁用其中一半。** 请改用上面的 `capabilityEditor` 与
   `badgeAndQuota` 开关。注意它们是插件内部设置，不是 DSH 的插件开关——插件页看到的仍是「一个插件、一个开关」。

---

## 与两个旧包的关系与迁移

`dsh-model-toolkit` 0.1.0 由以下两个插件合并而成：

| 旧插件 | 合并的版本 | 成为哪一半 |
| --- | --- | --- |
| `dsh-model-fit`（模型能力管理） | `0.2.3` | 能力编辑 |
| `dsh-provider-info`（输入框显示提供商） | `0.17.0` | 徽章与余量 |

合并是**零迁移**——不搬数据：

1. 从 profile 里移除两个旧插件（`dsh plugin --profile web remove dsh-model-fit` 与
   `… remove dsh-provider-info`，或手工编辑 `dsh.profile.bundles`）。不要把旧插件与本包同时运行。
2. 按上文安装 `dsh-model-toolkit`，并**重启 `dsh web`**。
3. 你的能力数据仍在 `llm-pi-ai` 设置命名空间里；徽章与余量那一半仍读 `~/.dsh/dsh-provider-info.json`
   （文件名没变），所以那 6 个设置项原样沿用。两个功能开关默认都是 `true`，效果等同于「两个旧插件都装着并启用」。

---

## 开发说明

**没有构建步骤。** `client/client.js` 是**手写并提交进仓库的预构建 bundle**（DSH 的 `__ModuleLoader__` 格式），
`lib/index.js` 是普通 ESM。改完即生效——没有打包器要跑，包也没有声明任何 npm script。

```
dsh-model-toolkit/
├── package.json           # 包描述 + dsh.bundle.patch + dsh.client 声明
├── cordis.patch.yml       # 向 profile 插入插件行 `model-toolkit`
├── lib/
│   ├── index.js           # 宿主：ModelCapabilityService + ProviderBadgeService，单入口
│   ├── catalog.js         # 目录辅助函数
│   └── typert.host.js     # 合并后的 typert 主机清单（5 个端点）
├── client/
│   └── client.js          # 一个预构建浏览器 bundle，内部两个独立作用域
├── tools/                 # 开发期验证脚本（不随包发布）
├── docs/adr/              # 本次合并的架构决策记录
└── GLOSSARY.md            # 本项目文档使用的领域词汇表
```

- **一个包、一个插件条目。** 一个 npm 包、一个插件行（`model-toolkit`）、一个浏览器条目。
  `lib/index.js` 挂两个 Service：`ModelCapabilityService` 与 `ProviderBadgeService`。
- **一份 typert 清单、5 个端点：** `modelCapability/source`、`providerBadge/modelInfo`、
  `providerBadge/balance`、`providerBadge/settings`、`providerBadge/providers`。
- **一个 client bundle、两个独立作用域**（模块 1 = 能力设置页，模块 2 = 徽章与余量）。
  清单里的 typeSymbol 保留原来的 `dsh-model-toolkit#…` 前缀。
- **界面接入点：** 设置分区 `model-fit`（order 12）与 `provider-info`（order 13）；
  徽章槽位 `conversation.input.right`（order 15，槽位不可用时回退为 DOM 注入）。
- **验证脚本**在 `tools/` 下，用普通 Node 就能跑。它们只用于开发，不在包 `files` 清单里，因此不随包发布；
  既不联网，也不写你真实的 `$DSH_HOME`。**`tools/README.md` 是脚本清单与各自验什么的权威说明**，
  在包根目录一键跑完全部离线脚本：

  ```sh
  node tools/verify-all.mjs
  ```

  也可以单独跑某一个，例如 `node tools/verify-format.mjs`（浮层文案与悬停状态机，从真实
  `client/client.js` 抽源码执行）、`node tools/check-typert-manifest.mjs . dsh-model-toolkit`
  （typert 清单契约，5 个端点全覆盖）。
  **出网验证刻意留在本目录之外**：旧仓库的 `verify-quota.mjs` 会用真实 API key 调厂商接口，
  需要单独征得同意，不属于本包内容。

---

## 许可

MIT © cowwo
