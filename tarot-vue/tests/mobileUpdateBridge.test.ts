import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import type { UpdateState } from '../src/mobile/mobileUpdateModel'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/mobile/mobileUpdater.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue'],
  define: { 'import.meta.env': '{"DEV":false}' },
  plugins: [{ name: 'isolated-native-updater', setup(builder) {
    builder.onResolve({ filter: /^(@capacitor\/core|\.\/mobileStorage)$/ }, args => ({ path: args.path, namespace: 'updater-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'updater-test' }, args => ({ contents: args.path === './mobileStorage'
      ? 'export const mobileSite="domestic";'
      : 'export const Capacitor={getPlatform:()=>"android"};export const registerPlugin=()=>__native;' }))
  } }],
})
const require = createRequire(import.meta.url)
function state(patch: Partial<UpdateState> = {}): UpdateState {
  return { status: 'error', errorCode: 'INSTALL_FAILED', downloadReady: true,
    currentVersion: '0.1.8', currentVersionCode: 9, applicationId: 'cn.zaopic.etomd', site: 'domestic', sdkInt: 35,
    installPermissionGranted: true, downloadedBytes: 12_345_678, totalBytes: 12_345_678, progress: 100,
    latest: { schema: 1, site: 'domestic', applicationId: 'cn.zaopic.etomd', version: '0.1.9', versionCode: 10,
      minSdk: 24, bytes: 12_345_678, sha256: 'a'.repeat(64),
      downloadUrl: 'https://121.40.27.226:9443/downloads/E-Tomd-0.1.9-domestic-debug.apk',
      releaseNotes: ['更新说明'], publishedAt: '2026-10-29T12:00:00Z' }, ...patch }
}
function boot(getState: () => Promise<UpdateState>) {
  let notify!: (value: UpdateState) => void
  const native = { getState, addListener: async (_: string, listener: typeof notify) => { notify = listener; return { remove: async () => {} } } }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', '__native', 'window', compiled.outputFiles[0]!.text)(
    require, module, module.exports, native, {},
  )
  return { updater: module.exports as typeof import('../src/mobile/mobileUpdater'), notify: (value: UpdateState) => notify(value) }
}

test('native verified-package availability survives the bridge without exposing exception text', async () => {
  const snapshot = { ...state(), message: 'private system exception details' }
  const { updater } = boot(async () => snapshot)
  await updater.initializeMobileUpdater()
  assert.equal(updater.mobileUpdateState.value.downloadReady, true)
  assert.equal(updater.mobileUpdateState.value.errorCode, 'INSTALL_FAILED')
  assert.equal(updater.mobileUpdateState.value.message, undefined)
  updater.disposeMobileUpdater()
})

test('invalid manifest clears the verified-package claim and cannot become install-ready', async () => {
  const { updater } = boot(async () => state({ latest: { ...state().latest!, sha256: 'bad' } }))
  await updater.initializeMobileUpdater()
  assert.equal(updater.mobileUpdateState.value.status, 'error')
  assert.equal(updater.mobileUpdateState.value.errorCode, 'INVALID_MANIFEST')
  assert.notEqual(updater.mobileUpdateState.value.downloadReady, true)
  updater.disposeMobileUpdater()
})

test('an incompatible native snapshot produces the specific Android-version error', async () => {
  const { updater } = boot(async () => state({ status: 'available', errorCode: undefined, latest: { ...state().latest!, minSdk: 36 } }))
  await updater.initializeMobileUpdater()
  assert.equal(updater.mobileUpdateState.value.status, 'error')
  assert.equal(updater.mobileUpdateState.value.errorCode, 'INCOMPATIBLE_SDK')
  updater.disposeMobileUpdater()
})

test('a newer native recovery event wins over the pending older state read', async () => {
  let complete!: (value: UpdateState) => void
  const fixture = boot(() => new Promise(resolve => { complete = resolve }))
  const initializing = fixture.updater.initializeMobileUpdater()
  await new Promise(resolve => setImmediate(resolve))
  fixture.notify(state({ errorCode: 'SETTINGS_FAILED', installPermissionGranted: false }))
  complete(state({ status: 'available', downloadReady: false, errorCode: undefined }))
  await initializing
  assert.equal(fixture.updater.mobileUpdateState.value.errorCode, 'SETTINGS_FAILED')
  assert.equal(fixture.updater.mobileUpdateState.value.downloadReady, true)
  assert.equal(fixture.updater.mobileUpdateState.value.installPermissionGranted, false)
  fixture.updater.disposeMobileUpdater()
})
