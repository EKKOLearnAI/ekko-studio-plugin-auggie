# Augment Auggie for Ekko Studio

Run the official Auggie CLI through ACP in a Studio Global coding chat. The stable Studio Agent ID is `plugin:auggie/auggie`.

## Install

1. On the **Studio backend host**, install the official Auggie CLI with Node.js 24.2 or later. Install and sign in as the OS user running Studio. The 1.x CLI and the ACP Registry's 0.x CLI use different login commands. [Official installation](https://docs.augmentcode.com/cli/setup-auggie/install-auggie-cli) · [Authentication](https://docs.augmentcode.com/cli/setup-auggie/authentication)

   ```sh
   npm install -g @augmentcode/auggie@1.2.2
   auggie --version
   auggie auth login
   auggie auth status
   ```

   For the ACP Registry version, use `npm install -g @augmentcode/auggie@0.37.0` and `auggie login`. [ACP Registry](https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json) · [0.x authentication](https://docs.augmentcode.com/cli/v0/setup-auggie/authentication)

2. In **Studio → Plugins → Install from source**, enter `github:EKKOLearnAI/ekko-studio-plugin-auggie#main`, review the source and enable the plugin. For repeatable installs, replace `main` with the full Git commit in the verification report. An absolute path to the plugin checkout works for local installation.
3. In **Agent Management**, check the Auggie CLI version. Open a new Auggie **Global** chat and select a workspace. Use the model list when Auggie provides one, or leave the CLI default selected.
4. If Studio cannot find the CLI, put `auggie` on the backend process PATH or set `EKKO_AUGGIE_EXECUTABLE` to the absolute executable path before restarting Studio. On Windows, the npm global installation is located through PATH or `%APPDATA%/npm`. For a custom npm prefix, set the override to the official package's `auggie-v2.mjs` (1.x) or `augment.mjs` (0.x). A custom `auggie.exe` also works with the override.

### 中文安装

在 Studio **服务端所在机器**安装官方 CLI，并用运行 Studio 的操作系统账号登录。1.x 用 `auggie auth login`，ACP 目录中的 `0.37.0` 用 `auggie login`。在插件中心选择「从来源安装」，填入上面的 GitHub 来源或本地源码绝对路径，确认并启用。到「Agent 管理」检查版本，再新建 Auggie「全局」单聊并选择工作区。桌面找不到 CLI 时，在 Studio 服务进程环境设置 `EKKO_AUGGIE_EXECUTABLE` 后重启。

## Runtime behavior

- The Studio account and Profile that enabled the plugin use the host account's native login. Complete browser login from the CLI. Studio Plugin settings contain no Augment credentials.
- The selected Studio workspace becomes both the process working directory and the ACP workspace. Auggie applies its own indexing rules and workspace trust. A quick check with a real account is to open two separate chats in test repositories containing different marker strings and ask each chat for its repository's marker. [Augment workspace context](https://docs.augmentcode.com/cli/setup-auggie/workspace-context)
- Responses stream into Studio. Each turn has a fresh native ACP session and includes the current Studio conversation history. Stop cancels the active prompt. Only permissions requested by the CLI through ACP appear in Studio, and Studio's approval applies once. Existing Auggie permission policies still apply. [Auggie tool permissions](https://docs.augmentcode.com/cli/permissions)
- Images use native ACP image blocks when available. Small UTF-8 files can be included in the prompt when embedded resources are unavailable. Other files are staged for the CLI's file tools and removed when the turn ends. The total attachment limit is 8 MiB.
- Studio currently exposes Global single chat. Managed CLI install, scoped model proxy, group chat, workflows and native session recovery are outside this release.

## Development and verified scope

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run harness:check
npm test
npm pack --dry-run --ignore-scripts
```

Set `EKKO_AUGGIE_NATIVE_TEST_CLI` to an absolute official npm executable or JS entry point to test version detection and the signed-out state with a disposable OS home. macOS arm64 was used for the native probes of 0.37.0 and 1.2.2. The CI matrix uses an ACP fixture on Linux, macOS and Windows. Paid-account responses, indexing on two actual repositories, native permission prompts and native MCP/attachment handling require separate validation with an authenticated account. [Runtime contract](docs/CONTRACTS.md)

## Licensing

The independent Studio ACP adapter and its icon are MIT. The bundled Studio SDK retains its MIT license and notices. Install the proprietary CLI separately through Augment's official channel. Augment's license governs use of the CLI and includes restrictions on redistribution and commercial integration. [Adapter license](LICENSE) · [Augment CLI license](https://github.com/augmentcode/auggie/blob/main/LICENSE.md)
