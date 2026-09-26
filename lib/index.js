import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import { loadNative } from './native.js'

export const name = 'dsh-agent-browser'
export const inject = ['tools', 'skills']
export const Config = z.object({
  headless: z.boolean().default(true)
})

const object = (properties, required = []) => ({
  type: 'object', additionalProperties: false, properties,
  ...(required.length ? { required } : {})
})
const render = (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]
const output = { schema: { type: 'object' }, render }
const skillPath = fileURLToPath(new URL('../assets/dsh-agent-browser/SKILL.md', import.meta.url))

function registerSkill(ctx) {
  const raw = readFileSync(skillPath, 'utf8')
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/u.exec(raw)
  if (!match) throw new Error('dsh-agent-browser skill frontmatter is missing')
  ctx.skills.register({
    name: 'dsh-agent-browser',
    description: 'Use direct in-process browser tools to navigate, inspect, and interact with web pages in DSH.',
    content: match[1].trim(),
    path: skillPath,
    source: 'bundled',
    resourceBase: { kind: 'directory', path: fileURLToPath(new URL('../assets/dsh-agent-browser/', import.meta.url)) },
    invocation: { modelInvocable: true, userInvocable: true }
  })
}

export function apply(ctx, config = {}, deps = {}) {
  const settings = {
    headless: config.headless ?? true
  }
  const NativeSession = deps.BrowserSession || loadNative().addon.BrowserSession
  registerSkill(ctx)
  const sessions = new Map()

  function getSession(execution) {
    const session = execution?.agent?.session
    const id = String(session?.id || session?.header?.id || '')
    if (!id) throw new Error('Browser tool requires an active DSH agent session')
    if (!sessions.has(id)) {
      const nativeId = `dsh-${createHash('sha256').update(id).digest('hex').slice(0, 32)}`
      sessions.set(id, { native: new NativeSession(nativeId) })
    }
    return sessions.get(id)
  }

  async function call(execution, command) {
    const session = getSession(execution)
    const request = { ...command, id: randomUUID() }
    if (request.action !== 'close' && request.headless === undefined) request.headless = settings.headless
    const response = JSON.parse(await session.native.execute(JSON.stringify(request)))
    if (!response.success) throw new Error(String(response.error || 'Browser action failed'))
    return response.data ?? {}
  }

  const register = tool => ctx.tools.register(tool)
  register({
    name: 'browser_open',
    description: 'Open a URL in the agent-browser session and return an accessibility snapshot with element references.',
    parameters: object({ url: { type: 'string' } }, ['url']), output,
    async execute({ url }, execution) {
      const navigation = await call(execution, { action: 'navigate', url })
      const snapshot = await call(execution, { action: 'snapshot', urls: true })
      return { navigation, snapshot }
    }
  })
  register({
    name: 'browser_snapshot',
    description: 'Read the current page accessibility tree and refresh element references for browser interaction.',
    parameters: object({ interactive: { type: 'boolean' }, compact: { type: 'boolean' }, urls: { type: 'boolean' } }), output,
    async execute(args, execution) { return call(execution, { action: 'snapshot', ...args }) }
  })
  register({
    name: 'browser_read',
    description: 'Read rendered page text from the active browser tab or a URL.',
    parameters: object({ url: { type: 'string' } }), output,
    async execute(args, execution) { return call(execution, { action: 'read', ...args }) }
  })
  register({
    name: 'browser_click',
    description: 'Click an element reference from the latest snapshot or a selector.',
    parameters: object({ selector: { type: 'string' }, newTab: { type: 'boolean' } }, ['selector']), output,
    async execute(args, execution) { return call(execution, { action: 'click', ...args }) }
  })
  register({
    name: 'browser_fill',
    description: 'Fill an input element reference or selector with text.',
    parameters: object({ selector: { type: 'string' }, value: { type: 'string' } }, ['selector', 'value']), output,
    async execute(args, execution) { return call(execution, { action: 'fill', ...args }) }
  })
  register({
    name: 'browser_action',
    description: 'Use any upstream agent-browser native action with its JSON fields, including tabs, waits, network, state, screenshots, and advanced interactions.',
    parameters: object({ command: { type: 'object', properties: { action: { type: 'string' } }, required: ['action'], additionalProperties: true } }, ['command']), output,
    async execute({ command }, execution) { return call(execution, command) }
  })
  register({
    name: 'browser_close',
    description: 'Close this DSH session\'s browser.',
    parameters: object({}), output,
    async execute(_args, execution) { return call(execution, { action: 'close' }) }
  })

  ctx.on('agent/disposed', ({ agent }) => {
    const id = String(agent?.session?.id || agent?.session?.header?.id || '')
    const session = sessions.get(id)
    if (!session) return
    sessions.delete(id)
    void session.native.close().catch(error => ctx.logger?.warn?.(`dsh-agent-browser: close failed: ${error instanceof Error ? error.message : String(error)}`))
  })

  ctx.effect(() => async () => {
    await Promise.allSettled([...sessions.values()].map(session => session.native.close()))
    sessions.clear()
  })
}
