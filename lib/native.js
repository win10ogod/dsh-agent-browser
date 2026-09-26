import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const root = dirname(dirname(fileURLToPath(import.meta.url)))

export function loadNative() {
  const platform = `${process.platform}-${process.arch}`
  const manifestPath = join(root, 'native', `${platform}.json`)
  const addonPath = join(root, 'native', `${platform}.node`)
  let manifest
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) }
  catch (error) { throw new Error(`dsh-agent-browser has no native build for ${platform}: ${error.message}`) }
  const addon = require(addonPath)
  if (addon.upstreamVersion() !== manifest.version) {
    throw new Error(`dsh-agent-browser native version mismatch: ${addon.upstreamVersion()} != ${manifest.version}`)
  }
  return { addon, manifest }
}
