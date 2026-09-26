import { access, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const tag = process.argv[2]
if (!/^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(tag || '')) throw new Error('Pass an upstream release tag')
const version = tag.slice(1)
for (const platform of ['linux-x64', 'win32-x64', 'darwin-x64', 'darwin-arm64']) {
  const manifest = JSON.parse(await readFile(join(root, 'native', `${platform}.json`), 'utf8'))
  if (manifest.version !== version || manifest.tag !== tag) throw new Error(`Native ${platform} was built from ${manifest.tag}, expected ${tag}`)
  await access(join(root, 'native', `${platform}.node`))
}
const path = join(root, 'package.json')
const pkg = JSON.parse(await readFile(path, 'utf8'))
pkg.version = version
await writeFile(path, JSON.stringify(pkg, null, 2) + '\n')
console.log(`Validated four native builds for agent-browser ${tag}`)
