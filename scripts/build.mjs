import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const upstream = join(root, '.build/upstream')
const version = JSON.parse(await readFile(join(root, '.build/upstream-version.json'), 'utf8'))
const result = spawnSync('cargo', ['build', '--release', '--lib', '--manifest-path', join(upstream, 'cli/Cargo.toml')], {
  cwd: upstream, stdio: 'inherit', shell: false,
  env: { ...process.env, CARGO_TARGET_DIR: process.env.CARGO_TARGET_DIR || join(upstream, 'cli/target') }
})
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`Native build failed with status ${result.status}`)
const library = process.platform === 'win32' ? 'agent_browser.dll' : process.platform === 'darwin' ? 'libagent_browser.dylib' : 'libagent_browser.so'
const target = `${process.platform}-${process.arch}.node`
await mkdir(join(root, 'native'), { recursive: true })
await copyFile(join(process.env.CARGO_TARGET_DIR || upstream, ...(process.env.CARGO_TARGET_DIR ? [] : ['cli/target']), 'release', library), join(root, 'native', target))
await writeFile(join(root, 'native', `${process.platform}-${process.arch}.json`), JSON.stringify(version, null, 2) + '\n')
console.log(`Built native/${target} from ${version.tag}`)
