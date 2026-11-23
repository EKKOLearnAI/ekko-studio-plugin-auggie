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

export function childEnv(parent = process.env) {
  return {
    ...Object.fromEntries(Object.entries(parent).filter(([key]) => inherited.has(key.toUpperCase()))),
    AUGMENT_DISABLE_AUTO_UPDATE: '1',
  }
}

export async function findEngine(env = process.env, platform = process.platform, home = homedir()) {
  const override = env.EKKO_AUGGIE_EXECUTABLE
  const windows = platform === 'win32'
  const path = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? ''
  const folders = path.split(windows ? ';' : delimiter).filter(isAbsolute)
  if (windows && env.APPDATA && isAbsolute(env.APPDATA)) folders.push(join(env.APPDATA, 'npm'))
  if (!windows) folders.push(join(home, '.local', 'bin'))
  const candidates = override ? [override] : folders.flatMap(dir => windows
    ? ['auggie.exe', 'node_modules/@augmentcode/auggie/auggie-v2.mjs', 'node_modules/@augmentcode/auggie/augment.mjs']
      .map(name => join(dir, name))
    : [join(dir, 'auggie')])
  for (const candidate of new Set(candidates)) {
    if (!isAbsolute(candidate)) continue
    const extension = extname(candidate).toLowerCase()
    const javascript = extension === '.mjs' || extension === '.js'
    if (windows && !javascript && extension !== '.exe') continue
    try {
      await access(candidate, windows || javascript ? constants.F_OK : constants.X_OK)
      if (!(await stat(candidate)).isFile()) continue
      const resolved = await realpath(candidate)
      return javascript
        ? { executable: process.execPath, args: [resolved], env: childEnv(env) }
        : { executable: resolved, args: [], env: childEnv(env) }
    } catch { /* Continue through absolute executable locations. */ }
  }
  return null
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
