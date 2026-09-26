import { strict as assert } from 'node:assert'
import { loadNative } from '../lib/native.js'

const { addon, manifest } = loadNative()
assert.equal(addon.upstreamVersion(), manifest.version)
const session = new addon.BrowserSession('dsh-native-smoke')
const info = JSON.parse(await session.execute(JSON.stringify({ action: 'session_info', id: 'smoke' })))
assert.equal(info.success, true, JSON.stringify(info))
const closed = JSON.parse(await session.close())
assert.equal(closed.success, true, JSON.stringify(closed))
console.log(`Native binding smoke passed for ${manifest.tag} on ${process.platform}-${process.arch}`)
