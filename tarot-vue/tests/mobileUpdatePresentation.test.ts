import test from 'node:test'
import assert from 'node:assert/strict'
import { updateErrorRecovery } from '../src/mobile/mobileUpdatePresentation'
import type { UpdateManifest, UpdateState } from '../src/mobile/mobileUpdateModel'

function manifest(): UpdateManifest {
  return { schema: 1, site: 'domestic', applicationId: 'cn.zaopic.etomd', version: '0.1.24', versionCode: 25,
    minSdk: 24, bytes: 14_000_000, sha256: 'a'.repeat(64),
    downloadUrl: 'https://121.40.27.226:9443/downloads/E-Tomd-0.1.24-domestic-debug.apk',
    releaseNotes: ['改进更新体验。'], publishedAt: '2026-11-06T08:00:00Z' }
}
function state(patch: Partial<UpdateState> = {}): UpdateState {
  return { currentVersion: '0.1.23', currentVersionCode: 24, applicationId: 'cn.zaopic.etomd', site: 'domestic', sdkInt: 35,
    status: 'error', latest: manifest(), downloadedBytes: 14_000_000, totalBytes: 14_000_000, progress: 100,
    installPermissionGranted: true, downloadReady: true, errorCode: 'INSTALL_FAILED', ...patch }
}

test('a ready compatible package offers installation retry after installer or settings failure', () => {
  for (const errorCode of ['INSTALL_FAILED', 'SETTINGS_FAILED']) {
    for (const english of [false, true]) {
      const result = updateErrorRecovery(state({ errorCode }), english)
      assert.equal(result.action, 'install')
      assert.match(result.label!, english ? /Retry installation/ : /重试安装/)
      assert.doesNotMatch(result.message, english ? /connection|network/i : /网络/)
    }
  }
})

test('missing install permission offers system settings and a manual path while keeping the ready package', () => {
  for (const errorCode of ['INSTALL_FAILED', 'SETTINGS_FAILED']) {
    const zh = updateErrorRecovery(state({ errorCode, installPermissionGranted: false }), false)
    const en = updateErrorRecovery(state({ errorCode, installPermissionGranted: false }), true)
    assert.equal(zh.action, 'settings'); assert.equal(en.action, 'settings')
    assert.match(zh.message, /系统设置.*E-Tomd.*安装未知应用/)
    assert.match(en.message, /system settings.*unknown apps/)
  }
})

test('an unavailable ready signal or package identity never offers install or settings', () => {
  for (const patch of [
    { downloadReady: false }, { downloadReady: undefined }, { latest: undefined },
    { applicationId: 'another.app' }, { site: 'overseas' },
    { currentVersionCode: 25 }, { currentVersionCode: NaN }, { sdkInt: 23 },
    { latest: { ...manifest(), sha256: 'bad' } },
    { latest: { ...manifest(), downloadUrl: 'https://untrusted.example/update.apk' } },
  ]) {
    for (const errorCode of ['INSTALL_FAILED', 'SETTINGS_FAILED']) {
      const result = updateErrorRecovery(state({ ...patch, errorCode }), false)
      assert.notEqual(result.action, 'install', JSON.stringify(patch))
      assert.notEqual(result.action, 'settings', JSON.stringify(patch))
    }
  }
  assert.equal(updateErrorRecovery(state({ downloadReady: false }), false).action, 'download')
  assert.equal(updateErrorRecovery(state({ latest: undefined }), false).action, 'check')
})

test('package and manifest safety failures cannot retry install, even with a stale ready flag', () => {
  for (const errorCode of ['HASH_MISMATCH', 'SIZE_MISMATCH', 'SIGNATURE_MISMATCH', 'WRONG_PACKAGE', 'WRONG_APPLICATION', 'WRONG_SITE',
    'VERSION_MISMATCH', 'INVALID_APK', 'INVALID_MANIFEST', 'VERIFY_FAILED', 'INVALID_DOWNLOAD_URL', 'INVALID_RELEASE_NOTES', 'INVALID_PUBLISHED_AT']) {
    const result = updateErrorRecovery(state({ errorCode }), false)
    assert.equal(result.action, 'download', errorCode)
    assert.match(result.message, /安全检查/)
  }
  const missing = updateErrorRecovery(state({ errorCode: 'INVALID_MANIFEST', latest: undefined }), true)
  assert.equal(missing.action, 'check'); assert.match(missing.message, /verified/)
})

test('an incompatible update never offers a download or install action', () => {
  for (const patch of [{ errorCode: 'INCOMPATIBLE_SDK' }, { latest: { ...manifest(), minSdk: 36 } },
    { errorCode: 'INVALID_APK_INCOMPATIBLE_SDK' }]) {
    for (const english of [false, true]) {
      const result = updateErrorRecovery(state(patch), english)
      assert.equal(result.action, 'check'); assert.match(result.message, english ? /newer Android/ : /更高版本/)
    }
  }
})

test('storage, network and service failures explain different recovery causes', () => {
  const cases = [
    ['INSUFFICIENT_STORAGE', /存储空间不足/, /not enough storage/],
    ['STORAGE_ERROR', /无法保存更新/, /could not be saved/],
    ['NETWORK_ERROR', /网络连接中断/, /network connection/],
    ['HTTP_ERROR', /更新服务暂时不可用/, /service is temporarily unavailable/],
  ] as const
  for (const [errorCode, zh, en] of cases) {
    assert.match(updateErrorRecovery(state({ errorCode }), false).message, zh)
    assert.match(updateErrorRecovery(state({ errorCode }), true).message, en)
    assert.equal(updateErrorRecovery(state({ errorCode }), false).action, 'download')
    assert.equal(updateErrorRecovery(state({ errorCode, latest: undefined }), false).action, 'check')
  }
  const tls = updateErrorRecovery(state({ errorCode: 'SECURE_CONNECTION_ERROR' }), false)
  assert.match(tls.message, /安全连接/); assert.equal(tls.action, 'check')
})

test('missing package, missing update and bridge failure have safe dedicated actions', () => {
  assert.equal(updateErrorRecovery(state({ errorCode: 'NO_DOWNLOAD' }), false).action, 'download')
  assert.equal(updateErrorRecovery(state({ errorCode: 'NO_DOWNLOAD', latest: undefined }), false).action, 'check')
  assert.equal(updateErrorRecovery(state({ errorCode: 'NO_UPDATE' }), false).action, 'check')
  const bridge = updateErrorRecovery(state({ errorCode: 'BRIDGE_ERROR' }), true)
  assert.equal(bridge.action, 'refresh'); assert.match(bridge.message, /status/)
})

test('unknown failures do not expose native exceptions or reuse a ready flag for installation', () => {
  for (const errorCode of ['UPDATE_FAILED', 'NEW_NATIVE_FAILURE', '', undefined]) {
    for (const english of [false, true]) {
      const result = updateErrorRecovery(state({ errorCode, message: 'secret file path /data/user/0/private/package.apk' }), english)
      assert.equal(result.action, 'check'); assert.doesNotMatch(result.message, /secret|private|package.apk/)
      assert.doesNotMatch(result.label!, /secret|private/)
    }
  }
})

test('a non-error snapshot never exposes an error recovery action', () => {
  for (const status of ['idle', 'checking', 'available', 'downloading', 'verifying', 'downloaded', 'permissionRequired', 'installing', 'cancelled', 'upToDate', 'unavailable'] as const)
    assert.deepEqual(updateErrorRecovery(state({ status }), false), { message: '', action: null })
})
