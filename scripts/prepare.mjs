import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const output = resolve(projectRoot, '.build/upstream')
const sourceArg = process.argv.indexOf('--source')
const source = sourceArg >= 0 ? resolve(process.argv[sourceArg + 1]) : null
const tagArg = process.argv.indexOf('--tag')

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`)
}

async function latestTag() {
  const response = await fetch('https://api.github.com/repos/vercel-labs/agent-browser/releases/latest', {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'dsh-agent-browser-build' }
  })
  if (!response.ok) throw new Error(`GitHub latest release request failed: HTTP ${response.status}`)
  const release = await response.json()
  if (!/^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(release.tag_name)) throw new Error('Unexpected agent-browser release tag')
  return release.tag_name
}

await rm(output, { recursive: true, force: true })
await mkdir(resolve(projectRoot, '.build'), { recursive: true })
let tag
if (source) {
  await cp(source, output, {
    recursive: true,
    filter: path => !/(?:^|[\\/])(?:\.git|node_modules|target)(?:[\\/]|$)/.test(path)
  })
  const pkg = JSON.parse(await readFile(join(output, 'package.json'), 'utf8'))
  tag = `v${pkg.version}`
} else {
  tag = tagArg >= 0 ? process.argv[tagArg + 1] : await latestTag()
  if (!/^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(tag)) throw new Error('Invalid release tag')
  run('git', ['clone', '--depth', '1', '--branch', tag, 'https://github.com/vercel-labs/agent-browser.git', output], projectRoot)
}

const manifestPath = join(output, 'cli/Cargo.toml')
const manifest = await readFile(manifestPath, 'utf8')
if (manifest.includes('[lib]') || manifest.includes('[dependencies.napi]')) throw new Error('Upstream now defines a library or NAPI binding; review adapter before release')
const separator = manifest.includes('\r\n') ? '\r\n' : '\n'
const addition = [
  '', '[lib]', 'crate-type = ["cdylib"]', '',
  '[dependencies.napi]', 'version = "=3.13.0"', 'features = ["async", "napi8"]', '',
  '[dependencies.napi-derive]', 'version = "=3.6.9"', '',
  '[build-dependencies.napi-build]', 'version = "=2.5.0"', ''
].join(separator)
await writeFile(manifestPath, manifest + addition)
const buildPath = join(output, 'cli/build.rs')
const buildScript = await readFile(buildPath, 'utf8')
if (!buildScript.includes('fn main() {') || buildScript.includes('napi_build::setup()')) throw new Error('Cannot safely inject NAPI linker setup into upstream build.rs')
await writeFile(buildPath, buildScript.replace('fn main() {', `fn main() {${separator}    napi_build::setup();`))
await cp(join(projectRoot, 'bridge/lib.rs'), join(output, 'cli/src/lib.rs'))
await writeFile(join(projectRoot, '.build/upstream-version.json'), JSON.stringify({ version: tag.slice(1), tag }, null, 2) + '\n')
console.log(`Prepared agent-browser ${tag} for native DSH binding`)
