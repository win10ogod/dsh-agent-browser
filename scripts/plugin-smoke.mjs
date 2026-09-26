import { strict as assert } from 'node:assert'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { apply } from '../lib/index.js'

const server = createServer((request, response) => {
  response.setHeader('content-type', 'text/html; charset=utf-8')
  if (request.url === '/source') response.end('<!doctype html><title>Source</title><h1>Verified source page</h1>')
  else response.end('<!doctype html><title>Entry</title><h1>Direct browser integration</h1><a href="/source">Verified result</a>')
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`
const tools = new Map()
const skills = new Map()
let dispose
const ctx = {
  tools: { register(tool) { tools.set(tool.name, tool) } },
  skills: { register(skill) { skills.set(skill.name, skill) } },
  on() {},
  effect(callback) { dispose = callback() }
}
const execution = { agent: { session: { id: 'dsh-plugin-smoke' } } }

try {
  apply(ctx)
  assert.ok(skills.has('dsh-agent-browser'))
  const opened = await tools.get('browser_open').execute({ url: `${base}/` }, execution)
  assert.match(JSON.stringify(opened.snapshot), /Direct browser integration/)
  await tools.get('browser_click').execute({ selector: 'a' }, execution)
  const source = await tools.get('browser_read').execute({}, execution)
  assert.match(JSON.stringify(source), /Verified source page/)
  console.log(`DSH plugin smoke passed on ${process.platform}-${process.arch}`)
} finally {
  if (dispose) await dispose()
  server.close()
  await once(server, 'close')
}
