import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readdir, realpath, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { applyEdits, getNodeValue, modify, parseDocument, parseTree } from './vendor-config.mjs'
import { childEnv } from './engine.mjs'

const fileLimit = 512 * 1024
const skillPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const serverPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/
const reserved = new Set(['__proto__', 'constructor', 'prototype'])
const mcpKeys = ['type', 'command', 'args', 'env', 'url', 'headers']
const transports = ['stdio', 'http', 'sse']
const mask = '[stored value]'
const format = { formattingOptions: { insertSpaces: true, tabSize: 2 } }
const revision = text => text === undefined ? '' : createHash('sha256').update(text).digest('hex')
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const exists = async path => lstat(path).catch(error => {
  if (error.code !== 'ENOENT') throw error
})

export function nativeSettingsRoot(env = childEnv()) {
  const homeKey = process.platform === 'win32' ? 'USERPROFILE' : 'HOME'
  const home = Object.entries(env).find(([name]) => name.toUpperCase() === homeKey)?.[1] || homedir()
  if (!isAbsolute(home)) throw new Error('Auggie requires an absolute host home directory.')
  return join(home, '.augment')
}

function checkRevision(expected, text) {
  if (expected !== revision(text)) throw new Error('Auggie files changed. Reload the editor before saving.')
}

function checkName(name, kind) {
  const valid = kind === 'skill' ? name.length <= 64 && skillPattern.test(name) : serverPattern.test(name)
  if (!valid || reserved.has(name)) throw new Error('Invalid Auggie resource name.')
  return name
}

async function safeDirectories(home, segments, create = false) {
  let path = await realpath(home)
  for (const segment of segments) {
    path = join(path, segment)
    let current = await exists(path)
    if (!current && create) {
      await mkdir(path, { mode: 0o700 }).catch(error => {
        if (error.code !== 'EEXIST') throw error
      })
      current = await exists(path)
    }
    if (!current) return undefined
    if (!current.isDirectory()) throw new Error('Auggie configuration directories must be ordinary directories without symbolic links.')
  }
  return path
}

async function readText(file) {
  const state = await exists(file)
  if (!state) return undefined
  if (!state.isFile() || state.size > fileLimit) throw new Error('Auggie configuration is not a regular file or exceeds 512 KiB.')
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const current = await handle.stat()
    if (!current.isFile() || current.size > fileLimit) throw new Error('Auggie configuration is not a regular file or exceeds 512 KiB.')
    const bytes = Buffer.alloc(fileLimit + 1)
    let offset = 0
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset)
      if (!bytesRead) break
      offset += bytesRead
    }
    if (offset > fileLimit) throw new Error('Auggie configuration exceeds 512 KiB.')
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, offset))
  } finally {
    await handle.close()
  }
}

async function atomicWrite(file, text, expected, signal) {
  if (Buffer.byteLength(text) > fileLimit) throw new Error('Auggie configuration exceeds 512 KiB.')
  const temporary = join(dirname(file), '.studio-auggie-' + randomUUID())
  try {
    await writeFile(temporary, text, { mode: 0o600, flag: 'wx', signal })
    checkRevision(expected, await readText(file))
    signal.throwIfAborted()
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true })
  }
}

function parseObject(text, allowComments, label) {
  const error = () => new Error(label + ' must be an object with unique, safe keys.')
  const errors = []
  const tree = parseTree(text.replace(/^\uFEFF/, ''), errors, { allowTrailingComma: allowComments, disallowComments: !allowComments })
  if (errors.length || tree?.type !== 'object') throw error()
  // Inspect the syntax tree before creating JS objects or applying path edits.
  const pending = [tree]
  while (pending.length) {
    const node = pending.pop()
    if (node.type === 'object') {
      const keys = new Set()
      for (const property of node.children ?? []) {
        const [key, value] = property.children
        if (keys.has(key.value) || reserved.has(key.value)) throw error()
        keys.add(key.value)
        pending.push(value)
      }
    } else if (node.type === 'array') {
      pending.push(...node.children)
    }
  }
  try {
    return getNodeValue(tree)
  } catch {
    throw error()
  }
}

const settingChecks = {
  defaultModel: text => typeof text === 'string' && /^[\w.+:/-]{1,160}$/.test(text),
  enableSkillCommands: value => typeof value === 'boolean',
  enableToolSearch: value => typeof value === 'boolean',
  theme: text => typeof text === 'string' && /^[\w .-]{1,80}$/.test(text),
  notificationMode: value => ['off', 'bell', 'desktop_notification'].includes(value),
}

function settingsForEditor(settings) {
  return Object.fromEntries(Object.entries(settingChecks).filter(([key, valid]) =>
    valid(settings[key])).map(([key]) => [key, settings[key]]))
}

function editJson(text, path, value) {
  return applyEdits(text, modify(text, path, value, format))
}

function maskedConfig(config) {
  const output = {}
  if (transports.includes(config.type)) output.type = config.type
  for (const key of ['command', 'url']) {
    if (typeof config[key] === 'string') output[key] = mask
  }
  if (Array.isArray(config.args)) output.args = config.args.map(() => mask)
  for (const key of ['env', 'headers']) {
    if (object(config[key])) {
      output[key] = Object.fromEntries(Object.keys(config[key]).map(name => [name, mask]))
    }
  }
  return output
}

function mergeMcp(text, previous) {
  const config = parseObject(text, false, 'MCP configuration')
  if (Object.keys(config).some(key => !mcpKeys.includes(key))) throw new Error('Use supported Auggie MCP fields only.')
  const restore = (value, stored) => {
    if (value !== mask) return value
    if (typeof stored !== 'string') throw new Error('Enter a value in place of an unmatched stored value marker.')
    return stored
  }
  for (const key of ['command', 'url']) {
    if (Object.hasOwn(config, key)) config[key] = restore(config[key], previous?.[key])
  }
  if (Array.isArray(config.args)) config.args = config.args.map((arg, index) => restore(arg, previous?.args?.[index]))
  for (const key of ['env', 'headers']) {
    if (object(config[key])) {
      config[key] = Object.fromEntries(Object.entries(config[key]).map(([name, value]) => [
        name, restore(value, previous?.[key]?.[name]),
      ]))
    }
  }
  for (const key of ['env', 'headers']) {
    const value = config[key]
    if (value !== undefined && (!object(value) || Object.values(value).some(item => typeof item !== 'string'))) {
      throw new Error('MCP headers and environment variables must be string mappings.')
    }
  }
  if (config.args !== undefined && (!Array.isArray(config.args) || config.args.some(arg => typeof arg !== 'string'))) {
    throw new Error('MCP args must be a list of strings.')
  }
  const type = config.type ?? (config.command ? 'stdio' : 'http')
  if (!transports.includes(type)) throw new Error('Choose stdio, http or sse for Auggie MCP.')
  if (type === 'stdio') {
    if (typeof config.command !== 'string' || !config.command.trim() || config.url !== undefined || config.headers !== undefined) {
      throw new Error('A stdio MCP server needs a command and may use args or env.')
    }
  } else {
    let url
    try { url = new URL(config.url) } catch { /* Return a sanitized error. */ }
    if (!url || !['https:', 'http:'].includes(url.protocol) || config.command !== undefined || config.args !== undefined || config.env !== undefined) {
      throw new Error('An http or sse MCP server needs an HTTP(S) URL and may use headers.')
    }
  }
  return config
}

function validateSkill(name, markdown) {
  const header = markdown.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (header) {
    try {
      const doc = parseDocument(header[1], { strict: true, uniqueKeys: true })
      const value = doc.errors.length ? null : doc.toJS({ maxAliasCount: 0 })
      if (object(value) && Object.hasOwn(value, 'name') && Object.hasOwn(value, 'description') && value.name === name && typeof value.description === 'string' &&
          value.description.trim() && value.description.length <= 1024) return
    } catch { /* Avoid echoing Skill contents in errors. */ }
  }
  throw new Error('SKILL.md needs YAML front matter with a matching name and a description of up to 1024 characters.')
}

export function nativeConfiguration(root = nativeSettingsRoot()) {
  const home = dirname(root)
  const dir = basename(root)
  const settingsPath = join(root, 'settings.json')
  const skillsPath = join(root, 'skills')
  let pending = Promise.resolve()

  function serialize(signal, action) {
    const next = pending.then(() => {
      signal.throwIfAborted()
      return action()
    })
    pending = next.catch(() => {})
    return next
  }

  function skillDirectory(name, create) {
    return safeDirectories(home, [dir, 'skills', checkName(name, 'skill')], create)
  }

  async function settings() {
    const directory = await safeDirectories(home, [dir])
    const text = directory ? await readText(join(directory, 'settings.json')) : undefined
    const value = text === undefined ? {} : parseObject(text, true, 'Auggie settings.json')
    return { text, value }
  }

  async function saveSettings(text, expected, signal) {
    const directory = await safeDirectories(home, [dir], true)
    const current = await readText(join(directory, 'settings.json'))
    checkRevision(expected, current)
    if (text !== (current ?? '{}\n')) {
      parseObject(text, true, 'Auggie settings.json')
      await atomicWrite(join(directory, 'settings.json'), text, expected, signal)
    }
    return { ok: true }
  }

  function mcpServers(value) {
    const servers = value.mcpServers ?? {}
    if (!object(servers)) throw new Error('Auggie mcpServers must be a JSON object.')
    return servers
  }

  return {
    async listSkills() {
      const directory = await safeDirectories(home, [dir, 'skills'])
      const entries = directory ? await readdir(directory, { withFileTypes: true }) : []
      const names = []
      for (const item of entries) {
        if (!item.isDirectory() || item.name.length > 64 || !skillPattern.test(item.name) || reserved.has(item.name)) continue
        if ((await exists(join(directory, item.name, 'SKILL.md')))?.isFile()) names.push(item.name)
      }
      return { path: skillsPath, names: names.sort() }
    },
    async readSkill({ name }) {
      const directory = await skillDirectory(name)
      const markdown = directory ? await readText(join(directory, 'SKILL.md')) : undefined
      return { text: markdown ?? '', revision: revision(markdown) }
    },
    saveSkill({ name, text, revision: expected }, signal) {
      return serialize(signal, async () => {
        validateSkill(name, text)
        const current = await skillDirectory(name)
        checkRevision(expected, current ? await readText(join(current, 'SKILL.md')) : undefined)
        const directory = current ?? await skillDirectory(name, true)
        await atomicWrite(join(directory, 'SKILL.md'), text, expected, signal)
        return { ok: true }
      })
    },
    removeSkill({ name, revision: expected }, signal) {
      return serialize(signal, async () => {
        const directory = await skillDirectory(name)
        if (!directory) throw new Error('Auggie Skill was moved or removed.')
        const file = join(directory, 'SKILL.md')
        const text = await readText(file)
        if (text === undefined) throw new Error('Auggie Skill was moved or removed.')
        checkRevision(expected, text)
        signal.throwIfAborted()
        await unlink(file)
        return { ok: true }
      })
    },
    async listMcp() {
      const { value, text } = await settings()
      const names = Object.keys(mcpServers(value)).filter(name => serverPattern.test(name) && !reserved.has(name)).sort()
      return { path: settingsPath, names, revision: revision(text) }
    },
    async readMcp({ name }) {
      checkName(name, 'mcp')
      const { value, text } = await settings()
      const config = mcpServers(value)[name]
      if (!object(config)) throw new Error('Auggie MCP server was removed or has an unsupported format.')
      return { text: JSON.stringify(maskedConfig(config), null, 2), revision: revision(text) }
    },
    saveMcp({ name, text, revision: expected, existing }, signal) {
      return serialize(signal, async () => {
        checkName(name, 'mcp')
        const current = await settings()
        checkRevision(expected, current.text)
        const servers = mcpServers(current.value)
        if (Object.hasOwn(servers, name) !== existing) throw new Error('Auggie MCP server already exists or was removed.')
        const previous = servers[name]
        if (existing && !object(previous)) throw new Error('Auggie MCP server has an unsupported format.')
        const config = mergeMcp(text, previous)
        let edited = current.text ?? '{}\n'
        if (!existing) {
          edited = editJson(edited, ['mcpServers', name], config)
        } else {
          for (const key of mcpKeys) {
            if (Object.hasOwn(config, key) || Object.hasOwn(previous, key)) {
              edited = editJson(edited, ['mcpServers', name, key], config[key])
            }
          }
        }
        return saveSettings(edited, expected, signal)
      })
    },
    removeMcp({ name, revision: expected }, signal) {
      return serialize(signal, async () => {
        checkName(name, 'mcp')
        const current = await settings()
        checkRevision(expected, current.text)
        if (!Object.hasOwn(mcpServers(current.value), name)) throw new Error('Auggie MCP server was removed.')
        return saveSettings(editJson(current.text, ['mcpServers', name], undefined), expected, signal)
      })
    },
    async readSettings() {
      const { text, value } = await settings()
      return { path: settingsPath, text: JSON.stringify(settingsForEditor(value), null, 2), revision: revision(text) }
    },
    saveSettings({ text, revision: expected }, signal) {
      return serialize(signal, async () => {
        const current = await settings()
        checkRevision(expected, current.text)
        const patch = parseObject(text, false, 'Settings editor JSON')
        let edited = current.text ?? '{}\n'
        for (const [key, value] of Object.entries(patch)) {
          if (!Object.hasOwn(settingChecks, key) || value !== null && !settingChecks[key](value)) {
            throw new Error('Use only the listed Auggie settings and value types.')
          }
          if (value !== null || Object.hasOwn(current.value, key)) {
            edited = editJson(edited, [key], value === null ? undefined : value)
          }
        }
        return saveSettings(edited, expected, signal)
      })
    },
  }
}
