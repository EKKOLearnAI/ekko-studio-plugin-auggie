import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { Acp, AcpError } from './acp.mjs'
import { acpArgs, engineVersion, findEngine, isAuggieOne, nativeLoginMissing } from './engine.mjs'
import { acpServers, chooseModel, initialize, nativeModels, promptContent, validId } from './protocol.mjs'
import { openAcp } from './turn.mjs'
import manifest from './plugin.json' with { type: 'json' }

const id = 'plugin:auggie/auggie'
const install = 'Install the official Auggie CLI on the Studio host and restart Studio if its PATH changed.'
const unavailable = 'Could not verify the Auggie CLI executable.'
const ownerOnly = 'Auggie uses the host account login and is available to the Studio account and Profile that enabled this plugin.'
const loginRequired = 'Sign in on the Studio host with auggie auth login (1.x) or auggie login (0.x).'
const finishReasons = { end_turn: 'stop', refusal: 'stop', max_tokens: 'length', max_turn_requests: 'tool_limit' }
const sameOwner = (left, right) => left.userId === right.userId && left.profile === right.profile
const catalog = (status, models = [], message) => ({
  status, models, source: 'auggie-acp', scope: 'available', ...(message ? { message } : {}),
})

class LoginRequired extends Error {
  constructor() { super(loginRequired) }
}

async function startSession(acp, engine, version, cwd, mcpServers, signal) {
  if (isAuggieOne(version) && await nativeLoginMissing(engine, signal, cwd)) throw new LoginRequired()
  try {
    return await acp.request('session/new', { cwd, mcpServers }, signal)
  } catch (error) {
    if (error instanceof AcpError && error.code === -32000) throw new LoginRequired()
    throw error
  }
}

async function listModels(run, getEngine) {
  const signal = AbortSignal.any([run.signal, AbortSignal.timeout(20_000)])
  let acp
  let cwd
  try {
    signal.throwIfAborted()
    const engine = await getEngine()
    if (!engine) return catalog('not_installed', [], install)
    const version = await engineVersion(engine, signal)
    if (!version) return catalog('error', [], unavailable)
    cwd = await mkdtemp(join(await realpath(tmpdir()), 'studio-auggie-models-'))
    signal.throwIfAborted()
    acp = new Acp(engine.executable, [...engine.args, ...acpArgs(version, cwd)], { cwd, env: engine.env }, ({ id: requestId }) => {
      if (requestId !== undefined) acp.methodNotFound(requestId)
    })
    run.lifecycle.add(() => acp.close())
    await initialize(acp, signal, manifest.version)
    const session = await startSession(acp, engine, version, cwd, [], signal)
    const models = nativeModels(session)
    return models.length ? catalog('ready', models) : catalog('empty')
  } catch (error) {
    run.signal.throwIfAborted()
    if (signal.aborted) return catalog('timeout', [], 'Auggie model discovery timed out.')
    if (error instanceof LoginRequired) return catalog('auth_required', [], loginRequired)
    return catalog('error', [], 'Could not load the native Auggie model catalog.')
  } finally {
    try { await acp?.close() }
    finally { if (cwd) await rm(cwd, { force: true, recursive: true }) }
  }
}

async function runTurn(input, run, getEngine, signal) {
  const engine = await getEngine()
  if (!engine) throw new Error(install)
  const startup = AbortSignal.any([signal, AbortSignal.timeout(25_000)])
  let turn
  let temporaryFiles
  try {
    const version = await engineVersion(engine, startup)
    if (!version) throw new Error(unavailable)
    if (!isAbsolute(run.paths.workspaceDir)) throw new Error('Studio must provide an absolute Auggie workspace path.')
    const cwd = await realpath(run.paths.workspaceDir)
    startup.throwIfAborted()
    const args = [...engine.args, ...acpArgs(version, cwd)]
    turn = openAcp({ ...engine, args }, cwd, run, signal)
    const capabilities = await initialize(turn.acp, startup, manifest.version)
    const servers = acpServers(run.mcpServers ?? {}, capabilities.mcpCapabilities)
    const session = await startSession(turn.acp, engine, version, cwd, servers, startup)
    const sessionId = session?.sessionId
    if (!validId(sessionId)) throw new Error('Auggie did not provide a valid ACP session ID.')
    await chooseModel(turn.acp, sessionId, session, run.model, startup)
    const prompt = await promptContent(input, run, capabilities.promptCapabilities, signal, async () => {
      temporaryFiles ??= await mkdtemp(join(await realpath(run.paths.runtimeDir), 'auggie-files-'))
      return temporaryFiles
    })
    const { result, content } = await turn.prompt(sessionId, prompt)
    if (result?.stopReason === 'cancelled') throw new Error('Auggie cancelled the prompt.')
    if (!Object.hasOwn(finishReasons, result?.stopReason)) throw new Error('Auggie returned an unsupported ACP stop reason.')
    return { content, finishReason: finishReasons[result.stopReason] }
  } catch (error) {
    if (!signal.aborted && startup.aborted) throw new Error('Auggie ACP startup timed out.')
    throw error
  } finally {
    try { await turn?.close() }
    finally { if (temporaryFiles) await rm(temporaryFiles, { recursive: true, force: true }) }
  }
}

function createSession(owner, session, getEngine) {
  if (!sameOwner(owner, session.identity) || session.mode !== 'global' || session.identity.agentId !== id) throw new Error(ownerOnly)
  const disposed = new AbortController()
  let active
  return {
    async run(input, run) {
      if (!sameOwner(session.identity, run.identity) || run.identity.sessionId !== session.identity.sessionId ||
          run.identity.agentId !== id || run.mode !== session.mode) throw new Error(ownerOnly)
      if (active) throw new Error('Auggie already has an active turn in this Studio session.')
      const remaining = run.deadlineAt - Date.now()
      if (remaining <= 0) throw new Error('Auggie turn timed out.')
      const deadline = AbortSignal.timeout(remaining)
      const signal = AbortSignal.any([session.signal, run.signal, disposed.signal, deadline])
      signal.throwIfAborted()
      active = runTurn(input, run, getEngine, signal)
      try {
        const reply = await active
        signal.throwIfAborted()
        return reply
      } catch (error) {
        if (signal.aborted) throw new Error(deadline.aborted ? 'Auggie turn timed out.' : 'Auggie turn cancelled.')
        throw error
      } finally {
        active = undefined
      }
    },
    async dispose() {
      disposed.abort()
      await active?.catch(() => {})
    },
  }
}

export function definitionFor(owner, getEngine = findEngine) {
  return {
    id: manifest.id, name: manifest.name, vendor: 'Augment Code', description: manifest.description, agentApiVersion: 1,
    async getStatus(run) {
      const engine = await getEngine()
      if (!engine) return { installed: false, version: '', source: 'not-installed' }
      const version = await engineVersion(engine, run.signal)
      return version ? { installed: true, version, source: 'external' }
        : { installed: false, version: '', source: 'not-installed', error: unavailable }
    },
    management: { installGuideUrl: manifest.documentation },
    modes: {
      global: { listModels: run => sameOwner(owner, run.identity) ? listModels(run, getEngine) : catalog('auth_required', [], ownerOnly) },
    },
    features: { surfaces: ['chat'], streaming: true, resume: false },
    runtime: { createSession: session => createSession(owner, session, getEngine) },
  }
}

export function apply(ctx) {
  const { userId, profile } = ctx.identity
  const registration = ctx.extensions.agents.register(definitionFor({ userId, profile }))
  return () => registration.dispose()
}
