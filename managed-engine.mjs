// Managed-release layout follows the MIT Cline Studio plugin. See LICENSE.
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { promisify } from 'node:util'
import { Acp } from './acp.mjs'
import { acpArgs, childEnv, engineVersion, externalEntry, findEngine, findNode, isAuggieOne, nodeCandidates } from './engine.mjs'
import { initialize } from './protocol.mjs'
import contract from './contracts/plugin.json' with { type: 'json' }
import manifest from './plugin.json' with { type: 'json' }
import { validateModel } from './sdk/harness/contracts.mjs'

const exec = promisify(execFile)
const packageName = '@augmentcode/auggie'
const registry = 'https://registry.npmjs.org/'
const engineVersions = /^(?:0\.37|1\.(?:0|[1-9]\d*))\.(?:0|[1-9]\d*)$/
const releaseName = /^release-[A-Za-z0-9]{6}$/
const npmBins = new Set(['augment.mjs', 'auggie-v2.mjs'])
const externalMessage = 'This Auggie CLI is managed outside Studio. Use its original installer to update or remove it.'
const invalidSelection = 'The Studio-managed Auggie engine selection is invalid.'
const verificationError = 'The downloaded Auggie CLI failed version or ACP verification.'
const operations = new Map()
const entryName = metadata => typeof metadata.bin?.auggie === 'string' ? metadata.bin.auggie.replace(/^\.\//, '') : ''
const cleanup = path => rm(path, { force: true, recursive: true, maxRetries: 3 })
const info = path => lstat(path).catch(error => {
  if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
})

function safeInside(root, file) {
  const rest = relative(root, file)
  return rest !== '' && !isAbsolute(rest) && rest !== '..' && !rest.startsWith('..' + sep)
}

async function npmRuntime(env, signal) {
  for (const candidate of nodeCandidates(env)) {
    signal.throwIfAborted()
    const node = await realpath(candidate).catch(() => undefined)
    if (!node) continue
    const bin = dirname(node)
    const candidates = [
      join(bin, 'node_modules/npm/bin/npm-cli.js'),
      join(bin, '../lib/node_modules/npm/bin/npm-cli.js'),
    ]
    if (process.platform !== 'win32') {
      const linked = await realpath(join(dirname(candidate), 'npm')).catch(() => undefined)
      if (linked?.endsWith('.js')) candidates.push(linked)
    }
    for (const npm of new Set(candidates)) {
      if (!(await info(npm))?.isFile()) continue
      try {
        await exec(node, [npm, '--version'], {
          env: childEnv(env), signal, timeout: 5000, maxBuffer: 4096, windowsHide: true,
        })
        return { node, npm }
      } catch {
        signal.throwIfAborted()
      }
    }
  }
  throw new Error('A Node.js installation with npm is required on the Studio host to manage Auggie.')
}

async function npmRelease(tag, signal) {
  const address = registry + '@augmentcode%2fauggie/' + tag
  let result
  try {
    const reply = await fetch(address, { redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]) })
    if (!reply.ok) throw new Error()
    result = await reply.json()
  } catch {
    signal.throwIfAborted()
    throw new Error('Could not check the official Auggie release on npm.')
  }
  if (result.name !== packageName || !engineVersions.test(result.version ?? '') ||
      !npmBins.has(entryName(result)) || !/^sha512-[A-Za-z0-9+/]+=*$/.test(result.dist?.integrity ?? '')) {
    throw new Error('The official npm registry did not return a compatible Auggie CLI release.')
  }
  return result.version
}

function serialize(root, action) {
  const previous = operations.get(root) ?? Promise.resolve()
  const current = previous.catch(() => {}).then(action)
  operations.set(root, current)
  return current.finally(() => {
    if (operations.get(root) === current) operations.delete(root)
  })
}

async function selectedRelease(root) {
  const status = await info(root)
  if (!status) return undefined
  if (!status.isDirectory()) throw new Error(invalidSelection)
  const pointer = join(root, 'current.json')
  const file = await info(pointer)
  if (!file) return undefined
  if (!file.isFile() || file.size > 1024) throw new Error(invalidSelection)
  try {
    const selected = validateModel(contract, 'engineSelection', JSON.parse(await readFile(pointer, 'utf8')))
    if (selected.release && !releaseName.test(selected.release)) throw new Error()
    return selected.release
  } catch {
    throw new Error(invalidSelection)
  }
}

async function selectRelease(root, release) {
  const temporary = join(root, '.selection-' + randomUUID())
  const value = validateModel(contract, 'engineSelection', { release })
  try {
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' })
    await rename(temporary, join(root, 'current.json'))
  } finally {
    await rm(temporary, { force: true })
  }
}

async function targetRelease(directory, env, node) {
  if (!(await info(directory))?.isDirectory()) return undefined
  const root = await realpath(directory)
  const packageRoot = join(root, 'node_modules', '@augmentcode', 'auggie')
  const metadataPath = await realpath(join(packageRoot, 'package.json')).catch(() => undefined)
  if (!metadataPath || !safeInside(root, metadataPath)) return undefined
  let metadata
  try { metadata = JSON.parse(await readFile(metadataPath, 'utf8')) } catch { return undefined }
  const bin = entryName(metadata)
  if (metadata.name !== packageName || !engineVersions.test(metadata.version ?? '') || !npmBins.has(bin)) return undefined
  const entry = await realpath(join(packageRoot, bin)).catch(() => undefined)
  if (!entry || !safeInside(root, entry) || !(await info(entry))?.isFile()) return undefined
  const executable = node ?? await findNode(env)
  return executable ? { executable, args: [entry], env: childEnv(env), version: metadata.version } : undefined
}

async function installRelease(stage, version, run, env, node, npm) {
  const home = join(stage, '.install-home')
  const cache = join(stage, '.npm-cache')
  await mkdir(home, { mode: 0o700 })
  const child = isolatedEnv(env, home)
  try {
    await exec(node, [npm, 'install', '--prefix', stage, '--registry', registry,
      '--userconfig', join(home, 'user.npmrc'), '--globalconfig', join(home, 'global.npmrc'),
      '--cache', cache, '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--save-exact',
      packageName + '@' + version],
    { cwd: stage, env: child, signal: run.signal, timeout: 88_000, windowsHide: true, maxBuffer: 512 * 1024 })
  } catch {
    run.signal.throwIfAborted()
    throw new Error('npm could not install the official Auggie CLI package.')
  } finally {
    await Promise.all([cleanup(home), cleanup(cache)])
  }
}

function isolatedEnv(env, home) {
  const displaced = /^(?:home|userprofile|homedrive|homepath|appdata|localappdata|xdg_config_home|xdg_cache_home|xdg_data_home|tmp|temp|tmpdir)$/i
  const result = Object.fromEntries(Object.entries(childEnv(env)).filter(([key]) => !displaced.test(key)))
  return { ...result, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, TMPDIR: home, TMP: home, TEMP: home }
}

async function verifyAcp(engine, stage, run) {
  const signal = AbortSignal.any([run.signal, AbortSignal.timeout(8500)])
  const home = await mkdtemp(join(stage, '.verify-home-'))
  let acp
  try {
    const env = isolatedEnv(engine.env, home)
    if (await engineVersion({ ...engine, env }, signal) !== engine.version) throw new Error(verificationError)
    const args = [...engine.args, ...acpArgs(engine.version, home), ...(isAuggieOne(engine.version) ? ['--offline'] : [])]
    acp = new Acp(engine.executable, args, { cwd: home, env }, frame => {
      if (frame.id !== undefined) acp.methodNotFound(frame.id)
    })
    await initialize(acp, signal, manifest.version)
  } catch {
    run.signal.throwIfAborted()
    throw new Error(verificationError)
  } finally {
    try { await acp?.close() } finally { await cleanup(home) }
  }
}

export function managedEngine(dataDir, { env = process.env, lookup = npmRelease, install = installRelease, runtime = npmRuntime } = {}) {
  const root = join(dataDir, 'engine')

  async function resolve() {
    if (env.EKKO_AUGGIE_EXECUTABLE?.trim()) return { engine: await findEngine(env), source: 'external', override: true }
    const release = await selectedRelease(root)
    if (release !== undefined) {
      return { source: 'managed', release, engine: release ? await targetRelease(join(root, release), env) : undefined }
    }
    // A broken external entry still belongs to its installer.
    const entry = await externalEntry(env)
    if (entry) return { engine: await findEngine(env, entry), source: 'external' }
    return { source: 'managed' }
  }

  async function reportStatus(resolved, signal) {
    const { engine, source, release, override } = resolved
    const version = engine && await engineVersion(engine, signal)
    if (version && (!engine.version || engine.version === version)) return { installed: true, version, source }
    const error = override ? 'Set EKKO_AUGGIE_EXECUTABLE to a working absolute Auggie CLI path.'
      : engine || release || source === 'external' ? 'Could not verify the Auggie CLI executable.' : ''
    return { installed: false, version: '', source: source === 'external' ? 'not-installed' : source, ...(error ? { error } : {}) }
  }

  async function status(signal) {
    try {
      signal.throwIfAborted()
      return await reportStatus(await resolve(), signal)
    } catch {
      signal.throwIfAborted()
      return { installed: false, version: '', source: 'error', error: 'Could not read the Auggie engine selection.' }
    }
  }

  async function checkUpdate(run) {
    run.signal.throwIfAborted()
    const resolved = await resolve()
    const { version } = await reportStatus(resolved, run.signal)
    if (resolved.source === 'external') {
      return { currentVersion: version, latestVersion: version, updateAvailable: false, message: externalMessage }
    }
    const latest = await lookup('latest', run.signal)
    return { currentVersion: version, latestVersion: latest, updateAvailable: version !== latest }
  }

  function upgrade(input, run) {
    return serialize(root, async () => {
      run.signal.throwIfAborted()
      if (!engineVersions.test(input.version)) throw new Error('Choose a supported version of the official Auggie CLI.')
      const selected = await resolve()
      if (selected.source === 'external') throw new Error(externalMessage)
      const current = await reportStatus(selected, run.signal)
      if (current.version !== input.expectedVersion) throw new Error('The Auggie CLI version changed. Check updates again.')
      if (current.version === input.version) return { installedVersion: current.version }
      if (await lookup(input.version, run.signal) !== input.version) throw new Error('The requested Auggie npm release changed.')
      const { node, npm } = await runtime(env, run.signal)
      await mkdir(root, { mode: 0o700, recursive: true })
      if (!(await info(root))?.isDirectory()) throw new Error(invalidSelection)
      const stage = await mkdtemp(join(root, 'release-'))
      let committed = false
      try {
        run.progress({ message: 'Installing the official Auggie CLI from npm', percent: 15 })
        await install(stage, input.version, run, env, node, npm)
        run.progress({ message: 'Verifying Auggie version and ACP', percent: 80 })
        const engine = await targetRelease(stage, env, node)
        if (!engine || engine.version !== input.version) throw new Error(verificationError)
        await verifyAcp(engine, stage, run)
        const refreshed = await resolve()
        if (refreshed.source !== 'managed' || refreshed.release !== selected.release) {
          throw new Error('The Auggie CLI selection changed during installation. Check updates again.')
        }
        run.signal.throwIfAborted()
        await selectRelease(root, basename(stage))
        committed = true
        if (selected.release) {
          await cleanup(join(root, selected.release)).catch(() => run.log?.warn('Could not clean up the previous managed Auggie release.'))
        }
        return { installedVersion: input.version }
      } finally {
        if (!committed) await cleanup(stage).catch(() => run.log?.warn('Could not clean up the unselected Auggie staging directory.'))
      }
    })
  }

  function remove(run) {
    return serialize(root, async () => {
      run.signal.throwIfAborted()
      const selected = await resolve()
      if (selected.source === 'external') throw new Error(externalMessage)
      if (!selected.release) return
      run.signal.throwIfAborted()
      await selectRelease(root, '')
      try {
        await cleanup(join(root, selected.release))
      } catch {
        throw new Error('Auggie was disabled, but the managed release directory could not be removed.')
      }
    })
  }

  return { resolve, status, checkUpdate, upgrade, remove }
}
