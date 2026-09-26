import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

function harness(config = {}) {
  const tools = new Map()
  const skills = new Map()
  const calls = []
  const created = []
  const events = new Map()
  let dispose
  class BrowserSession {
    constructor(id) { this.id = id; created.push(this) }
    async execute(raw) {
      const command = JSON.parse(raw)
      calls.push({ session: this.id, ...command })
      if (command.action === 'fail') return JSON.stringify({ success: false, error: 'native failure' })
      return JSON.stringify({ success: true, data: { action: command.action, url: command.url } })
    }
    async close() { calls.push({ session: this.id, action: 'close' }) }
  }
  apply({ tools: { register(tool) { tools.set(tool.name, tool) } }, skills: { register(skill) { skills.set(skill.name, skill) } }, on(event, listener) { events.set(event, listener) }, effect(callback) { dispose = callback() } }, config, { BrowserSession })
  const execution = id => ({ agent: { session: { id } } })
  return { tools, skills, calls, created, events, execution, dispose: () => dispose() }
}

test('browser open navigates and snapshots in one in-process session', async () => {
  const h = harness({ headless: false })
  const result = await h.tools.get('browser_open').execute({ url: 'https://example.com/' }, h.execution('one'))
  assert.equal(result.navigation.url, 'https://example.com/')
  assert.deepEqual(h.calls.map(call => call.action), ['navigate', 'snapshot'])
  assert.equal(h.calls[0].headless, false)
  assert.equal(h.calls[0].session, h.calls[1].session)
  assert.equal(h.calls[1].urls, true)
  assert.ok(h.skills.get('dsh-agent-browser').content.includes('browser_open'))
  await h.dispose()
})

test('browser sessions are isolated and advanced native actions remain available', async () => {
  const h = harness()
  await h.tools.get('browser_action').execute({ command: { action: 'tab_list' } }, h.execution('one'))
  await h.tools.get('browser_action').execute({ command: { action: 'tab_list' } }, h.execution('two'))
  assert.equal(h.created.length, 2)
  assert.notEqual(h.calls[0].session, h.calls[1].session)
  await assert.rejects(h.tools.get('browser_action').execute({ command: { action: 'fail' } }, h.execution('one')), /native failure/)
  await h.dispose()
  assert.equal(h.calls.filter(call => call.action === 'close').length, 2)
})

test('disposing one DSH agent closes only its browser', async () => {
  const h = harness()
  await h.tools.get('browser_action').execute({ command: { action: 'tab_list' } }, h.execution('one'))
  await h.tools.get('browser_action').execute({ command: { action: 'tab_list' } }, h.execution('two'))
  h.events.get('agent/disposed')({ agent: { session: { id: 'one' } } })
  await Promise.resolve()
  assert.deepEqual(h.calls.filter(call => call.action === 'close').map(call => call.session), [h.created[0].id])
  await h.dispose()
  assert.equal(h.calls.filter(call => call.action === 'close').length, 2)
})
