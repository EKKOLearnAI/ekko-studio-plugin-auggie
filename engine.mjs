import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, extname, isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const inherited = new Set([
  'PATH', 'PATHEXT', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'SYSTEMROOT', 'WINDIR', 'COMSPEC',
  'TMPDIR', 'TEMP', 'TMP', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME',
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
])

export function pathEntries(env = process.env) {
  const path = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? ''
  return path.split(delimiter).filter(isAbsolute)
}

export function nodeCandidates(env = process.env) {
  const name = process.platform === 'win32' ? 'node.exe' : 'node'
  return [...new Set([env.HERMES_AGENT_NODE,
    ...(!process.versions.electron ? [process.execPath] : []),
    ...pathEntries(env).map(directory => join(directory, name)),
  ].filter(value => typeof value === 'string' && isAbsolute(value)))]
}

export async function externalEntry(env = process.env) {
  const home = env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'] || homedir()
  const override = env.EKKO_AUGGIE_EXECUTABLE?.trim()
  const windows = process.platform === 'win32'
  const folders = pathEntries(env)
  if (windows && env.APPDATA && isAbsolute(env.APPDATA)) folders.push(join(env.APPDATA, 'npm'))
  if (!windows && isAbsolute(home)) folders.push(join(home, '.local', 'bin'))
  const candidates = override ? [override] : folders.flatMap(dir => windows
    ? ['auggie.exe', 'node_modules/@augmentcode/auggie/auggie-v2.mjs', 'node_modules/@augmentcode/auggie/augment.mjs']
      .map(name => join(dir, name))
    : [join(dir, 'auggie')])
  for (const candidate of new Set(candidates)) {
    if (!isAbsolute(candidate)) continue
    const extension = extname(candidate).toLowerCase()
    const javascript = ['.mjs', '.cjs', '.js'].includes(extension)
    if (windows && !javascript && extension !== '.exe') continue
    try {
      await access(candidate, windows || javascript ? constants.F_OK : constants.X_OK)
      if (!(await stat(candidate)).isFile()) continue
      return await realpath(candidate)
    } catch { /* Continue through absolute executable locations. */ }
  }
  return null
}

export function childEnv(parent = process.env) {
  const env = Object.fromEntries(Object.entries(parent).filter(([key, value]) =>
    typeof value === 'string' && key.toUpperCase() !== 'PATH' && inherited.has(key.toUpperCase())))
  return { ...env, PATH: pathEntries(parent).join(delimiter), AUGMENT_DISABLE_AUTO_UPDATE: '1' }
}

export async function findNode(env = process.env) {
  for (const node of nodeCandidates(env)) {
    try {
      await access(node, process.platform === 'win32' ? constants.F_OK : constants.X_OK)
      if ((await stat(node)).isFile()) return await realpath(node)
    } catch { /* Continue to the next Node installation. */ }
  }
}

export async function findEngine(env = process.env, entry) {
  entry ??= await externalEntry(env)
  if (!entry) return null
  if (!/\.[cm]?js$/i.test(entry)) return { executable: entry, args: [], env: childEnv(env) }
  const node = await findNode(env)
  return node ? { executable: node, args: [entry], env: childEnv(env) } : null
}

function probe(engine, args, signal, cwd) {
  return execute(engine.executable, [...engine.args, ...args], {
    cwd, env: engine.env, signal, timeout: 5000, maxBuffer: 8192, windowsHide: true,
  })
}

export async function engineVersion(engine, signal) {
  signal.throwIfAborted()
  try {
    const { stdout } = await probe(engine, ['--version'], signal)
    return stdout.trim().split(/\r?\n/, 1)[0].match(/^(?:auggie\s+)?v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)(?:\s+\(commit [a-f\d]+\))?$/i)?.[1]
  } catch {
    signal.throwIfAborted()
    return undefined
  }
}

export function isAuggieOne(version) {
  return version.split('.', 1)[0] === '1'
}

export function acpArgs(version, cwd) {
  return [
    '--acp', '--workspace-root', cwd, '--no-discover-workspaces',
    isAuggieOne(version) ? '--no-session' : '--dont-save-session',
  ]
}

export async function nativeLoginMissing(engine, signal, cwd) {
  try {
    await probe(engine, ['auth', 'status'], signal, cwd)
    return false
  } catch (error) {
    signal.throwIfAborted()
    return error.code === 1 && /(?:^|\r?\n)Not logged in\.(?:\r?\n|$)/i.test(error.stdout + '\n' + error.stderr)
  }
}
