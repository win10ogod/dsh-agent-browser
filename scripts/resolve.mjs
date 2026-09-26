import { appendFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const headers = { accept: 'application/vnd.github+json', 'user-agent': 'dsh-agent-browser-release' }
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
const upstream = await fetch('https://api.github.com/repos/vercel-labs/agent-browser/releases/latest', { headers })
if (!upstream.ok) throw new Error(`Could not resolve upstream release: HTTP ${upstream.status}`)
const { tag_name: tag } = await upstream.json()
if (!/^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(tag)) throw new Error(`Unexpected upstream tag: ${tag}`)
const project = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const repo = process.env.GITHUB_REPOSITORY
let exists = false
if (repo) {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers })
  if (response.status !== 404 && !response.ok) throw new Error(`Could not check plugin release: HTTP ${response.status}`)
  exists = response.ok
}
const shouldBuild = !exists || ['push', 'pull_request', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)
const lines = [`tag=${tag}`, `should_build=${shouldBuild}`, `should_release=${!exists && process.env.GITHUB_EVENT_NAME !== 'pull_request'}`]
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n')
console.log(`${project.name}: upstream ${tag}; build=${shouldBuild}; release=${!exists}`)
