import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { childEnv } from '../engine.mjs'
import { nativeConfiguration, nativeSettingsRoot } from '../native-config.mjs'
import { apply } from '../server.mjs'
import manifest from '../plugin.json' with { type: 'json' }

const signal = new AbortController().signal
const read = file => readFile(file, 'utf8')
const skillMarkdown = '---\nname: probe-skill\ndescription: Test Skill\nmetadata:\n  author: test\n---\n\nBody\n'

async function setup(t) {
  const home = await mkdtemp(join(tmpdir(), 'auggie-config-test-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const root = nativeSettingsRoot(childEnv({ HOME: home, USERPROFILE: home, AUGMENT_CACHE_DIR: 'outside' }))
  assert.equal(root, join(home, '.augment'))
  return { home, root, config: nativeConfiguration(root), file: join(root, 'settings.json') }
}

test('patches selected user values in JSONC and preserves comments, credentials, and unknown settings', async t => {
  const { config, root, file } = await setup(t)
  await mkdir(root)
  await writeFile(file, `{
    // Keep this comment
    "auth": { "token": "fixture-private-token" },
    "theme": "dark",
    "unknown": { "futureSetting": true },
    "mcpServers": {},
  }
  `)
  const initial = await config.readSettings()
  assert.deepEqual(JSON.parse(initial.text), { theme: 'dark' })
  assert.doesNotMatch(JSON.stringify(initial), /private-token|futureSetting/)
  await config.saveSettings({ revision: initial.revision, text: '{"enableSkillCommands":true}' }, signal)
  const newValue = await config.readSettings()
  assert.deepEqual(JSON.parse(newValue.text), { enableSkillCommands: true, theme: 'dark' })
  const stored = await read(file)
  assert.match(stored, /Keep this comment/)
  assert.match(stored, /fixture-private-token/)
  assert.match(stored, /futureSetting/)
  await assert.rejects(config.saveSettings({ revision: initial.revision, text: '{}' }, signal), /changed/)
  await assert.rejects(config.saveSettings({ revision: newValue.revision, text: '{"mcpServers": {}}' }, signal), /listed/)
  await assert.rejects(config.saveSettings({ revision: newValue.revision, text: '{"theme":true}' }, signal), /listed/)
  assert.equal(await read(file), stored)
  await config.saveSettings({ revision: newValue.revision, text: '{"theme":null}' }, signal)
  assert.deepEqual(JSON.parse((await config.readSettings()).text), { enableSkillCommands: true })
})

test('adds, edits and removes MCP servers while preserving masked strings and unrelated data', async t => {
  const { config, file } = await setup(t)
  let revision = (await config.listMcp()).revision
  await config.saveMcp({ name: 'probe', revision, existing: false,
    text: JSON.stringify({ type: 'http', url: 'https://example.invalid/private-key', headers: { Authorization: 'Bearer hidden' } }) }, signal)
  const first = await config.readMcp({ name: 'probe' })
  assert.deepEqual(JSON.parse(first.text), { type: 'http', url: '[stored value]', headers: { Authorization: '[stored value]' } })
  assert.doesNotMatch(first.text, /private-key|Bearer hidden/)
  const seeded = JSON.parse(await read(file))
  seeded.mcpServers.probe.future = { token: 'opaque-value' }
  seeded.unrelated = { original: true }
  await writeFile(file, JSON.stringify(seeded, null, 2))
  const current = await config.readMcp({ name: 'probe' })
  const updated = JSON.parse(current.text)
  updated.headers.Example = 'added'
  await assert.rejects(config.saveMcp({ name: 'probe', revision: first.revision, existing: true, text: JSON.stringify(updated) }, signal), /changed/)
  await config.saveMcp({ name: 'probe', revision: current.revision, existing: true, text: JSON.stringify(updated) }, signal)
  assert.deepEqual(JSON.parse(await read(file)).mcpServers.probe, { ...seeded.mcpServers.probe,
    headers: { Authorization: 'Bearer hidden', Example: 'added' } })
  revision = (await config.listMcp()).revision
  await assert.rejects(config.saveMcp({ name: 'probe', revision, existing: false, text: '{}' }, signal), /already exists/)
  await assert.rejects(config.saveMcp({ name: 'new', revision, existing: false, text: '{"command":"[stored value]"}' }, signal), /unmatched/)
  await assert.rejects(config.saveMcp({ name: 'new', revision, existing: false, text: '{"command":"node","args":[0]}' }, signal), /list of strings/)
  await config.removeMcp({ name: 'probe', revision }, signal)
  assert.deepEqual(JSON.parse(await read(file)), { mcpServers: {}, unrelated: { original: true } })
})

test('validates a Skill, preserves its existing Markdown metadata and never deletes sibling resources', async t => {
  const { config, root } = await setup(t)
  const name = 'probe-skill'
  await assert.rejects(config.saveSkill({ name, text: 'broken', revision: '' }, signal), /front matter/)
  await config.saveSkill({ name, text: skillMarkdown, revision: '' }, signal)
  const first = await config.readSkill({ name })
  assert.equal(first.text, skillMarkdown)
  const sibling = join(root, 'skills', name, 'example.txt')
  await writeFile(sibling, 'retained')
  assert.deepEqual((await config.listSkills()).names, [name])
  const nextText = first.text.replace('Body', 'Edited body')
  await config.saveSkill({ name, text: nextText, revision: first.revision }, signal)
  await assert.rejects(config.removeSkill({ name, revision: first.revision }, signal), /changed/)
  const latest = await config.readSkill({ name })
  assert.equal(latest.text, nextText)
  await config.removeSkill({ name, revision: latest.revision }, signal)
  assert.deepEqual((await config.listSkills()).names, [])
  assert.equal(await read(sibling), 'retained')
})

test('protects project and account files and rejects unsafe paths and malformed configuration', async t => {
  const { config, home, root, file } = await setup(t)
  const outside = join(home, 'outside')
  await mkdir(outside)
  const victim = join(outside, 'settings.json')
  await writeFile(victim, 'sentinel')
  await symlink(outside, root, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(config.readSettings(), /ordinary directories/)
  assert.equal(await read(victim), 'sentinel')
  await rm(root, { recursive: true, force: true })
  await mkdir(root)
  await writeFile(join(root, 'session.json'), '{"token":"auth-sentinel"}')
  await writeFile(file, '{"theme":"dark","theme":"shadow"}')
  await assert.rejects(config.readSettings(), /unique/)
  await assert.rejects(config.readSkill({ name: '../outside' }), /Invalid/)
  await assert.rejects(config.readMcp({ name: '__proto__' }), /Invalid/)
  assert.equal(await read(join(root, 'session.json')), '{"token":"auth-sentinel"}')
})

test('registers three Agent settings views, binds RPC and opening to the activation identity, and keeps only Global', async () => {
  const rpc = new Map()
  let agent
  const owner = { userId: 55, profile: 'default' }
  const dispose = apply({ paths: { dataDir: tmpdir() }, identity: owner, extensions: {
    rpc: { register(name, handler) { rpc.set(name, handler); return () => rpc.delete(name) } },
    agents: { register(value) { agent = value; return { dispose() {} } } },
  } })
  assert.deepEqual(manifest.views.map(({ id, slot }) => [id, slot]), [
    ['skills', 'agent-settings'], ['mcp', 'agent-settings'], ['configuration', 'agent-settings'],
  ])
  assert.deepEqual(agent.management.settings({ identity: owner, signal }), { viewId: 'skills' })
  assert.deepEqual(Object.keys(agent.modes), ['global'])
  assert.equal(rpc.size, 10)
  for (const foreign of [{ ...owner, profile: 'other' }, { ...owner, userId: 60 }]) {
    assert.throws(() => agent.management.settings({ identity: foreign, signal }), /account and Profile/)
    for (const method of ['list-skills', 'list-mcp', 'read-settings']) {
      await assert.rejects(rpc.get(method)({}, { identity: foreign, signal }), /account and Profile/)
    }
  }
  await dispose()
  assert.equal(rpc.size, 0)
})
