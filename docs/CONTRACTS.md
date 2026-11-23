# Auggie runtime contract

## Registration and ownership

The only extension is Agent API v1, with plugin ID `auggie`, local Agent ID `auggie` and stable ID `plugin:auggie/auggie`. It provides `global` mode, the `chat` surface and streaming. The installer account and Profile must match the trusted runtime identity because Auggie uses an OS account's native login and configuration. Each run must also match its Studio session and Agent ID. There are no custom RPCs, native credential fields, persisted plugin records or checkpoints. [SDK types](../sdk/src/agents.ts)

## Engine and models

The engine is externally installed and launched without a shell. A validated absolute `EKKO_AUGGIE_EXECUTABLE` takes precedence over absolute locations on PATH. Windows npm packages launch their JS entry point with Node. The child environment carries OS paths, locale, proxy and CA variables plus `AUGMENT_DISABLE_AUTO_UPDATE=1`. Studio auth and model proxy variables are excluded.

The model catalog uses an ACP session in a temporary directory and closes the child after discovery. ACP 0.x reports a signed-out session with error `-32000`. Version 1.x is probed with its native `auth status` command. Raw CLI stderr and JSON-RPC error details stay out of Studio. Model selection uses `session/set_config_option` or legacy `session/set_model` when the runtime advertises the requested model. Reasoning is selectable only if the native session advertises that option.

## Prompts, isolation and lifecycle

Every prompt starts a separate `auggie --acp` process. The real path of the current Studio workspace is both the process cwd and the `session/new.cwd` value. It is pinned as `--workspace-root`. Automatic discovery of additional repositories is disabled, and the CLI's session-save flag is disabled for each version. Studio supplies the conversation history on the next turn, including after a host restart. Native recovery is disabled (`resume: false`).

The runtime forwards image content as ACP image blocks. Files use embedded resources when negotiated, or their UTF-8 text is sent inline up to 64 KiB per file. Remaining files are copied from the authorized Studio attachment API to a private directory under the current session runtime directory, with a per-turn byte budget of 8 MiB for all history and current attachments. The CLI receives the actual file path for its native file tools. The directory is removed on completion, failure and cancellation. Restrictive native file policies may limit access to staged files.

Run-scoped Studio MCP servers become ACP stdio server descriptors. HTTP or SSE descriptors require the corresponding negotiated transport capability. Permission requests bound to the active native session go through Studio, with raw arguments excluded. The bridge maps explicit approval to `allow_once`, explicit denial to `reject_once` when available, and all other outcomes to cancellation. Native tool calls that skip ACP permission requests keep their native policy. Studio receives text and reasoning increments and tool lifecycle events with sanitized metadata. Final content is the complete accumulated reply.

The turn follows the Studio abort signal and deadline. On cancellation it sends `session/cancel`, answers pending approvals with cancelled, and closes the child and its process group/tree. Subsequent output is discarded. ACP startup, frame and response sizes are bounded. The plugin signals errors with sanitized messages.
