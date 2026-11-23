import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { childEnv, findEngine } from '../engine.mjs'
import { managedEngine } from '../managed-engine.mjs'
import { apply, definitionFor } from '../server.mjs'
import { assertContracts } from '../sdk/harness/contracts.mjs'
import contract from '../contracts/plugin.json' with { type: 'json' }
import manifest from '../plugin.json' with { type: 'json' }

const fixture = fileURLToPath(new URL('./fixtures/auggie.mjs', import.meta.url))
const owner = { userId: 42, profile: 'default' }
const identity = { ...owner, agentId: 'plugin:auggie/auggie', sessionId: 'test-chat' }
const makeInput = (prompt, history = []) => ({ instructions: [], input: [{ type: 'text', text: prompt }], history, options: {} })

async function setup(t, { key = 'normal', manager } = {}) {
  const path = await mkdtemp(join(await realpath(tmpdir()), 'auggie-test-'))
  const runtimeDir = join(path, 'runtime')
  const workspaceDir = join(path, '工作区 with spaces')
  await Promise.all([mkdir(runtimeDir), mkdir(workspaceDir)])
  const paths = { runtimeDir, workspaceDir }
  const controller = new AbortController()
  const lifecycle = { add() {} }
  const engine = {
    executable: process.execPath,
    args: [fixture],
    env: { ...childEnv({ ...process.env, HOME: path, USERPROFILE: path }), AUGGIE_TEST_MODE: key },
  }
  const definition = definitionFor(owner, manager ?? { async resolve() { return { engine } } })
  const base = { identity, mode: 'global', paths, signal: controller.signal, lifecycle }
  const session = definition.runtime.createSession(base)
  t.after(async () => { await session.dispose(); await rm(path, { recursive: true, force: true }) })
  const events = []
  const bytes = Buffer.from('actual asset')
  const binary = Buffer.from([0, 9, 255])
  const lookup = assetId => assetId === 'bin' ? binary : bytes
  const run = {
    ...base, identity: { ...identity, runId: 'run-1' }, model: {}, deadlineAt: Date.now() + 15_000, mcpServers: {},
    output: { async emit(event) { events.push(event) } },
    attachments: {
      async resolve(assetId) {
        return { assetId, name: assetId === 'bin' ? '../project.tar' : 'hello world.txt', mediaType: '', size: lookup(assetId).length }
      },
      async read(assetId) { return lookup(assetId) },
    },
    interactions: { async approve() { return { outcome: 'denied' } } },
  }
  const wire = async () => (await readFile(join(workspaceDir, 'wire.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
  return { definition, base, session, run, events, wire, controller, paths }
}

test('registers the stable ID, declared features, and MIT manifest with the Studio Agent API', async () => {
  let registration
  let disposed
  const cleanup = apply({ identity, paths: { dataDir: tmpdir() }, extensions: { rpc: { register() { return () => {} } }, agents: { register(definition) {
    registration = definition
    return { dispose() { disposed = true } }
  } } } })
  assert.equal(registration.id, manifest.id)
  assert.equal(manifest.license, 'MIT')
  assert.equal(registration.agentApiVersion, 1)
  assert.deepEqual(registration.features, { surfaces: ['chat'], streaming: true, resume: false })
  assert.deepEqual(Object.keys(registration.modes), ['global'])
  assert.match(registration.management.installGuideUrl, /#install$/)
  assertContracts(contract)
  await cleanup()
  assert.equal(disposed, true)
})

test('external engine detection rejects relative overrides and does not inherit Studio secrets', async () => {
  assert.equal(await findEngine({ EKKO_FACTORY_AUGGIE_EXECUTABLE: 'relative/auggie' }), null)
  const env = childEnv({ Path: '/bin', AUGMENT_SESSION_AUTH: 'auth', STUDIO_PROXY_TOKEN: 'secret', NODE_OPTIONS: '--require elsewhere' })
  assert.deepEqual(env, { PATH: process.platform === 'win32' ? '' : '/bin', AUGMENT_DISABLE_AUTO_UPDATE: '1' })
  const engine = await findEngine({ ...process.env, EKKO_AUGGIE_EXECUTABLE: fixture })
  assert.equal(engine.executable, await realpath(process.execPath))
  assert.deepEqual(engine.args, [await realpath(fixture)])
})

test('model catalog, selected model, reasoning effort, real attachment bytes, MCP, and streamed text', async t => {
  const { definition, base, run, events, session, wire } = await setup(t, { key: 'embedded' })
  const catalog = await definition.modes.global.listModels(base)
  assert.equal(catalog.status, 'ready')
  assert.deepEqual(catalog.models.map(model => model.id), ['native-default', 'native-other'])
  assert.deepEqual(catalog.models[0].reasoningEfforts, ['low', 'high'])
  run.model = { model: 'native-other', reasoningEffort: 'high' }
  run.mcpServers = {
    studio: { command: '/absolute/studio', args: ['mcp'], env: { CREDENTIAL_FILE: 'synthetic' } },
    other: { type: 'http', url: 'https://example.invalid/mcp', headers: { Authorization: 'synthetic' } },
  }
  const input = makeInput('Inspect attachments')
  input.instructions = [{ kind: 'workspace', text: 'Use the active workspace.' }]
  input.input.push({ type: 'image', assetId: 'img', name: 'x.png', mediaType: 'image/png' },
    { type: 'file', assetId: 'doc', name: 'x.txt', mediaType: 'text/plain' })
  assert.deepEqual(await session.run(input, run), { finishReason: 'stop', content: [{ type: 'text', text: 'fresh:native-other' }] })
  assert.deepEqual(events.map(event => event.text), ['fresh:', 'native-other'])
  const [start, model, reasoning, prompt] = await wire()
  assert.equal(start.params.cwd, run.paths.workspaceDir)
  assert.deepEqual(start.params.mcpServers[0], { name: 'studio', command: '/absolute/studio', args: ['mcp'], env: [{ name: 'CREDENTIAL_FILE', value: 'synthetic' }] })
  assert.deepEqual(start.params.mcpServers[1].headers, [{ name: 'Authorization', value: 'synthetic' }])
  assert.equal(model.params.value, 'native-other')
  assert.equal(reasoning.params.value, 'high')
  assert.match(prompt.params.prompt[0].text, /Use the active workspace/)
  assert.equal(Buffer.from(prompt.params.prompt[2].data, 'base64').toString(), 'actual asset')
  assert.equal(prompt.params.prompt[3].resource.text, 'actual asset')
  assert.match(prompt.params.prompt[3].resource.uri, /hello%20world\.txt$/)
})

test('keeps two simultaneous workspaces separate and passes Studio history to a fresh native session', async t => {
  const first = await setup(t, { key: 'legacy' })
  const second = await setup(t, { key: 'legacy' })
  await Promise.all([
    writeFile(join(first.paths.workspaceDir, 'marker.txt'), 'ONLY_WORKSPACE_ONE'),
    writeFile(join(second.paths.workspaceDir, 'marker.txt'), 'ONLY_WORKSPACE_TWO'),
  ])
  const results = await Promise.all([first, second].map(context =>
    context.session.run(makeInput('workspace marker'), { ...context.run, model: { model: 'native-other' } })))
  assert.deepEqual(results.map(result => result.content[0].text), ['ONLY_WORKSPACE_ONE', 'ONLY_WORKSPACE_TWO'])
  const history = [{ role: 'user', content: makeInput('earlier request').input }]
  first.run.mcpServers = { studio: { command: '/studio', env: { CREDENTIAL_FILE: 'rotated-fixture' } } }
  assert.equal((await first.session.run(makeInput('follow-up', history), first.run)).content[0].text, 'fresh:native-default')
  const frames = await first.wire()
  const prompts = frames.filter(frame => frame.method === 'session/prompt')
  assert.notEqual(prompts[0].params.sessionId, prompts[1].params.sessionId)
  assert.ok(prompts[1].params.prompt.some(block => block.text === 'earlier request'))
  assert.equal(frames.find(frame => frame.method === 'session/set_model').params.modelId, 'native-other')
  assert.equal(frames.filter(frame => frame.method === 'session/new').at(-1).params.mcpServers[0].env[0].value, 'rotated-fixture')
  assert.equal(frames.filter(frame => frame.method === 'session/load').length, 0)
})

test('passes inline text and shares binary attachment bytes only for the turn', async t => {
  const { run, session, wire, paths } = await setup(t)
  const input = makeInput('inspect attachments')
  input.input.push({ type: 'file', assetId: 'txt', name: 'file.txt', mediaType: 'text/plain' },
    { type: 'file', assetId: 'bin', name: 'project.tar', mediaType: 'application/octet-stream' })
  await session.run(input, run)
  const frames = await wire()
  const prompt = frames.find(frame => frame.method === 'session/prompt').params.prompt
  assert.match(prompt[1].text, /actual asset/)
  assert.match(prompt[2].text, /attachment-1\.tar/)
  assert.ok(frames.some(frame => frame.staged))
  assert.deepEqual(await readdir(paths.runtimeDir), [])
  input.input[0].text = 'wire-error'
  await assert.rejects(session.run(input, run), /rejected an ACP request/)
  assert.deepEqual(await readdir(paths.runtimeDir), [])
})

test('enforces negotiated remote MCP transport and attachment budgets', async t => {
  const { run, session, paths } = await setup(t, { key: 'stdio-only' })
  run.mcpServers = { remote: { type: 'http', url: 'https://example.invalid/mcp' } }
  await assert.rejects(session.run(makeInput('remote'), run), /MCP server transport/)
  run.mcpServers = {}
  let read = false
  run.attachments = {
    async resolve() { return { size: 9 * 1024 * 1024 } },
    async read() { read = true; return Buffer.alloc(0) },
  }
  const input = makeInput('large attachment')
  input.input.push({ type: 'file', assetId: 'big', name: 'big', mediaType: 'application/octet-stream' })
  await assert.rejects(session.run(input, run), /8 MiB/)
  assert.equal(read, false)
  assert.deepEqual(await readdir(paths.runtimeDir), [])
})

test('maps only explicit Studio approval or denial to a one-time option and redacts metadata', async t => {
  for (const [decision, expected] of [['approved', 'allow'], ['denied', 'deny'], ['timeout', 'permission-cancelled']]) {
    await t.test(decision, async t => {
      const { run, events, session, wire } = await setup(t)
      let calls = 0
      run.interactions.approve = async request => {
        calls += 1
        assert.match(request.details, /echo fixture/)
        assert.doesNotMatch(JSON.stringify(request), /SECRET_AUGGIE/)
        return { outcome: decision }
      }
      assert.equal((await session.run(makeInput('permission'), run)).content[0].text, expected)
      assert.equal(calls, 1)
      const frames = await wire()
      assert.equal(frames.find(frame => frame.id === 'wrong-session').result.outcome.outcome, 'cancelled')
      assert.equal(frames.find(frame => frame.id === 'approval').result.outcome.optionId, decision === 'timeout' ? undefined : expected)
      assert.deepEqual(events.map(event => event.type), ['tool.started', decision === 'approved' ? 'tool.completed' : 'tool.failed', 'text.delta'])
      assert.doesNotMatch(JSON.stringify(events), /SECRET_AUGGIE/)
    })
  }
  await t.test('rejects allow-always-only requests without prompting', async t => {
    const { run, session } = await setup(t)
    let calls = 0
    run.interactions.approve = async () => { calls += 1; return { outcome: 'approved' } }
    assert.equal((await session.run(makeInput('always-only'), run)).content[0].text, 'permission-cancelled')
    assert.equal(calls, 0)
  })
})

test('cancel targets the current native session and resolves pending permission without approving late', async t => {
  const { run, session, wire, events } = await setup(t)
  await session.run(makeInput('previous'), run)
  events.length = 0
  const cancelled = new AbortController()
  const approval = Promise.withResolvers()
  run.interactions.approve = async () => { cancelled.abort(); return approval.promise }
  await assert.rejects(session.run(makeInput('cancel-permission'), { ...run, signal: cancelled.signal }), /turn cancelled/)
  approval.resolve({ outcome: 'approved' })
  const frames = await wire()
  const prompt = frames.filter(frame => frame.method === 'session/prompt').at(-1)
  assert.equal(frames.find(frame => frame.method === 'session/cancel').params.sessionId, prompt.params.sessionId)
  assert.deepEqual(frames.find(frame => frame.id === 'approval').result, { outcome: { outcome: 'cancelled' } })
  assert.ok(!events.some(event => event.text?.includes('LATE_MUST_NOT_STREAM')))
  assert.equal((await session.run(makeInput('after cancel'), run)).content[0].text, 'fresh:native-default')
})

test('timeouts, unavailable authentication, unsupported inputs, and native errors are reported safely', async t => {
  await t.test('prompt timeout', async t => {
    const { run, session, wire } = await setup(t)
    run.deadlineAt = Date.now() + 2000
    await assert.rejects(session.run(makeInput('wait'), run), /turn timed out/)
    assert.ok((await wire()).some(frame => frame.method === 'session/cancel'))
  })
  await t.test('native errors omit stderr and RPC error details', async t => {
    const { run, session } = await setup(t)
    await assert.rejects(session.run(makeInput('wire-error'), run), { message: 'Auggie CLI rejected an ACP request.' })
  })
  for (const key of ['signed-out-v0', 'signed-out-v1']) {
    await t.test(key, async t => {
      const { definition, base, run, session } = await setup(t, { key })
      assert.equal((await definition.modes.global.listModels(base)).status, 'auth_required')
      await assert.rejects(session.run(makeInput('hello'), run), /auggie auth login/)
    })
  }
  await t.test('missing image capability', async t => {
    const { run, session, wire } = await setup(t, { key: 'no-image' })
    const request = makeInput('hello')
    request.input.push({ type: 'image', assetId: 'img', name: 'x.png', mediaType: 'image/png' })
    await assert.rejects(session.run(request, run), /does not support image input/)
    assert.ok(!(await wire()).some(frame => frame.method === 'session/prompt'))
  })
})

test('another user, Profile, or session cannot borrow the native login', async t => {
  const { definition, base, run, session, wire } = await setup(t)
  for (const identity of [{ ...base.identity, userId: 43 }, { ...base.identity, profile: 'other' }]) {
    assert.throws(() => definition.runtime.createSession({ ...base, identity }), /account and Profile/)
    assert.equal((await definition.modes.global.listModels({ ...base, identity })).status, 'auth_required')
    await assert.rejects(session.run(makeInput('foreign'), { ...run, identity }), /account and Profile/)
  }
  await assert.rejects(session.run(makeInput('foreign'), { ...run, identity: { ...run.identity, sessionId: 'other' } }), /account and Profile/)
  await session.run(makeInput('owner session'), run)
  const other = definition.runtime.createSession({ ...base, identity: { ...base.identity, sessionId: 'second-chat' } })
  t.after(() => other.dispose())
  assert.equal((await other.run(makeInput('second session'), { ...run, identity: { ...run.identity, sessionId: 'second-chat' } })).content[0].text, 'fresh:native-default')
  assert.equal((await wire()).filter(frame => frame.method === 'session/load').length, 0)
})

const realCli = process.env.EKKO_AUGGIE_NATIVE_TEST_CLI
test('official Auggie CLI negotiates ACP and reports login required from a disposable home', { skip: !realCli }, async t => {
  const tmp = await mkdtemp(join(await realpath(tmpdir()), 'auggie-native-'))
  t.after(() => rm(tmp, { recursive: true, force: true }))
  const env = { PATH: process.env.PATH, HOME: tmp, USERPROFILE: tmp,
    SYSTEMROOT: process.env.SystemRoot, TEMP: tmp, TMPDIR: tmp, EKKO_AUGGIE_EXECUTABLE: realCli }
  const manager = managedEngine(join(tmp, 'plugin'), { env })
  const { definition, base, session, run } = await setup(t, { manager })
  const status = await definition.getStatus(base)
  assert.equal(status.installed, true)
  assert.match(status.version, /^(0\.37\.0|1\.2\.2)$/)
  assert.equal((await definition.modes.global.listModels(base)).status, 'auth_required')
  await assert.rejects(session.run(makeInput('hello'), run), /auggie auth login/)
})
