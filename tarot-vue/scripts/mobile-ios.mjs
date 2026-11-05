import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const usage = 'Usage: npm run mobile:ios -- [--site=domestic|overseas] [--open] [--check]'

async function main() {
  if (args.includes('--help')) { console.log(usage); return }
  if (args.some(value => !['--check', '--open'].includes(value) && !/^--site=(domestic|overseas)$/.test(value))) {
    throw new Error(usage)
  }
  if (args.filter(value => value.startsWith('--site=')).length > 1) throw new Error('Specify --site only once')
  const check = args.includes('--check')
  const site = args.find(value => value.startsWith('--site='))?.slice(7) || 'domestic'
  if (!check && process.platform !== 'darwin') {
    throw new Error('iOS preparation requires macOS with Xcode 26+. This computer cannot build iOS. Use --check for a read-only static plan, then run this command on your Mac.')
  }
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Capacitor 8 requires Node.js 22 or newer')

  const version = JSON.parse(await readFile(path.join(root, 'mobile-version.json'), 'utf8'))
  if (!/^\d+\.\d+\.\d+$/.test(version.version) || !Number.isSafeInteger(version.versionCode) || version.versionCode < 1) {
    throw new Error('Invalid mobile-version.json: expected version x.y.z and a positive integer versionCode')
  }
  const projectPath = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj')
  const project = await readFile(projectPath, 'utf8')
  const plist = await readFile(path.join(root, 'ios/App/App/Info.plist'), 'utf8')
  const spm = await readFile(path.join(root, 'ios/App/CapApp-SPM/Package.swift'), 'utf8')
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const capacitorVersion = packageJson.dependencies['@capacitor/ios']
  if (capacitorVersion !== packageJson.dependencies['@capacitor/core'] || capacitorVersion !== packageJson.devDependencies['@capacitor/cli']) {
    throw new Error('Keep @capacitor/core, @capacitor/ios and @capacitor/cli versions aligned before syncing')
  }
  if (!spm.includes(`exact: "${capacitorVersion}"`) || !spm.includes('.iOS(.v15)')) {
    throw new Error('Expected the existing Capacitor Swift Package Manager project with iOS 15 deployment target')
  }
  const nativeVersions = [...project.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map(match => match[1])
  const nativeCodes = [...project.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map(match => match[1])
  if (nativeVersions.length !== 2 || nativeCodes.length !== 2) throw new Error('Expected Debug and Release native version settings')
  for (const key of ['CFBundleShortVersionString', 'CFBundleVersion', 'NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription']) {
    if (!plist.includes(`<key>${key}</key>`)) throw new Error(`Missing iOS Info.plist key: ${key}`)
  }
  const plan = {
    site, version: version.version, versionCode: version.versionCode,
    capacitorVersion, minimumNode: 22, minimumXcode: 26, minimumIOS: '15.0',
    project: 'ios/App/App.xcodeproj',
    steps: ['mobile-ios-icon.mjs', 'mobile-build.mjs', 'cap sync ios', 'sync native version', 'verify bundled assets', ...(args.includes('--open') ? ['cap open ios'] : [])],
  }
  if (check) {
    console.log(JSON.stringify({ iosStaticCheck: 'passed', ...plan, currentNativeVersions: nativeVersions, currentNativeBuildNumbers: nativeCodes, writes: false, nativeBuild: 'not-run', signing: 'not-checked' }, null, 2))
    return
  }

  function run(executable, argv, capture = false) {
    const result = spawnSync(executable, argv, { cwd: root, env: process.env, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' })
    if (result.error) throw new Error(`Cannot run ${path.basename(executable)}: ${result.error.message}`)
    if (result.status !== 0) throw new Error(`${path.basename(executable)} exited with status ${result.status ?? 'unknown'}${capture ? `: ${(result.stderr || '').trim()}` : ''}`)
    return result.stdout || ''
  }
  const cli = path.join(root, 'node_modules/@capacitor/cli/bin/capacitor')
  try { await access(cli) } catch { throw new Error('Dependencies are missing. Run npm ci in tarot-vue first') }
  const xcode = run('/usr/bin/xcodebuild', ['-version'], true)
  const xcodeMajor = Number(xcode.match(/^Xcode (\d+)/m)?.[1])
  if (!xcodeMajor || xcodeMajor < 26) throw new Error('Install and select full Xcode 26+ (xcode-select); Command Line Tools alone are insufficient')

  run(process.execPath, [path.join(root, 'scripts/mobile-ios-icon.mjs')])
  run(process.execPath, [path.join(root, 'scripts/mobile-build.mjs'), `--site=${site}`])
  run(process.execPath, [cli, 'sync', 'ios'])
  // Keep Team, Bundle Identifier and signing settings chosen in Xcode intact.
  const syncedProject = await readFile(projectPath, 'utf8')
  if ([...syncedProject.matchAll(/MARKETING_VERSION = [^;]+;/g)].length !== 2 || [...syncedProject.matchAll(/CURRENT_PROJECT_VERSION = [^;]+;/g)].length !== 2) {
    throw new Error('Native version layout changed during sync; inspect the Xcode project before continuing')
  }
  const updatedProject = syncedProject
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version.version};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${version.versionCode};`)
  if (updatedProject !== syncedProject) await writeFile(projectPath, updatedProject)
  const nativeConfig = JSON.parse(await readFile(path.join(root, 'ios/App/App/capacitor.config.json'), 'utf8'))
  if (nativeConfig.server?.url || nativeConfig.server?.cleartext || nativeConfig.server?.iosScheme !== 'capacitor') {
    throw new Error('Refusing a remote-webview or insecure iOS configuration')
  }
  const bundled = path.join(root, 'ios/App/App/public')
  const metadata = JSON.parse(await readFile(path.join(bundled, 'mobile-release.json'), 'utf8'))
  const webMetadata = JSON.parse(await readFile(path.join(root, 'dist-mobile/mobile-release.json'), 'utf8'))
  const indexHash = createHash('sha256').update(await readFile(path.join(bundled, 'index.html'))).digest('hex')
  if (metadata.site !== site || metadata.version !== version.version || metadata.versionCode !== version.versionCode || !metadata.bundled || metadata.indexSha256 !== indexHash || JSON.stringify(metadata) !== JSON.stringify(webMetadata)) {
    throw new Error('iOS bundled assets do not match the new mobile web build')
  }
  if (args.includes('--open')) run(process.execPath, [cli, 'open', 'ios'])
  console.log(JSON.stringify({ iosPreparation: 'passed', ...plan, nativeBuild: 'not-run', signing: 'configure-in-xcode', next: 'Select Team and destination in Xcode, then Run or Archive' }, null, 2))
}

try { await main() } catch (error) { console.error(`iOS preparation stopped: ${error.message}`); process.exitCode = 1 }
