# dsh-model-toolkit

**Model Toolkit** is one DSH (DeepSeek Harness) plugin that does two things: it lets you declare the
**capabilities** of your hand-added models (image input, reasoning effort, system-message role) from a
settings section, and it shows a **provider badge with a hover panel and quota lookup** next to the model
seat in the input bar. It is the merge of two previously separate plugins, `dsh-model-fit` and
`dsh-provider-info`, into a single install.

> 中文文档：[README.zh.md](https://github.com/cowwo/dsh-model-toolkit/blob/main/README.zh.md)

| | |
| --- | --- |
| Package | `dsh-model-toolkit` (also published as `@cowwo/dsh-model-toolkit`) |
| Version | `0.1.0` |
| Plugin id | `model-toolkit` |
| Type | DSH Web profile bundle (a regular plugin, not a dynamic debug plugin) |
| Runtime deps | `zod@^4` — a real dependency: `lib/typert.host.js` imports it directly, and the DSH typert loader requires a **zod v4** schema (it checks the internal `_zod` marker). |
| Peer deps (optional) | `@deepseek-ai/cordis`, `@deepseek-ai/schemastery`, `@deepseek-ai/dsh-typert-protocol`, `@deepseek-ai/dsh-client-connection`, `@deepseek-ai/dsh-client-runtime`, `@earendil-works/pi-ai` — supplied by the DSH installation at runtime; every range is `*` so the plugin is not pinned to one DSH version. |

---

## What it does

### 1. Capability editing — **Settings → 模型能力管理** (Model capabilities)

DSH providers come in two flavours: **built-in** ones ship a full catalog (with reasoning levels and image
support), while **hand-added** ones only have a provider id, a base URL, a protocol and a model list you
type yourself. Those hand-added models cannot be given reasoning levels or image support from the native
Model settings page. This half writes that missing information straight into the `llm-pi-ai` settings
namespace, where the pi-ai adapter reads it at request time, so images and reasoning actually work.

The section shows a flat list of **all models of all providers** (each card carries its provider badge), with:

- **Image input** — a checkbox per model; on = `input: ['text','image']`, off = `input: ['text']`.
- **Reasoning effort** (the UI calls it 思考等级 / thinking level) — level pills (`off / high / max`, plus
  `minimal / low / medium / xhigh` behind "more…"). The **wire value** of a selected level is editable in
  place, so you can map a level to the exact string your upstream expects.
- **Inherit from…** — pick a model from the pi-ai catalog and copy its image modalities and reasoning
  levels (including wire values) onto the current model. `compat` is deliberately **not** inherited:
  catalog entries mix in fields DSH only allows the catalog itself to set, and writing one of those makes
  the settings layer reject the whole save. Your model's existing `compat` is left untouched.
- **Batch actions** — turn image input on for all `vision`/`omni` models, give every still-unconfigured
  model `off/high/max`, or clear capabilities (see *Known limitations* below).
- **Search / filter** — by model name, model id or provider name; plus "only configured".
- **Route-level system message role** — a per-route dropdown that writes
  `providers.<providerId>.compat.supportsDeveloperRole`. Use **force system** when an upstream only accepts
  the `system` role and DSH would otherwise send OpenAI's `developer` role (symptom: intermittent HTTP 422
  such as `unknown variant 'developer'`). "Auto" removes the field and lets pi-ai infer it. Only protocols
  that accept the field (`openai-completions`, `openai-responses`, `azure-openai-responses`,
  `openai-codex-responses`) are editable; other routes are greyed out with the reason.
- **One save for everything** — all changed providers are committed as a single `settings.mutate` call with
  one `expectedRevision`, so a save either lands completely or not at all. A green/red banner reports the
  real outcome (a failed write never claims "saved").

### 2. Badge & quota — **left of the model seat**, and **Settings → 提供商信息**

The input bar has a "model seat" showing the currently selected model. This half renders a small **badge**
to its left (via the official slot `conversation.input.right`, with a DOM-injection fallback for older DSH
builds) showing where that model comes from — the provider's **display name**, falling back to the
**provider ID**.

Hovering the badge opens a read-only popover with:

- the **provider block** — 5 rows: display name, Provider ID, API protocol, API base URL, key environment
  variable name;
- the **current model block** — 9 rows: model ID, display name, description, reasoning levels, current
  reasoning level, context window, max tokens, input modalities, compat info (missing values show
  "not provided");
- the **quota block** — the current provider's remaining balance or plan limits, with a **Refresh** button
  (bypasses the cache; queries are read-only and never bill or consume tokens).

The settings section **Settings → 提供商信息** contains the six interface settings (see below), the two
feature switches, and an **all-providers quota table** with the columns
`provider | 5h | week | month | balance | expiry | action`. Both the table and the popover render the same
data with the same labels; a provider that has no data for a column simply leaves it empty.

Original six settings (persisted in the plugin's own JSON file):

| Setting | Default | What it does |
| --- | --- | --- |
| Auto refresh on hover (显示悬浮窗自动刷新) | on | Re-query the latest quota every time the popover opens, bypassing the cache. Off = use the cache. |
| Scheduled refresh (定时刷新) | off | Re-query at a fixed interval while the popover is open. |
| Refresh interval, minutes (定时刷新间隔) | 5 (min 1) | Interval for the above; disabled/greyed out while scheduled refresh is off. |
| Show more details (显示更多信息) | on | Also show amounts (used/total) on window rows, reset countdowns in the popover, and days-left next to the expiry date. |
| Font size (字体大小) | Medium | Scales the popover only (small / medium / large). |
| Language (界面语言) | Follow system (dsh) | Language of the popover and this settings section. Forcing a language here does not change DSH's own language. |

## Feature switches

Both switches live in the **Settings → 提供商信息** section and are stored in the plugin's own JSON file.
They exist because the merge left a single browser plugin entry: you can no longer disable half of the
plugin from the DSH plugin page, so the plugin provides its own toggles.

| Key | Default | When turned off | Where to toggle | When it takes effect |
| --- | --- | --- | --- | --- |
| `capabilityEditor` | `true` | The **模型能力管理** settings section is no longer shown, and the plugin no longer writes to your model configuration. | Checkbox in **Settings → 提供商信息** | After a **page refresh** |
| `badgeAndQuota` | `true` | No provider badge, no hover popover and no quota queries in the input bar. The **提供商信息** settings section still opens (that is where the switches live). | Checkbox in **Settings → 提供商信息** | After a **page refresh** |

These are feature toggles, not plugin switches: the plugin itself stays loaded either way.

---

## Install

The plugin is a **profile bundle**: installing it edits the profile's `package.json` and its
`dsh.profile.bundles` list. Adding or removing the bundle therefore needs a **restart of `dsh web`**
(bundle composition happens at startup). Changes that only touch client code need nothing more than a page
refresh.

### Option 1 — mount a local directory with a `link:` spec

This is what a local checkout uses. Add the dependency and the bundle entry to the web profile:

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

Then install the link and restart:

```sh
cd ~/.dsh/profiles/web
npm install          # or: pnpm install
# restart dsh web
```

### Option 2 — install from npm

```sh
# bare name
dsh plugin --profile web add dsh-model-toolkit

# or the scoped name (same package, same version)
dsh plugin --profile web add @cowwo/dsh-model-toolkit

# restart dsh web, then refresh the page
```

### Uninstall / restore

```sh
dsh plugin --profile web remove dsh-model-toolkit
# restart dsh web: the plugin row and both settings sections disappear
```

- Removing the plugin does **not** delete the capability data you wrote: it stays in the `llm-pi-ai`
  settings namespace and keeps working. To clear it, use "clear capabilities" and save *before* uninstalling
  (see the warning below), or edit the `llm-pi-ai` configuration by hand.
- The badge/quota half keeps its settings in `$DSH_HOME/dsh-provider-info.json`; deleting that file resets
  this half to its defaults.

---

## Where the data lives

The merge deliberately keeps **two** storage locations — no user data had to move, so there is no migration
step (see `docs/adr/0002-two-persistence-stores.md`).

| Half | Where it writes | What is stored |
| --- | --- | --- |
| Capability editing | DSH's `llm-pi-ai` **settings namespace** | Model level: `providers.<providerId>.models[]` — `input`, `reasoningEfforts`, `compat`. Route level: `providers.<providerId>.compat.supportsDeveloperRole`. Written through the official `settings.mutate` path, so it takes effect immediately and is the same data the native Model settings page reads. |
| Badge & quota | The plugin's own file `$DSH_HOME/dsh-provider-info.json` (default `~/.dsh/dsh-provider-info.json`, written with mode `0600`) | This half's settings only: the six interface settings above plus the two feature switches. **The filename is intentionally unchanged** from the standalone `dsh-provider-info`, so existing users keep their settings. Quota responses live in memory caches, not in this file. |

---

## Network access and credentials

The badge/quota half performs **outbound HTTP requests** to vendor APIs to read your remaining balance or
plan usage. It knows three vendors:

| Vendor | What is read |
| --- | --- |
| DeepSeek | Account balance (multi-currency). |
| OpenCode Go | Rolling 5-hour / weekly / monthly usage windows (percentage, reset time, amount converted from the plan price). |
| Command Code | 5-hour / weekly windows plus a monthly pool, and the subscription expiry from the billing cycle. |

Providers that are identified but not supported still show "not supported for queries"; a provider without
a configured key shows "no API key". All of these requests are **read-only**: they do not bill and do not
consume tokens. Failures are classified (`network unreachable` / `query timeout` / `429` / server error /
HTTP status) instead of collapsing into a single "query failed".

**When queries happen:**

- **Hovering the badge** with *auto refresh on hover* (default **on**) issues a fresh query each time the
  popover opens, bypassing the cache. Turn that setting off to serve the cached value instead.
- **Opening Settings → 提供商信息** triggers one round of queries for the all-providers table (transient
  failures are retried once automatically after ~1.8 s; deterministic errors such as a missing key are not).
- **Scheduled refresh** (default off) re-queries while the popover is open, at the configured interval.
- The **Refresh** button in the popover always bypasses the cache.
- The host caches successful per-provider results for **5 minutes**; failed results are only de-duplicated
  for **20 seconds**, so one network hiccup cannot pin an error on screen for minutes. The client-side
  balance cache carries a TTL as well, so turning automatic refresh off cannot leave a stale number on
  screen indefinitely.
- Transient failures (`ECONNRESET`, timeouts, `429`, `5xx`) are retried once by the host; `401/403/404` are
  not retried. `[provider-badge] 余量查询失败 { provider, family, error }` is logged to the host console.

**There is no global master switch for the network.** If you want the plugin to stop talking to vendors
altogether, turn off **`badgeAndQuota`**: that disables the badge, the hover popover and the quota queries
as a whole.

**How the credential value is handled (accurate statement):**

- The browser never receives the key value. The frontend only ever learns the **name of the environment
  variable** (the "key env var" row).
- The **host process does read the key value** — it calls `ctx.credentials.resolve("<ENV_VAR_NAME>")` — and
  uses it **only** in the outbound HTTP request to the matching vendor.
- The key value is **never written to any file** by this plugin, and **never returned to the frontend**.

This corrects an earlier claim in the standalone `dsh-provider-info` README that the key value was never
read at all. The host has to read it to talk to the vendor.

---

## Known limitations

1. **"Clear capabilities" deletes globally and cannot be undone.** The button removes `input`,
   `reasoningEfforts` and `compat` for **every model of every route** at once — including fields you wrote
   by hand, such as `thinkingFormat` or `maxTokensField`. There is **no confirmation prompt**, and once you
   save, the change is **irreversible**. This is a known risk; the plan for phase 2 is the minimal fix of
   adding a confirmation step.
2. **The two halves are still two separate settings sections.** The merge put them in one package and one
   plugin entry, but `模型能力管理` and `提供商信息` have not been merged into a single UI.
3. **One browser plugin entry means half of the plugin cannot be disabled on its own.** Use the
   `capabilityEditor` and `badgeAndQuota` switches above instead. Note that they are plugin-internal
   settings, not DSH plugin switches — the plugin page still shows one plugin and one switch.

---

## Relationship to the old plugins and migration

`dsh-model-toolkit` 0.1.0 is the merge of:

| Old plugin | Version merged | Half it became |
| --- | --- | --- |
| `dsh-model-fit` ("模型能力管理") | `0.2.3` | Capability editing |
| `dsh-provider-info` ("输入框显示提供商") | `0.17.0` | Badge & quota |

The merge is **zero migration** — no data is moved:

1. Remove the two old plugins from the profile (`dsh plugin --profile web remove dsh-model-fit` and
   `… remove dsh-provider-info`, or edit `dsh.profile.bundles` by hand). Do not run them side by side with
   this package.
2. Install `dsh-model-toolkit` as described above and **restart `dsh web`**.
3. Your capability data keeps living in the `llm-pi-ai` settings namespace, and the badge/quota half keeps
   reading `~/.dsh/dsh-provider-info.json` (the file name did not change), so its six interface settings are
   carried over untouched. Both feature switches default to `true`, which matches having both old plugins
   installed and enabled.

---

## Development

**There is no build step.** `client/client.js` is a **hand-written, pre-built bundle committed to the
repository** (in DSH's `__ModuleLoader__` format), and `lib/index.js` is plain ESM. Edit the source and it
takes effect — there is no bundler to run and the package declares no npm scripts.

```
dsh-model-toolkit/
├── package.json           # package metadata + dsh.bundle.patch + dsh.client declaration
├── cordis.patch.yml       # inserts the plugin row `model-toolkit` into a profile
├── lib/
│   ├── index.js           # host: ModelCapabilityService + ProviderBadgeService, one entry point
│   ├── catalog.js         # catalog helpers
│   └── typert.host.js     # the merged typert host manifest (5 endpoints)
├── client/
│   └── client.js          # one pre-built browser bundle, two internal scopes
├── tools/                 # development-time verification scripts (not shipped)
├── docs/adr/              # architecture decision records for the merge
└── GLOSSARY.md            # the domain vocabulary used by this project's docs
```

- **One package, one plugin entry.** One `npm` package, one plugin row (`model-toolkit`), one browser
  entry. `lib/index.js` mounts both services: `ModelCapabilityService` and `ProviderBadgeService`.
- **One typert manifest, five endpoints:** `modelCapability/source`, `providerBadge/modelInfo`,
  `providerBadge/balance`, `providerBadge/settings`, `providerBadge/providers`.
- **One client bundle, two independent scopes** (module 1 = capability settings page, module 2 =
  badge/quota). The type symbols in the manifest keep their original `dsh-model-toolkit#…` prefixes.
- **UI integration points:** settings sections `model-fit` (order 12) and `provider-info` (order 13), and
  the badge slot `conversation.input.right` (order 15, with a DOM-injection fallback when the slot is not
  available).
- **Verification scripts** live in `tools/` and run with plain Node. They are development-time only, are not
  listed in the package's `files`, and are therefore not published. They never touch the network and never
  write your real `$DSH_HOME`. **`tools/README.md` is the authoritative list** of what each script checks;
  run the whole offline suite from the package root with:

  ```sh
  node tools/verify-all.mjs
  ```

  Individual scripts can be run on their own, for example `node tools/verify-format.mjs` (rendering strings
  and the hover state machine, extracted from the real `client/client.js`) or
  `node tools/check-typert-manifest.mjs . dsh-model-toolkit` (the typert manifest contract, 5 endpoints).
  Outbound verification is deliberately kept **outside** this directory: the old repository's
  `verify-quota.mjs` would call the vendor APIs with a real API key and needs explicit consent, so it is not
  part of the package.

---

## License

MIT © cowwo
