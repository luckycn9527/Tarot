import test from 'node:test'
import assert from 'node:assert/strict'
import { canInstallUpdate, classifyUpdate, isUpdateBusy, MAX_UPDATE_BYTES, MIN_UPDATE_BYTES, UPDATE_FEED_URL, validateUpdateManifest } from '../src/mobile/mobileUpdateModel'
import type { UpdateManifest, UpdateState } from '../src/mobile/mobileUpdateModel'

function manifest(): UpdateManifest {
  return {
    schema: 1, site: 'domestic', applicationId: 'cn.zaopic.etomd', version: '0.1.9', versionCode: 10,
    minSdk: 24, bytes: 12_345_678, sha256: 'a'.repeat(64),
    downloadUrl: 'https://121.40.27.226:9443/downloads/E-Tomd-0.1.9-domestic-debug.apk',
    releaseNotes: ['支持应用内下载和安装更新。'], releaseNotesEn: ['Download and install updates in the app.'],
    publishedAt: '2026-10-29T12:00:00.000Z',
  }
}
function state(): UpdateState {
  return { currentVersion: '0.1.8', currentVersionCode: 9, applicationId: 'cn.zaopic.etomd', site: 'domestic', sdkInt: 35,
    status: 'downloaded', latest: manifest(), downloadedBytes: 12_345_678, totalBytes: 12_345_678, progress: 100, installPermissionGranted: true }
}
const valid = (value: unknown) => validateUpdateManifest(value).valid

test('update manifest accepts a complete canonical domestic release and clones its unchanged notes', () => {
  const input = { ...manifest(), releaseNotes: ['保留 原始说明与标点。'] }
  const parsed = validateUpdateManifest(input)
  assert.equal(parsed.valid, true)
  if (!parsed.valid) return
  assert.equal(parsed.value.sha256, input.sha256)
  assert.deepEqual(parsed.value.releaseNotes, input.releaseNotes)
  assert.notEqual(parsed.value.releaseNotes, input.releaseNotes)
  assert.equal(UPDATE_FEED_URL, 'https://121.40.27.226:9443/downloads/android-latest.json')
})

test('wrong site, package, malformed document and renamed contract fields cannot become an update', () => {
  for (const value of [null, [], {}, { ...manifest(), schema: 2 }, { ...manifest(), site: 'overseas' },
    { ...manifest(), applicationId: 'cn.zaopic.etomd.global' }, { ...manifest(), applicationId: undefined, appId: 'cn.zaopic.etomd' }]) assert.equal(valid(value), false)
})

test('download URL is exactly bound to the fixed HTTPS origin, version and domestic APK path', () => {
  const original = manifest()
  for (const downloadUrl of [
    original.downloadUrl.replace('https:', 'http:'), original.downloadUrl.replace(':9443', ''),
    original.downloadUrl.replace('121.40.27.226', 'evil.example'), original.downloadUrl.replace('https://', 'https://user@'),
    original.downloadUrl + '?token=x', original.downloadUrl + '#fragment', original.downloadUrl + '/',
    original.downloadUrl.replace('/downloads/', '/downloads/../downloads/'), original.downloadUrl.replace('/E-Tomd-', '/%45-Tomd-'),
    original.downloadUrl.replace('0.1.9', '0.1.8'), original.downloadUrl.replace('-domestic-', '-overseas-'),
    ' ' + original.downloadUrl,
  ]) assert.equal(valid({ ...original, downloadUrl }), false, downloadUrl)
})

test('hash, package size, SDK and version fields enforce finite bounded download metadata', () => {
  for (const patch of [
    { sha256: 'a'.repeat(63) }, { sha256: 'z'.repeat(64) }, { sha256: 'AB'.repeat(32) }, { bytes: MIN_UPDATE_BYTES - 1 }, { bytes: MAX_UPDATE_BYTES + 1 },
    { bytes: Infinity }, { bytes: 12_345_678.5 }, { minSdk: 23 }, { minSdk: 101 }, { minSdk: 24.5 },
    { versionCode: 0 }, { versionCode: 2_100_000_001 }, { versionCode: NaN }, { versionCode: '10' },
    { version: '../0.1.9' }, { version: '01.1.9' }, { version: '0.1.9-beta' }, { version: '10000.1.9' },
  ]) assert.equal(valid({ ...manifest(), ...patch }), false, JSON.stringify(patch))
  assert.equal(valid({ ...manifest(), bytes: MIN_UPDATE_BYTES }), true)
  assert.equal(valid({ ...manifest(), bytes: MAX_UPDATE_BYTES, minSdk: 100 }), true)
})

test('release notes and publication timestamp must contain usable text and an explicit valid instant', () => {
  for (const patch of [
    { releaseNotes: [] }, { releaseNotes: [' '] }, { releaseNotes: ['x'.repeat(501)] }, { releaseNotes: [1] },
    { releaseNotes: ['unsafe\u0000text'] }, { releaseNotesEn: [] }, { releaseNotesEn: [''] },
    { publishedAt: 'not-a-date' }, { publishedAt: '2026-10-29' }, { publishedAt: '2026-10-29T12:00:00' },
    { publishedAt: '2026-02-30T12:00:00Z' }, { publishedAt: '2026-10-29T24:00:00Z' },
  ]) assert.equal(valid({ ...manifest(), ...patch }), false, JSON.stringify(patch))
  assert.equal(valid({ ...manifest(), releaseNotesEn: undefined, publishedAt: '2026-10-29T20:00:00+08:00' }), true)
})

test('same and older versions are valid feeds but never offer a downgrade, regardless of version text', () => {
  const release = manifest()
  assert.equal(classifyUpdate(release, 10, 35), 'upToDate')
  assert.equal(classifyUpdate(release, 11, 35), 'upToDate')
  assert.equal(classifyUpdate(release, 9, 35), 'available')
  assert.equal(classifyUpdate({ ...release, minSdk: 36 }, 9, 35), 'incompatible')
  assert.equal(classifyUpdate({ ...release, version: '0.0.1' }, 9, 35), 'available')
})

test('only a verified downloaded state with install permission and a valid newer compatible package can install', () => {
  assert.equal(canInstallUpdate(state()), true)
  for (const status of ['available', 'downloading', 'verifying', 'permissionRequired', 'cancelled', 'error', 'unavailable', 'upToDate'] as const)
    assert.equal(canInstallUpdate({ ...state(), status }), false, status)
  assert.equal(canInstallUpdate({ ...state(), installPermissionGranted: false }), false)
  assert.equal(canInstallUpdate({ ...state(), currentVersionCode: 10 }), false)
  assert.equal(canInstallUpdate({ ...state(), sdkInt: 23 }), false)
  assert.equal(canInstallUpdate({ ...state(), latest: { ...manifest(), sha256: 'bad' } }), false)
  assert.equal(canInstallUpdate({ ...state(), applicationId: 'another.app' }), false)
  assert.equal(isUpdateBusy('downloading'), true)
  assert.equal(isUpdateBusy('verifying'), true)
  assert.equal(isUpdateBusy('cancelled'), false)
  assert.equal(isUpdateBusy('error'), false)
})
