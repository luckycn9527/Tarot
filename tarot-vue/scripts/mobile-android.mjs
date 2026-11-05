import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspace = path.resolve(root, '..')
const mobileVersion = JSON.parse(await readFile(path.join(root, 'mobile-version.json'), 'utf8'))
if (!/^\d+\.\d+\.\d+$/.test(mobileVersion.version) || !Number.isSafeInteger(mobileVersion.versionCode) || mobileVersion.versionCode < 1) {
  throw new Error('Invalid mobile version metadata')
}
const args = process.argv.slice(2)
const site = args.find(value => value.startsWith('--site='))?.slice(7) || 'domestic'
if (!['domestic', 'overseas'].includes(site)) throw new Error('Mobile site must be domestic or overseas')
const destination = path.join(workspace, `.cache/mobile-20261028/artifacts/${mobileVersion.version}/${site}`)
const existingSeal = path.join(destination, 'verification.json')
if (existsSync(existingSeal) && JSON.parse(await readFile(existingSeal, 'utf8')).apkSealed === true) {
  throw new Error('This version is sealed. Increment mobile-version.json before rebuilding it')
}
const toolchain = path.join(workspace, '.cache/mobile-toolchain')
const localJdk = existsSync(toolchain) ? (await readdir(toolchain)).filter(name => name.startsWith('jdk-21') && !name.endsWith('.zip')).sort().at(-1) : null
const javaHome = process.env.MOBILE_JAVA_HOME || (localJdk ? path.join(toolchain, localJdk) : process.env.JAVA_HOME)
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk') : '')
if (!androidHome || !existsSync(androidHome)) throw new Error('Install Android SDK 36 and set ANDROID_HOME before building')
const env = { ...process.env, MOBILE_DEBUG: 'true', ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome,
  ...(javaHome ? { JAVA_HOME: javaHome, PATH: path.join(javaHome, 'bin') + path.delimiter + process.env.PATH } : {}) }
function run(executable, argv, cwd = root) {
  const result = spawnSync(executable, argv, { cwd, env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
if (!args.includes('--skip-web')) run(process.execPath, [path.join(root, 'scripts/mobile-build.mjs'), `--site=${site}`])
const metadata = JSON.parse(await readFile(path.join(root, 'dist-mobile/mobile-release.json'), 'utf8'))
if (metadata.site !== site || !metadata.bundled) throw new Error('Build the matching bundled mobile website before packaging')
if (metadata.version !== mobileVersion.version || metadata.versionCode !== mobileVersion.versionCode) throw new Error('Rebuild mobile web assets for the current native version')
run(process.execPath, [path.join(root, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'android'])
const nativeConfig = JSON.parse(await readFile(path.join(root, 'android/app/src/main/assets/capacitor.config.json'), 'utf8'))
if (nativeConfig.server?.url || nativeConfig.server?.cleartext || nativeConfig.android?.allowMixedContent) throw new Error('Refusing a remote-webview or insecure native configuration')
const variant = site === 'domestic' ? 'Domestic' : 'Overseas'
const gradleArgs = [`assemble${variant}Debug`, '--no-daemon', '--console=plain']
if (process.platform === 'win32') run(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'gradlew.bat', ...gradleArgs], path.join(root, 'android'))
else run('./gradlew', gradleArgs, path.join(root, 'android'))
const source = path.join(root, `android/app/build/outputs/apk/${site}/debug/app-${site}-debug.apk`)
// Each app version has its own immutable delivery directory. Older sealed
// releases and their metadata must never be overwritten by a patch build.
await mkdir(destination, { recursive: true })
const filename = `E-Tomd-${mobileVersion.version}-${site}-debug.apk`
await copyFile(source, path.join(destination, filename))
const apk = await readFile(source)
const result = { ...metadata, platform: 'android', buildType: 'debug', applicationId: `cn.zaopic.etomd${site === 'overseas' ? '.global' : ''}`,
  filename, bytes: apk.byteLength, sha256: createHash('sha256').update(apk).digest('hex') }
await writeFile(path.join(destination, 'release.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ androidBuild: 'passed', site, version: mobileVersion.version, versionCode: mobileVersion.versionCode, apk: path.join(destination, filename), sha256: result.sha256 }))
