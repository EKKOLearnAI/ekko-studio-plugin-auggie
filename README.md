# Augment Auggie for Ekko Studio

Run the official Auggie CLI over ACP in a Studio Global coding chat. The stable Agent ID is `plugin:auggie/auggie`.

## Install

1. In **Studio → Plugins → Install from source**, choose an Auggie release or the absolute path to this checkout. Review the source and enable the plugin.
2. In **Agent Management**, a Studio super admin can click **Install** on the Auggie card. The Studio backend needs a usable Node.js and npm installation and access to the official npm registry. The managed channel tracks the stable `@augmentcode/auggie@latest` release. The tested stable engine is `1.2.2`. [Augment installation](https://docs.augmentcode.com/cli/setup-auggie/install-auggie-cli)
3. In a terminal on the **Studio backend host**, sign in as the OS user running Studio. For a Studio-managed 1.x engine, use the same version shown on the card to run the official login command through npm.

   ```sh
   npm exec --yes --package=@augmentcode/auggie@1.2.2 -- auggie auth login
   npm exec --yes --package=@augmentcode/auggie@1.2.2 -- auggie auth status
   ```

   An existing 1.x installation can use `auggie auth login` directly. For 0.37.x, use `auggie login`. The terminal command authenticates the native Augment account in the OS user’s home directory. [1.x authentication](https://docs.augmentcode.com/cli/setup-auggie/authentication) · [0.x authentication](https://docs.augmentcode.com/cli/v0/setup-auggie/authentication)
4. Open a new Auggie **Global** chat and select a workspace. The native model catalog appears when Auggie exposes it.

### Update or delete the managed CLI

Use **Check for update** and then **Update to v…** in Agent Management. **Delete** removes the selected managed release from the plugin data directory. Augment login, native settings, Studio conversations and external installations are preserved. Deletion makes **Install** available again.

Studio uses an existing CLI when it finds one before any managed release has been selected. Set `EKKO_AUGGIE_EXECUTABLE` in the backend process environment to take explicit precedence. On Windows, Studio looks at PATH and `%APPDATA%/npm` for the official package entry points. With a custom npm prefix, point the override to the absolute `auggie-v2.mjs` or `augment.mjs` path. Update or delete an external CLI through its original installer. [Selection and deletion boundaries](docs/CONTRACTS.md#engine-management)

### 中文安装

启用插件后，由超级管理员在「Agent 管理」点击「一键安装」。在运行 Studio 后端的机器，用同一操作系统账号执行上述登录命令，再新建 Auggie「全局」单聊。托管版可在卡片检查更新、更新或删除。已有外部 CLI 由原安装器维护。删除托管引擎会保留登录和配置。

## Native configuration

Open **Agent Management → Augment Auggie → Settings** using the Studio account and Profile that activated the plugin. These views manage the host OS user's Auggie configuration used by Global turns.

| View | Manages |
| --- | --- |
| Skills | List, create, edit or remove `~/.augment/skills/<name>/SKILL.md`. Supply YAML front matter with matching `name` and a `description`. Removing the Skill leaves the directory's other resources in place. |
| MCP servers | List, add, edit or remove user `mcpServers` entries in `~/.augment/settings.json`. Supported transports are `stdio`, `http` and `sse`. Keep `[stored value]` at the same position to retain a saved command, argument, URL, environment value or header. Connection status and tool diagnostics are available in the native CLI. |
| Configuration | Patch `defaultModel`, `enableSkillCommands`, `enableToolSearch`, `theme` and `notificationMode`. Omitted values are preserved and `null` removes a user override. Unrelated JSONC configuration and comments are preserved. Terminal preferences apply to the native CLI. |

The user directory is `%USERPROFILE%/.augment` on Windows. The same host-user paths are used for an official external CLI and the Studio-managed installation. Each new Global turn starts a fresh process and applies Auggie's configuration rules. Project-local, project and organization settings can override user defaults. In the official 1.2.2 probe, Auggie picked a project Skill when both layers had the same name, so a user Skill may be shadowed. Project files, compatible directories such as `.agents/skills`, and organization settings are managed outside these pages. A CLI wrapper that chooses another Auggie config root requires native management. [Augment settings](https://docs.augmentcode.com/cli/settings.md) · [Agent Skills](https://docs.augmentcode.com/cli/skills) · [MCP](https://docs.augmentcode.com/cli/integrations)

在「Agent 管理 → Augment Auggie → 设置」进入 Skill、MCP 和配置文件。页面显示 Global 所用的宿主用户目录。Skill 删除只移除 `SKILL.md`，MCP 的已有值会遮蔽，配置页只写表中的偏好字段。项目覆盖仍由 Auggie 原生规则处理。

## Modes

**Global** uses the host OS account’s native Augment login, configuration and native model catalog. It is available to the Studio account and Profile that enabled the plugin.

**Scoped** requires the CLI to send inference requests to the Studio-selected model through Studio’s temporary proxy. Auggie 1.2.2 and the tested 1.3.0 preview reject extension provider registration. A Pi-compatible `models.json` did not route a request to a local Chat Completions endpoint in either version. The plugin registers Global only. The upstream dependency is a supported way to bind a custom inference endpoint and model in official Auggie ACP. [Auggie ACP](https://docs.augmentcode.com/cli/acp/agent) · [Auggie CLI flags](https://docs.augmentcode.com/cli/reference) · [Studio model-mode contract](https://github.com/EKKOLearnAI/ekko-studio/blob/fbb9185552cb8d0680c6d0ef4808501ef637e384/docs/plugins.md#global-与-scoped)

## Runtime and verification

- The selected Studio workspace is passed as both cwd and the ACP workspace. Auggie applies its native indexing and workspace trust rules.
- Each turn starts a fresh native ACP session and uses Studio conversation history. Stop cancels the active prompt. ACP approvals in Studio apply once. The native CLI still controls its tool permission policy.
- Images use ACP image blocks when advertised. Files use embedded resources, inline UTF-8 text, or private temporary files for file tools. The total per-turn attachment limit is 8 MiB.
- This release exposes single chat and streaming. Native session resume stays disabled.
- The local official CLI checks cover 0.37.0 and 1.2.2 on macOS arm64. GitHub Actions uses protocol and engine-management fixtures on Linux, macOS and Windows. Official Linux, Windows native and WSL execution, authenticated replies, workspace indexing and native permissions require separate verification. Augment’s install guide lists macOS, Linux and Windows WSL.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run harness:check
npm test
npm pack --dry-run --ignore-scripts
```

Set `EKKO_AUGGIE_NATIVE_TEST_CLI` to an absolute official npm executable or JS entry point to test signed-out detection in a disposable OS home. [Runtime contract](docs/CONTRACTS.md)

## Licensing

The independent Studio ACP adapter and its icon are MIT. The bundled Studio SDK, JSONC parser and YAML parser retain their licenses and notices. [Third-party notices](docs/third-party/README.md) The managed installer obtains the proprietary CLI directly from the official npm registry. Augment’s license governs CLI use, redistribution and commercial integration. [Adapter license](LICENSE) · [Auggie CLI license](https://github.com/augmentcode/auggie/blob/main/LICENSE.md)
