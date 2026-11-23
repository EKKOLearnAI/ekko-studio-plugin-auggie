# Auggie runtime contract

## Registration and ownership

The only extension is Agent API v1, with plugin ID `auggie`, local Agent ID `auggie` and stable ID `plugin:auggie/auggie`. It provides `global` mode, the `chat` surface and streaming. The installer account and Profile must match the trusted runtime identity because Auggie uses an OS account's native login and configuration. Each run must also match its Studio session and Agent ID. There are no custom RPCs, native credential fields or checkpoints. The only plugin-owned persistent record is the managed engine selection. [SDK types](../sdk/src/agents.ts)

## Engine management

- `ctx.paths.dataDir/engine/current.json` contains the validated `engineSelection` object declared in the contract. A missing file permits native discovery, an empty release records deletion, and `release-…` selects a managed npm directory. Upgrading from 0.1.0 starts with the missing-file behavior.
- An explicit absolute `EKKO_AUGGIE_EXECUTABLE` takes priority, followed by the managed selection. Without a managed selection or deletion record, the plugin searches absolute host PATH entries, `~/.local/bin` on Unix, or the standard Windows npm paths. A valid external installation is managed by its original installer. A broken explicit override needs to be corrected or unset by the host operator.
- Management actions require the Studio account and Profile that enabled the plugin. The host checks super admin authorization, expected version, update target, and active-run state. The plugin also serializes mutations for its own data directory. Automatic updates are disabled.
- Studio checks the official npm stable channel and installs an exact supported version into a new private release directory. The npm subprocess uses the host Node/npm runtime, the fixed official registry, empty user/global npm configuration paths, and a disposable home and cache. Lifecycle scripts are disabled. The plugin verifies the package name, executable metadata, real executable path, reported version, and ACP v1 agent identity before committing the selection atomically.
- Failed or cancelled staging leaves the previous release selected. A successful upgrade cleans up that previous release. Removal atomically clears the selection and deletes only the selected managed release directory. The persisted deletion record keeps a newly located external binary from being reported as the result of the removal. An explicitly configured external CLI always takes precedence. Studio sessions and native Auggie state are outside the managed directory. If filesystem cleanup fails, the runtime remains unselected and the error reports the residual cleanup.
- The current Studio management card renders actions from static advertised capabilities. On an external installation, the backend denies removal and returns a non-updatable check result. Hiding the external Delete control dynamically would require a host contract change.

## Models

The engine process is launched without a shell. npm JavaScript entries are invoked by the host Node runtime, including on Windows. The child environment carries OS paths, locale, proxy and CA variables plus `AUGMENT_DISABLE_AUTO_UPDATE=1`. Studio auth and model proxy variables are excluded.

The model catalog uses an ACP session in a temporary directory and closes the child after discovery. ACP 0.x reports a signed-out session with error `-32000`. Version 1.x is probed with its native `auth status` command. Raw CLI stderr and JSON-RPC error details stay out of Studio. Model selection uses `session/set_config_option` or legacy `session/set_model` when the runtime advertises the requested model. Reasoning is selectable only if the native session advertises that option.


Scoped mode requires a CLI support for a custom inference endpoint compatible with Studio’s model proxy. The official Auggie stable 1.2.2 and the tested 1.3.0 preview rejected provider registration and did not produce a Chat Completions request with a custom model configuration. The native Augment tenant credential establishes an Augment service session. The adapter uses it only through the CLI’s normal login. Studio excludes Scoped from the catalog and rejects explicit Scoped runs.

## Prompts, isolation and lifecycle

Every prompt starts a separate `auggie --acp` process. The real path of the current Studio workspace is both the process cwd and the `session/new.cwd` value. It is pinned as `--workspace-root`. Automatic discovery of additional repositories is disabled, and the CLI's session-save flag is disabled for each version. Studio supplies the conversation history on the next turn, including after a host restart. Native recovery is disabled (`resume: false`).

The runtime forwards image content as ACP image blocks. Files use embedded resources when negotiated, or their UTF-8 text is sent inline up to 64 KiB per file. Remaining files are copied from the authorized Studio attachment API to a private directory under the current session runtime directory, with a per-turn byte budget of 8 MiB for all history and current attachments. The CLI receives the actual file path for its native file tools. The directory is removed on completion, failure and cancellation. Restrictive native file policies may limit access to staged files.

Run-scoped Studio MCP servers become ACP stdio server descriptors. HTTP or SSE descriptors require the corresponding negotiated transport capability. Permission requests bound to the active native session go through Studio, with raw arguments excluded. The bridge maps explicit approval to `allow_once`, explicit denial to `reject_once` when available, and all other outcomes to cancellation. Native tool calls that skip ACP permission requests keep their native policy. Studio receives text and reasoning increments and tool lifecycle events with sanitized metadata. Final content is the complete accumulated reply.

The turn follows the Studio abort signal and deadline. On cancellation it sends `session/cancel`, answers pending approvals with cancelled, and closes the child and its process group/tree. Subsequent output is discarded. ACP startup, frame and response sizes are bounded. The plugin signals errors with sanitized messages.
