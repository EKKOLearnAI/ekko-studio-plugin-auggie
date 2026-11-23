import { Buffer } from 'node:buffer'
import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const attachmentLimit = 8 * 1024 * 1024
const inlineTextLimit = 64 * 1024
export const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value
export const text = value => ({ type: 'text', text: value })

export async function initialize(acp, signal, version) {
  const hello = await acp.request('initialize', {
    protocolVersion: 1, clientCapabilities: {},
    clientInfo: { name: 'ekko-studio-auggie', version },
  }, signal)
  if (hello?.protocolVersion !== 1 || hello.agentInfo?.name !== 'auggie') {
    throw new Error('The executable did not identify itself as the Auggie CLI ACP agent.')
  }
  return hello.agentCapabilities ?? {}
}

function stringPairs(values) {
  return Object.entries(values ?? {}).map(([name, value]) => ({ name, value: String(value) }))
}

export function acpServers(servers, capabilities) {
  return Object.entries(servers).map(([name, server]) => {
    if (typeof server.command === 'string' && server.command) {
      return { name, command: server.command, args: server.args ?? [], env: stringPairs(server.env) }
    }
    const type = server.type ?? 'http'
    if ((type !== 'http' && type !== 'sse') || !capabilities?.[type] || typeof server.url !== 'string') {
      throw new Error('Auggie does not support a Studio MCP server transport required by this turn.')
    }
    return { name, type, url: server.url, headers: stringPairs(server.headers) }
  })
}

function optionFor(session, category) {
  return session?.configOptions?.find(option => option.type === 'select' && (option.category === category || option.id === category ||
    (category === 'thought_level' && ['thinking', 'reasoning', 'reasoning_effort'].includes(option.id))))
}

function choices(option) {
  return option.options.flatMap(item => Array.isArray(item.options) ? item.options : [item])
}

export function nativeModels(session) {
  const option = optionFor(session, 'model')
  const current = option?.currentValue ?? session?.models?.currentModelId
  const options = option ? choices(option) : session?.models?.availableModels ?? []
  const efforts = optionFor(session, 'thought_level')
  const reasoningEfforts = efforts ? choices(efforts).map(item => item.value).filter(validId) : []
  const models = new Map()
  for (const model of options) {
    const id = model.value ?? model.modelId
    if (!validId(id) || models.has(id)) continue
    models.set(id, {
      id, name: validId(model.name) ? model.name : id,
      ...(id === current ? { isDefault: true, ...(reasoningEfforts.length ? { reasoningEfforts } : {}) } : {}),
    })
  }
  return [...models.values()]
}

async function setOption(acp, sessionId, option, selected, signal) {
  if (option.currentValue === selected) return
  if (!choices(option).some(item => item.value === selected)) throw new Error('The selected Auggie session option is unavailable.')
  const result = await acp.request('session/set_config_option', { sessionId, configId: option.id, value: selected }, signal)
  if (result?.configOptions?.find(item => item.id === option.id)?.currentValue !== selected) {
    throw new Error('Auggie did not confirm the selected session option.')
  }
  return result.configOptions
}

export async function chooseModel(acp, sessionId, session, model, signal) {
  if (model?.model) {
    const option = optionFor(session, 'model')
    if (option) {
      const configOptions = await setOption(acp, sessionId, option, model.model, signal)
      if (configOptions) session = { ...session, configOptions }
    } else if (session?.models?.currentModelId !== model.model) {
      if (!nativeModels(session).some(item => item.id === model.model)) throw new Error('The selected Auggie model is unavailable.')
      await acp.request('session/set_model', { sessionId, modelId: model.model }, signal)
    }
  }
  if (model?.reasoningEffort) {
    const effort = optionFor(session, 'thought_level')
    if (!effort) throw new Error('Auggie did not expose a reasoning setting for the selected model.')
    await setOption(acp, sessionId, effort, model.reasoningEffort, signal)
  }
}

export async function promptContent(input, run, capabilities, signal, getDirectory) {
  let attachmentBytes = 0
  let files = 0
  const encode = async part => {
    if (part.type === 'text') return text(part.text)
    const file = await run.attachments.resolve(part.assetId)
    signal.throwIfAborted()
    const isImage = part.type === 'image'
    if (isImage && !capabilities?.image) throw new Error('Auggie does not support image input over ACP.')
    const mimeType = file.mediaType || part.mediaType || 'application/octet-stream'
    if (isImage && !mimeType.startsWith('image/')) throw new Error('The Studio image has an invalid media type.')
    if (file.size > attachmentLimit - attachmentBytes) throw new Error('Auggie attachments exceed the 8 MiB per-turn limit.')
    const bytes = Buffer.from(await run.attachments.read(part.assetId))
    signal.throwIfAborted()
    attachmentBytes += bytes.byteLength
    if (attachmentBytes > attachmentLimit) throw new Error('Auggie attachments exceed the 8 MiB per-turn limit.')
    if (isImage) return { type: 'image', mimeType, data: bytes.toString('base64') }
    const name = (file.name || part.name).replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 256)
    const likelyText = mimeType.startsWith('text/') || /(?:json|xml|javascript|yaml)$/.test(mimeType)
    let decoded
    if (likelyText) {
      try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { /* Binary or non-UTF-8 input remains available as file bytes. */ }
    }
    if (capabilities?.embeddedContext) {
      const uri = `file:///studio-attachments/${encodeURIComponent(part.assetId)}/${encodeURIComponent(name)}`
      const payload = decoded === undefined ? { blob: bytes.toString('base64') } : { text: decoded }
      return { type: 'resource', resource: { uri, mimeType, ...payload } }
    }
    if (decoded !== undefined && bytes.length <= inlineTextLimit) {
      return text(`Studio attachment ${JSON.stringify(name)} (${mimeType}):\n${decoded}`)
    }
    const extension = extname(name).match(/^\.[a-z0-9]{1,12}$/i)?.[0] ?? ''
    const path = join(await getDirectory(), `attachment-${++files}${extension}`)
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600, signal })
    return text(`Studio attachment ${JSON.stringify(name)} (${mimeType}) is available for the Auggie file tools at ${JSON.stringify(path)}. Read this file when needed for the current request.`)
  }

  const prompt = []
  const instructions = input.instructions.map(item => `[${item.kind}] ${item.text}`).join('\n\n')
  if (instructions) prompt.push(text(`Studio instructions:\n${instructions}`))
  if (input.history.length) {
    prompt.push(text('The following is prior Studio conversation history. Use it as context for the current turn. Do not replay earlier actions.'))
    for (const message of input.history) {
      prompt.push(text(`[Earlier ${message.role} message]`))
      for (const part of message.content) prompt.push(await encode(part))
    }
    prompt.push(text('[Current user turn]'))
  }
  for (const part of input.input) prompt.push(await encode(part))
  return prompt
}
