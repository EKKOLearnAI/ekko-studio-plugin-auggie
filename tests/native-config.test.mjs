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

test('round trips current and legacy tool search settings with native precedence and clearing', async t => {
  const { config, root, file } = await setup(t)
  await mkdir(root)
  await writeFile(file, '{ // keep\n "enableToolSearch": true, "theme": "dark" }')
  let current = await config.readSettings()
  assert.deepEqual(JSON.parse(current.text), { toolSearchEnabled: true, theme: 'dark' })
  await config.saveSettings({ text: '{"theme":"light"}', revision: current.revision }, signal)
  assert.doesNotMatch(await read(file), /toolSearchEnabled/)
  current = await config.readSettings()
  await config.saveSettings({ text: '{"toolSearchEnabled":false,"enableToolSearch":true}', revision: current.revision }, signal)
  current = await config.readSettings()
  assert.deepEqual(JSON.parse(current.text), { toolSearchEnabled: false, theme: 'light' })
  let stored = await read(file)
  assert.match(stored, /"enableToolSearch": false/)
  assert.match(stored, /"toolSearchEnabled": false/)
  await config.saveSettings({ text: '{"enableToolSearch":true}', revision: current.revision }, signal)
  current = await config.readSettings()
  assert.equal(JSON.parse(current.text).toolSearchEnabled, true)
  await config.saveSettings({ text: '{"toolSearchEnabled":null}', revision: current.revision }, signal)
  assert.deepEqual(JSON.parse((await config.readSettings()).text), { theme: 'light' })
  stored = await read(file)
  assert.doesNotMatch(stored, /"toolSearchEnabled"|"enableToolSearch"/)
  assert.match(stored, /keep/)
})

test('adds, edits and removes MCP servers while preserving masked strings and unrelated data', async t => {
  const { config, file } = await setup(t)
  let revision = (await config.listMcp()).revision
  await config.saveMcp({ name: 'probe', revision, existing: false,
    text: JSON.stringify({ type: 'http', url: 'https://example.invalid/private-key', headers: { Authorization: 'Bearer hidden' } }) }, signal)
  const first = await config.readMcp({ name: 'probe' })
  const listed = await config.listMcp()
  assert.deepEqual(listed.items, [{ name: 'probe', transport: 'http', editable: true, enabled: true }])
  assert.doesNotMatch(JSON.stringify(listed), /private-key|Bearer hidden/)
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

test('manages exact native MCP names and writes disabled without changing the definition', async t => {
  const { config, root, file } = await setup(t)
  await mkdir(root)
  const name = '  legacy 服务器 / name  '
  const definition = { type: 'stdio', command: 'node', args: ['secret'], disabled: true, future: { data: 'retain' } }
  await writeFile(file, JSON.stringify({ mcpServers: { [name]: definition } }, null, 2))
  const initial = await config.listMcp()
  assert.deepEqual(initial.items, [{ name, transport: 'stdio', editable: true, enabled: false }])
  const masked = JSON.parse((await config.readMcp({ name })).text)
  assert.deepEqual(masked, { type: 'stdio', command: '[stored value]', args: ['[stored value]'], disabled: true })
  await config.setMcpEnabled({ name, enabled: true, revision: initial.revision }, signal)
  let stored = JSON.parse(await read(file))
  assert.deepEqual(stored.mcpServers[name], { ...definition, disabled: false })
  await assert.rejects(config.setMcpEnabled({ name, enabled: false, revision: initial.revision }, signal), /changed/)
  let latest = await config.listMcp()
  assert.equal(latest.items[0].enabled, true)
  await config.saveMcp({ name, revision: latest.revision, existing: true, text: JSON.stringify(masked) }, signal)
  latest = await config.listMcp()
  assert.equal(latest.items[0].enabled, false)
  delete masked.disabled
  await config.saveMcp({ name, revision: latest.revision, existing: true, text: JSON.stringify(masked) }, signal)
  stored = JSON.parse(await read(file))
  assert.deepEqual(stored.mcpServers[name], definition)
  latest = await config.listMcp()
  await assert.rejects(config.saveMcp({ name, revision: latest.revision, existing: true,
    text: JSON.stringify({ ...masked, disabled: 'true' }) }, signal), /must be true or false/)
  await config.removeMcp({ name, revision: latest.revision }, signal)
  assert.deepEqual((await config.listMcp()).names, [])
})

test('preserves comments between JSONC properties when clearing preferences and deleting MCP entries', async t => {
  const { config, root, file } = await setup(t)
  await mkdir(root)
  await writeFile(file, `{ // opening comment
    "theme": "dark", // before the MCP section
    "mcpServers": {
      // first server line
      "first": {"command":"node"}, /* between servers */
      "last": {"command":"node"}, // closing server line
    },
    "notificationMode": "bell" // final setting
  }`)
  let current = await config.readSettings()
  await config.saveSettings({ revision: current.revision, text: '{"theme":null,"notificationMode":null}' }, signal)
  assert.deepEqual(JSON.parse((await config.readSettings()).text), {})
  for (const name of ['first', 'last']) {
    current = await config.listMcp()
    await config.removeMcp({ name, revision: current.revision }, signal)
  }
  assert.deepEqual((await config.listMcp()).names, [])
  const stored = await read(file)
  for (const comment of ['opening comment', 'before the MCP section', 'first server line', 'between servers',
    'closing server line', 'final setting']) assert.ok(stored.includes(comment), comment)
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
  await assert.rejects(config.readSkill({ name: '../outside' }), /Skill names/)
  await assert.rejects(config.readMcp({ name: '__proto__' }), /Invalid/)
  assert.equal(await read(join(root, 'session.json')), '{"token":"auth-sentinel"}')
})

test('structured Skill edits retain native metadata and can be repaired with the raw editor', async t => {
  const { config, root } = await setup(t)
  const name = 'probe-skill'
  await config.editSkill({ name, description: 'Test: Skill', body: 'New body\n', revision: '' }, signal)
  const first = await config.readSkill({ name })
  assert.equal(first.description, 'Test: Skill')
  assert.equal(first.text.slice(first.bodyOffset), 'New body\n')
  const file = join(root, 'skills', name, 'SKILL.md')
  await writeFile(file, skillMarkdown.replace('metadata:', '# Retain this comment\nmetadata:'))
  const existing = await config.readSkill({ name })
  await assert.rejects(config.editSkill({ name, description: 'Conflict', body: 'unsaved', revision: first.revision }, signal), /changed/)
  await config.editSkill({ name, description: 'Updated: # value', body: 'Edited body\n', revision: existing.revision }, signal)
  const latest = await config.readSkill({ name })
  assert.match(latest.text, /# Retain this comment\nmetadata:\n  author: test/)
  assert.equal(latest.text.slice(latest.bodyOffset), 'Edited body\n')
  assert.deepEqual((await config.listSkills()).items, [{ name, description: 'Updated: # value' }])
  await writeFile(file, 'Markdown needs a header')
  const invalid = await config.readSkill({ name })
  assert.equal(invalid.description, undefined)
  assert.deepEqual((await config.listSkills()).items, [{ name }])
  await assert.rejects(config.editSkill({ name, description: 'Repair', body: 'text', revision: invalid.revision }, signal), /Repair/)
  await config.saveSkill({ name, text: skillMarkdown, revision: invalid.revision }, signal)
  assert.equal((await config.readSkill({ name })).description, 'Test Skill')
})

test('uses the same Skill name rules for native paths and YAML creation', async t => {
  const { config } = await setup(t)
  for (const name of ['123', 'code-review', 'a'.repeat(64)]) {
    await config.editSkill({ name, description: 'A Skill', body: '', revision: '' }, signal)
    assert.equal((await config.readSkill({ name })).description, 'A Skill')
  }
  for (const name of ['Mixed Name', '--review', 'code--review', 'review-', 'a'.repeat(65), 'review\n']) {
    await assert.rejects(config.editSkill({ name, description: 'Invalid', body: '', revision: '' }, signal), /Skill names/)
  }
})

test('summarizes supported, repairable, and malformed MCP definitions without disclosing values', async t => {
  const { config, root, file } = await setup(t)
  await mkdir(root)
  await writeFile(file, JSON.stringify({ mcpServers: {
    broken: 'private fixture', needsRepair: { type: 'legacy', url: 'https://example.invalid/secret' },
    sse: { type: 'sse', url: 'https://example.invalid/private' }, stdio: { command: 'node' },
  } }))
  const listed = await config.listMcp()
  assert.deepEqual(listed.items, [
    { name: 'broken', transport: 'unsupported', editable: false },
    { name: 'needsRepair', transport: 'unsupported', editable: true },
    { name: 'sse', transport: 'sse', editable: true, enabled: true },
    { name: 'stdio', transport: 'stdio', editable: true, enabled: true },
  ])
  assert.doesNotMatch(JSON.stringify(listed), /private|https|secret|node/)
  await config.removeMcp({ name: 'broken', revision: listed.revision }, signal)
  assert.doesNotMatch(await read(file), /private fixture/)
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
  assert.equal(rpc.size, 13)
  for (const foreign of [{ ...owner, profile: 'other' }, { ...owner, userId: 60 }]) {
    assert.throws(() => agent.management.settings({ identity: foreign, signal }), /account and Profile/)
    for (const method of ['list-skills', 'list-mcp', 'read-settings', 'settings-engine-status']) {
      await assert.rejects(rpc.get(method)({}, { identity: foreign, signal }), /account and Profile/)
    }
    await assert.rejects(rpc.get('edit-skill')({
      name: 'foreign', description: 'Foreign', body: '', revision: '',
    }, { identity: foreign, signal }), /account and Profile/)
    await assert.rejects(rpc.get('set-mcp-enabled')({
      name: 'legacy server', enabled: false, revision: '',
    }, { identity: foreign, signal }), /account and Profile/)
  }
  await dispose()
  assert.equal(rpc.size, 0)
})
