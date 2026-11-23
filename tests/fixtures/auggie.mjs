#!/usr/bin/env node
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

const mode = process.env.AUGGIE_TEST_MODE
const version = mode === 'signed-out-v0' ? '0.37.0' : '1.2.2'
const cwd = process.cwd()
if (process.argv[2] === '--version') {
  console.log(version === '0.37.0' ? '0.37.0 (commit 903418fc)' : '1.2.2\ncommit: 6f24c7b3')
  process.exit(0)
}
if (process.argv[2] === 'auth') {
  assert.deepEqual(process.argv.slice(2), ['auth', 'status'])
  if (mode === 'signed-out-v1') {
    console.log('Not logged in.')
    process.exit(1)
  }
  process.exit(0)
}
assert.deepEqual(process.argv.slice(2), ['--acp', '--workspace-root', cwd, '--no-discover-workspaces',
  version === '0.37.0' ? '--dont-save-session' : '--no-session'])
assert.equal(process.env.AUGMENT_DISABLE_AUTO_UPDATE, '1')
const useLegacy = mode === 'legacy'
const wire = join(cwd, 'wire.jsonl')
let nativeId
let selected = 'native-default'
let effort = 'low'
let turn
let pending
const config = () => [
  { type: 'select', category: 'model', id: 'native-model', currentValue: selected,
    options: [{ value: 'native-default', name: 'Native Default' }, { group: 'more', options: [{ value: 'native-other', name: 'Native Other' }] }] },
  { type: 'select', category: 'thought_level', id: 'native-effort', currentValue: effort,
    options: [{ value: 'low', name: 'Low' }, { value: 'high', name: 'High' }] },
]
const sessionOptions = () => useLegacy ? { models: { currentModelId: selected, availableModels: [
  { modelId: 'native-default', name: 'Native Default' }, { modelId: 'native-other', name: 'Native Other' },
] } } : { configOptions: config() }
const send = frame => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...frame }) + '\n')
const respond = (id, result = {}) => send({ id, result })
const fail = (id, code) => send({ id, error: { code, message: 'SECRET_AUGGIE_ERROR_REJECTED' } })
const update = (value, sessionId = nativeId) => send({ method: 'session/update', params: { sessionId, update: value } })
const message = (text, sessionId) => update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } }, sessionId)
const finish = reason => {
  respond(turn, { stopReason: reason })
  turn = undefined
}

for await (const line of createInterface({ input: process.stdin })) {
  const frame = JSON.parse(line)
  const { method, params, id, result } = frame
  if (method === 'initialize') {
    respond(id, { protocolVersion: 1, agentInfo: { name: 'auggie', version },
      agentCapabilities: { loadSession: true, promptCapabilities: { image: mode !== 'no-image', embeddedContext: mode === 'embedded' },
        mcpCapabilities: { http: mode !== 'stdio-only', sse: true } } })
  } else if (method === 'session/new') {
    assert.equal(params.cwd, cwd)
    if (mode === 'signed-out-v0') { fail(id, -32000); continue }
    nativeId = randomUUID()
    appendFileSync(wire, JSON.stringify(frame) + '\n')
    respond(id, { sessionId: nativeId, ...sessionOptions() })
  } else if (method === 'session/set_config_option' || method === 'session/set_model') {
    assert.equal(params.sessionId, nativeId)
    appendFileSync(wire, JSON.stringify(frame) + '\n')
    if (params.configId === 'native-effort') effort = params.value
    else selected = params.modelId || params.value
    respond(id, sessionOptions())
  } else if (method === 'session/prompt') {
    assert.equal(params.sessionId, nativeId)
    appendFileSync(wire, JSON.stringify(frame) + '\n')
    turn = id
    const lastText = params.prompt.findLast(block => block.type === 'text' && !block.text.startsWith('Studio attachment '))?.text
    for (const block of params.prompt) {
      const match = block.text?.match(/available for the Auggie file tools at (".*")\. Read this file/)
      if (match) {
        const attachment = JSON.parse(match[1])
        assert.deepEqual(readFileSync(attachment), Buffer.from([0, 9, 255]))
        appendFileSync(wire, JSON.stringify({ staged: attachment }) + '\n')
      }
    }
    if (lastText === 'wire-error') {
      process.stderr.write('SECRET_AUGGIE_STDERR')
      fail(id, -32603)
      continue
    }
    if (lastText === 'wait') {
      message('waiting')
      continue
    }
    if (['permission', 'cancel-permission', 'always-only'].includes(lastText)) {
      pending = 'approval'
      const toolCall = { toolCallId: 'fixture-tool', kind: 'execute', title: 'echo fixture token=SECRET_AUGGIE_TITLE',
        rawInput: { command: 'echo fixture', apiKey: 'SECRET_AUGGIE_RAW' } }
      update({ sessionUpdate: 'tool_call', ...toolCall, status: 'pending' })
      send({ id: 'wrong-session', method: 'session/request_permission', params: { sessionId: 'another-session', toolCall, options: [] } })
      send({ id: pending, method: 'session/request_permission', params: { sessionId: nativeId, toolCall,
        options: [
          ...(lastText === 'always-only' ? [] : [{ optionId: 'allow', kind: 'allow_once' }]),
          { optionId: 'allow-always', kind: 'allow_always' }, { optionId: 'deny', kind: 'reject_once' },
        ] } })
      continue
    }
    message('IGNORED_OTHER_SESSION', 'another-session')
    if (lastText === 'workspace marker') {
      message(readFileSync(join(cwd, 'marker.txt'), 'utf8'))
      finish('end_turn')
      continue
    }
    message('fresh:')
    message(selected)
    finish('end_turn')
  } else if (method === 'session/cancel') {
    appendFileSync(wire, JSON.stringify(frame) + '\n')
    assert.equal(params.sessionId, nativeId)
    message('LATE_MUST_NOT_STREAM')
    finish('cancelled')
  } else if (id === pending || id === 'wrong-session') {
    appendFileSync(wire, JSON.stringify(frame) + '\n')
    if (id === pending && turn !== undefined) {
      const option = result.outcome.optionId
      update({ sessionUpdate: 'tool_call_update', toolCallId: 'fixture-tool', status: option === 'allow' ? 'completed' : 'failed' })
      message(option || 'permission-cancelled')
      finish('end_turn')
    }
  } else {
    fail(id, -32601)
  }
}
