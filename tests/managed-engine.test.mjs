import assert from 'node:assert/strict'
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { managedEngine } from '../managed-engine.mjs'
import { definitionFor } from '../server.mjs'

const owner = { userId: 42, profile: 'default', agentId: 'plugin:auggie/auggie' }
const context = signal => ({ identity: owner, signal: signal ?? new AbortController().signal, progress() {} })
const legacy = '0.37.0'
const stable = '1.2.2'

function binarySource(version, name = 'auggie') {
  return `
import { createInterface } from 'node:readline'
if (process.argv.includes('--version')) {
  console.log(${JSON.stringify(version)})
  process.exit(0)
}
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line)
  if (request.method === 'initialize') console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id,
    result: { protocolVersion: 1, agentInfo: { name: ${JSON.stringify(name)} } } }))
}
`
}

async function writePackage(directory, version, { reportedVersion = version, agentName = 'auggie' } = {}) {
  const root = join(directory, 'node_modules', '@augmentcode', 'auggie')
  await mkdir(root, { recursive: true })
  const bin = version === legacy ? 'augment.mjs' : 'auggie-v2.mjs'
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: '@augmentcode/auggie', version, bin: { auggie: version === legacy ? bin : './' + bin } }))
  await writeFile(join(root, bin), binarySource(reportedVersion, agentName))
}

async function setup(t) {
  const home = await mkdtemp(join(tmpdir(), 'auggie-managed-test-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const path = join(home, 'bin')
  await mkdir(path)
  const env = { PATH: path, HOME: home, USERPROFILE: home, APPDATA: home, SystemRoot: process.env.SystemRoot }
  const data = join(home, 'plugin')
  const root = join(data, 'engine')
  const run = context()
  const dependencies = {
    env, lookup: async tag => tag === 'latest' ? stable : tag,
    install: writePackage, runtime: async () => ({ node: process.execPath, npm: 'unused' }),
  }
  return { home, data, root, path, env, run, dependencies, manager: managedEngine(data, dependencies) }
}

async function createExternal(path) {
  if (process.platform === 'win32') {
    await writePackage(path, stable)
    return join(path, 'node_modules', '@augmentcode', 'auggie', 'auggie-v2.mjs')
  }
  const file = join(path, 'auggie')
  await writeFile(file, '#!' + process.execPath + '\n' + binarySource(stable).replaceAll(
    "import { createInterface } from 'node:readline'", "const { createInterface } = require('node:readline')").split('for await')[0])
  await chmod(file, 0o700)
  return file
}

test('checks updates, installs, upgrades, removes, preserves native state, and reinstalls', async t => {
  const { home, root, path, run, manager } = await setup(t)
  const native = join(home, '.augment')
  await mkdir(native)
  await writeFile(join(native, 'session.json'), 'native-login-sentinel')
  assert.deepEqual(await manager.status(run.signal), { installed: false, version: '', source: 'managed' })
  assert.deepEqual(await manager.checkUpdate(run), { currentVersion: '', latestVersion: stable, updateAvailable: true })
  assert.deepEqual(await manager.upgrade({ version: legacy, expectedVersion: '' }, run), { installedVersion: legacy })
  const previous = await manager.resolve()
  assert.equal(previous.engine.args[0].endsWith('augment.mjs'), true)
  assert.deepEqual(await manager.checkUpdate(run), { currentVersion: legacy, latestVersion: stable, updateAvailable: true })
  const update = { version: stable, expectedVersion: legacy }
  const [installed, stale] = await Promise.allSettled([manager.upgrade(update, run), manager.upgrade(update, run)])
  assert.deepEqual(installed.value, { installedVersion: stable })
  assert.match(stale.reason.message, /version changed/)
  const selected = await manager.resolve()
  assert.equal(selected.engine.args[0].endsWith('auggie-v2.mjs'), true)
  assert.deepEqual((await readdir(root)).sort(), ['current.json', selected.release].sort())
  await assert.rejects(lstat(join(root, previous.release)), { code: 'ENOENT' })
  await assert.rejects(manager.upgrade({ version: '../../fake', expectedVersion: stable }, run), /supported version/)
  assert.equal((await manager.checkUpdate(run)).updateAvailable, false)

  const external = await createExternal(path)
  const bytes = await readFile(external)
  await manager.remove(run)
  assert.deepEqual(await manager.status(run.signal), { installed: false, version: '', source: 'managed' })
  assert.deepEqual(await readdir(root), ['current.json'])
  assert.deepEqual(await readFile(external), bytes)
  assert.equal(await readFile(join(native, 'session.json'), 'utf8'), 'native-login-sentinel')
  assert.equal((await manager.checkUpdate(run)).latestVersion, stable)
  await manager.upgrade({ version: stable, expectedVersion: '' }, run)
  assert.equal((await manager.status(run.signal)).source, 'managed')
  const definition = definitionFor(owner, manager)
  assert.deepEqual(Object.keys(definition.modes), ['global'])
  assert.throws(() => definition.management.remove({ ...run, identity: { ...owner, profile: 'foreign' } }), /account and Profile/)
  assert.throws(() => definition.runtime.createSession({ identity: owner, mode: 'scoped' }), /Studio-scoped model/)
})

test('protects an external CLI and gives an explicit external override priority over the managed release', async t => {
  const { path, home, root, env, run, manager } = await setup(t)
  const external = await createExternal(path)
  const bytes = await readFile(external)
  assert.deepEqual(await manager.status(run.signal), { installed: true, version: stable, source: 'external' })
  assert.equal((await manager.checkUpdate(run)).updateAvailable, false)
  await assert.rejects(manager.upgrade({ version: stable, expectedVersion: stable }, run), /managed outside Studio/)
  await assert.rejects(manager.remove(run), /managed outside Studio/)
  assert.deepEqual(await readFile(external), bytes)
  await assert.rejects(lstat(root), { code: 'ENOENT' })

  env.PATH = ''
  await manager.upgrade({ version: stable, expectedVersion: '' }, run)
  const pointer = await readFile(join(root, 'current.json'))
  const override = join(home, 'override.mjs')
  await writeFile(override, binarySource(legacy))
  env.EKKO_AUGGIE_EXECUTABLE = override
  assert.deepEqual(await manager.status(run.signal), { installed: true, version: legacy, source: 'external' })
  await assert.rejects(manager.remove(run), /managed outside Studio/)
  env.EKKO_AUGGIE_EXECUTABLE = join(home, 'missing.mjs')
  assert.equal((await manager.status(run.signal)).source, 'not-installed')
  await assert.rejects(manager.upgrade({ version: stable, expectedVersion: '' }, run), /managed outside Studio/)
  assert.deepEqual(await readFile(join(root, 'current.json')), pointer)
  assert.equal((await lstat(override)).isFile(), true)
})

test('preserves the selected release on a wrong version, bad ACP agent, install failure, or abort', async t => {
  const { data, root, run, manager, dependencies } = await setup(t)
  await manager.upgrade({ version: legacy, expectedVersion: '' }, run)
  const pointer = await readFile(join(root, 'current.json'), 'utf8')
  const update = { version: stable, expectedVersion: legacy }
  for (const install of [
    (directory, version) => writePackage(directory, version, { reportedVersion: '1.0.0' }),
    (directory, version) => writePackage(directory, version, { agentName: 'another-agent' }),
    async () => { throw new Error('download failed') },
  ]) {
    const failing = managedEngine(data, { ...dependencies, install })
    await assert.rejects(failing.upgrade(update, run), /verification|download failed/)
    assert.equal(await readFile(join(root, 'current.json'), 'utf8'), pointer)
  }
  const controller = new AbortController()
  const aborting = managedEngine(data, { ...dependencies, async install(directory, version) {
    await writePackage(directory, version)
    controller.abort()
  } })
  await assert.rejects(aborting.upgrade(update, context(controller.signal)), { name: 'AbortError' })
  assert.equal((await manager.status(run.signal)).version, legacy)
  assert.deepEqual((await readdir(root)).sort(), ['current.json', JSON.parse(pointer).release].sort())
})

test('rejects an invalid pointer and never follows an engine directory symlink for deletion', async t => {
  const { home, data, root, run, manager } = await setup(t)
  const ownedBySomeoneElse = join(home, 'external-data')
  await mkdir(ownedBySomeoneElse)
  const sentinel = join(ownedBySomeoneElse, 'keep')
  await writeFile(sentinel, 'external data')
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'current.json'), JSON.stringify({ release: '../external-data' }))
  assert.equal((await manager.status(run.signal)).source, 'error')
  await assert.rejects(manager.remove(run), /selection is invalid/)
  assert.equal(await readFile(sentinel, 'utf8'), 'external data')

  await rm(root, { recursive: true })
  await mkdir(dirname(root), { recursive: true })
  await symlink(ownedBySomeoneElse, root, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(managedEngine(data).remove(run), /selection is invalid/)
  assert.equal(await readFile(sentinel, 'utf8'), 'external data')
})
