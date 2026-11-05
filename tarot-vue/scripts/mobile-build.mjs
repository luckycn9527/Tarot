import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mobileVersion = JSON.parse(await readFile(path.join(root, 'mobile-version.json'), 'utf8'))
if (!/^\d+\.\d+\.\d+$/.test(mobileVersion.version) || !Number.isSafeInteger(mobileVersion.versionCode) || mobileVersion.versionCode < 1) {
  throw new Error('Invalid mobile version metadata')
}
const args = process.argv.slice(2)
const site = args.find(value => value.startsWith('--site='))?.slice(7) || 'domestic'
const profiles = {
  domestic: { origin: 'https://121.40.27.226:9443', locale: 'zh-CN' },
  overseas: { origin: 'https://asktarot.zaopic.cn', locale: 'en-US' },
}
if (!Object.hasOwn(profiles, site)) throw new Error('Mobile site must be domestic or overseas')
const profile = profiles[site]
// Public-only compile-time configuration; no server credentials are loaded.
const env = { ...process.env,
  VITE_MOBILE_APP: 'true', VITE_MOBILE_SITE: site,
  VITE_PUBLIC_APP_ORIGIN: profile.origin,
  VITE_PUBLIC_API_ORIGIN: profile.origin,
  VITE_PUBLIC_API_BASE_URL: `${profile.origin}/api`,
  VITE_PUBLIC_UPLOADS_ORIGIN: profile.origin,
  VITE_DEFAULT_LOCALE: profile.locale,
  VITE_PAYMENT_MODE: 'disabled', VITE_GOOGLE_CLIENT_ID: '',
}
function run(script, argv) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules', script), ...argv], { cwd: root, env, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}
run('vue-tsc/bin/vue-tsc.js', ['--noEmit'])
run('vite/bin/vite.js', ['build', '--config', 'vite.mobile.config.ts', '--mode', 'mobile'])
const index = await readFile(path.join(root, 'dist-mobile/index.html'))
const metadata = { version: mobileVersion.version, versionCode: mobileVersion.versionCode, site, apiOrigin: profile.origin,
  builtAt: new Date().toISOString(), indexSha256: createHash('sha256').update(index).digest('hex'), bundled: true }
await mkdir(path.join(root, 'dist-mobile'), { recursive: true })
await writeFile(path.join(root, 'dist-mobile/mobile-release.json'), JSON.stringify(metadata, null, 2) + '\n')
console.log(JSON.stringify({ mobileWebBuild: 'passed', site, version: metadata.version, apiOrigin: profile.origin }))
