import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createUpdateManifest, generateUpdateBundle, SIGNING_CERTIFICATE_SHA256 } from '../scripts/mobile-update-feed.mjs'
import { validateUpdateManifest } from '../src/mobile/mobileUpdateModel'

function fixture() {
  const apk = Buffer.alloc(1024 * 1024, 71)
  const release = { version: '0.1.8', versionCode: 9, site: 'domestic', apiOrigin: 'https://121.40.27.226:9443',
    applicationId: 'cn.zaopic.etomd', platform: 'android', buildType: 'debug', bundled: true,
    filename: 'E-Tomd-0.1.8-domestic-debug.apk', bytes: apk.length,
    sha256: createHash('sha256').update(apk).digest('hex'), builtAt: '2026-10-29T12:00:00.000Z' }
  const seal = { ...release, apkSealed: true, signature: { passed: true, certificateSha256: SIGNING_CERTIFICATE_SHA256 },
    apkManifest: { applicationId: release.applicationId, versionName: release.version, versionCode: release.versionCode, minSdk: 24 } }
  return { apk, release, seal }
}

test('update feed uses the sealed domestic package identity and fixed HTTPS path', () => {
  const { release, seal } = fixture()
  const result = createUpdateManifest(release, seal, ['支持应用内检查更新'], release.builtAt, ['Check for updates in the app'])
  assert.equal(result.downloadUrl, 'https://121.40.27.226:9443/downloads/E-Tomd-0.1.8-domestic-debug.apk')
  assert.equal(result.schema, 1)
  assert.equal(result.minSdk, 24)
  assert.equal(result.versionCode, 9)
  assert.deepEqual(result.releaseNotesEn, ['Check for updates in the app'])
  assert.equal(validateUpdateManifest(result).valid, true)
})

test('feed rejects unsealed, mismatched, wrong-signing or out-of-bound release metadata', () => {
  const { release, seal } = fixture()
  for (const altered of [
    { ...seal, apkSealed: false }, { ...seal, sha256: 'a'.repeat(64) },
    { ...seal, signature: { passed: true, certificateSha256: '0'.repeat(64) } },
    { ...seal, apkManifest: { ...seal.apkManifest, versionCode: 10 } },
    { ...seal, apkManifest: { ...seal.apkManifest, minSdk: 23 } },
  ]) assert.throws(() => createUpdateManifest(release, altered, ['更新'], release.builtAt))
  for (const altered of [
    { ...release, site: 'overseas' }, { ...release, filename: '../payload.apk' },
    { ...release, bytes: 1 }, { ...release, versionCode: 2100000001 }, { ...release, version: '12345.1.1' },
    { ...release, version: '01.1.1' },
    { ...release, sha256: release.sha256.toUpperCase() },
  ]) assert.throws(() => createUpdateManifest(altered, seal, ['更新'], release.builtAt))
  assert.throws(() => createUpdateManifest(release, seal, [], release.builtAt))
  assert.throws(() => createUpdateManifest(release, seal, [' '.repeat(501)], release.builtAt))
  assert.throws(() => createUpdateManifest(release, seal, ['更新\u0000'], release.builtAt))
  for (const invalid of ['yesterday', '2026-10-29T12:00Z', '2026-02-30T12:00:00Z', '2026-10-29T24:00:00Z', '2026-10-29T12:00:00+24:00']) {
    assert.throws(() => createUpdateManifest(release, seal, ['更新'], invalid))
  }
})

test('staging verifies actual APK bytes and preserves every existing release file', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'etomd-feed-'))
  try {
    const { apk, release, seal } = fixture()
    const source = path.join(temporary, 'sealed')
    const output = path.join(temporary, 'publish')
    await mkdir(source)
    const releasePath = path.join(source, 'release.json')
    const original = JSON.stringify(release, null, 2) + '\n'
    await writeFile(releasePath, original)
    await writeFile(path.join(source, 'verification.json'), JSON.stringify(seal))
    await writeFile(path.join(source, release.filename), apk)
    const options = { releasePath, outputDirectory: output, releaseNotes: ['应用内更新'] }
    const result = await generateUpdateBundle(options)
    assert.equal(result.files.length, 4)
    await generateUpdateBundle(options) // Byte-identical repeated generation is safe.
    assert.equal(await readFile(releasePath, 'utf8'), original)
    assert.equal(await readFile(path.join(output, `${release.filename}.sha256`), 'utf8'), `${release.sha256}  ${release.filename}\n`)
    await assert.rejects(generateUpdateBundle({ ...options, releaseNotes: ['不同的发布说明'] }), /Refusing to overwrite/)
    await writeFile(path.join(source, release.filename), Buffer.alloc(apk.length))
    await assert.rejects(generateUpdateBundle(options), /APK bytes or SHA256/)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
