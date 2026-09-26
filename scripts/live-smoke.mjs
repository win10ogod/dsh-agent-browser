import { strict as assert } from 'node:assert'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { loadNative } from '../lib/native.js'

const server = createServer((_request, response) => {
  response.setHeader('content-type', 'text/html; charset=utf-8')
  response.end('<!doctype html><title>DSH Browser Smoke</title><h1>Direct browser works</h1><input id="q"><button id="go" onclick="document.querySelector(\'h1\').textContent = document.querySelector(\'#q\').value">Go</button>')
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const url = `http://127.0.0.1:${server.address().port}/`
const { addon } = loadNative()
const browser = new addon.BrowserSession('dsh-live-smoke')

async function action(command) {
  const response = JSON.parse(await browser.execute(JSON.stringify({ ...command, id: command.action })))
  assert.equal(response.success, true, JSON.stringify(response))
  return response.data
}

try {
  await action({ action: 'navigate', url, headless: true })
  const before = await action({ action: 'snapshot' })
  assert.match(JSON.stringify(before), /Direct browser works/)
  await action({ action: 'fill', selector: '#q', value: 'DSH direct native binding' })
  await action({ action: 'click', selector: '#go' })
  const after = await action({ action: 'snapshot' })
  assert.match(JSON.stringify(after), /DSH direct native binding/)
  console.log(`Live browser smoke passed on ${process.platform}-${process.arch}`)
} finally {
  await browser.close()
  server.close()
  await once(server, 'close')
}
