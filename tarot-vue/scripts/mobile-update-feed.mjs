import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const UPDATE_ORIGIN = 'https://121.40.27.226:9443'
export const APPLICATION_ID = 'cn.zaopic.etomd'
export const SIGNING_CERTIFICATE_SHA256 = '7ac4149b980a97febfc8c0c30f34f033a16bf23a83ade40ea56702b13916b8f5'
const VERSION = /^(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})$/
const SHA256 = /^[a-f0-9]{64}$/

function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

function notes(value, name) {
  requireValue(Array.isArray(value) && value.length >= 1 && value.length <= 30, `${name} must contain 1..30 entries`)
  requireValue(value.every(note => typeof note === 'string' && note.trim().length > 0 && note.length <= 500 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note)), `${name} entries must contain 1..500 characters without control characters`)
  return value
}

function validPublishedAt(value) {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value)
  if (!match || !Number.isFinite(Date.parse(value))) return false
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] &&
    Number(match[4]) <= 23 && Number(match[5]) <= 59 && Number(match[6]) <= 59 &&
    (match[7] === 'Z' || (Number(match[8]) <= 23 && Number(match[9]) <= 59))
}

export function createUpdateManifest(release, seal, releaseNotes, publishedAt, releaseNotesEn) {
  requireValue(release && typeof release === 'object' && seal && typeof seal === 'object', 'Release and seal are required')
  requireValue(typeof release.version === 'string' && VERSION.test(release.version), 'Invalid version')
  requireValue(Number.isSafeInteger(release.versionCode) && release.versionCode >= 1 && release.versionCode <= 2100000000, 'Invalid versionCode')
  requireValue(release.site === 'domestic' && release.apiOrigin === UPDATE_ORIGIN && release.applicationId === APPLICATION_ID, 'Only the domestic Android application can be published')
  requireValue(release.platform === 'android' && release.buildType === 'debug' && release.bundled === true, 'Expected a bundled domestic debug APK')
  requireValue(release.filename === `E-Tomd-${release.version}-domestic-debug.apk`, 'Invalid APK filename')
  requireValue(Number.isSafeInteger(release.bytes) && release.bytes >= 1024 * 1024 && release.bytes <= 200 * 1024 * 1024, 'Invalid APK size')
  requireValue(typeof release.sha256 === 'string' && SHA256.test(release.sha256), 'Invalid APK SHA256')
  requireValue(seal.apkSealed === true, 'APK must be sealed before creating its update feed')
  for (const field of ['version', 'versionCode', 'site', 'apiOrigin', 'applicationId', 'filename', 'bytes', 'sha256']) {
    requireValue(seal[field] === release[field], `Seal differs from release: ${field}`)
  }
  requireValue(seal.signature?.passed === true && seal.signature.certificateSha256 === SIGNING_CERTIFICATE_SHA256, 'APK signing certificate has not been verified')
  const manifest = seal.apkManifest
  requireValue(manifest?.applicationId === APPLICATION_ID && manifest.versionName === release.version && manifest.versionCode === release.versionCode, 'Sealed APK identity differs from release')
  requireValue(Number.isSafeInteger(manifest.minSdk) && manifest.minSdk >= 24 && manifest.minSdk <= 100, 'Invalid sealed minSdk')
  requireValue(validPublishedAt(publishedAt), 'publishedAt must be a valid full ISO timestamp')
  return {
    schema: 1, site: 'domestic', applicationId: APPLICATION_ID,
    version: release.version, versionCode: release.versionCode, minSdk: manifest.minSdk,
    bytes: release.bytes, sha256: release.sha256,
    downloadUrl: `${UPDATE_ORIGIN}/downloads/${release.filename}`,
    releaseNotes: notes(releaseNotes, 'releaseNotes'),
    ...(releaseNotesEn === undefined ? {} : { releaseNotesEn: notes(releaseNotesEn, 'releaseNotesEn') }),
    publishedAt,
  }
}

const digest = data => createHash('sha256').update(data).digest('hex')
async function existingData(filename) {
  try { return await readFile(filename) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

export async function generateUpdateBundle({ releasePath, verificationPath, outputDirectory, releaseNotes, releaseNotesEn, publishedAt }) {
  const inputPath = path.resolve(releasePath)
  const releaseData = await readFile(inputPath)
  const release = JSON.parse(releaseData.toString('utf8'))
  const seal = JSON.parse(await readFile(verificationPath || path.join(path.dirname(inputPath), 'verification.json'), 'utf8'))
  const feed = createUpdateManifest(release, seal, releaseNotes, publishedAt || release.builtAt, releaseNotesEn)
  const apkPath = path.join(path.dirname(inputPath), release.filename)
  requireValue((await stat(apkPath)).isFile(), 'APK is not a regular file')
  const apk = await readFile(apkPath)
  requireValue(apk.length === release.bytes && digest(apk) === release.sha256, 'APK bytes or SHA256 differs from the sealed release')
  const output = path.resolve(outputDirectory)
  await mkdir(output, { recursive: true })
  const canonicalInput = await realpath(path.dirname(inputPath))
  const canonicalOutput = await realpath(output)
  requireValue(canonicalInput !== canonicalOutput && !canonicalOutput.startsWith(canonicalInput + path.sep), 'Use a staging directory outside the sealed release directory')
  const files = new Map([
    [release.filename, apk],
    [`${release.filename}.sha256`, Buffer.from(`${release.sha256}  ${release.filename}\n`)],
    [`E-Tomd-${release.version}-domestic-release.json`, releaseData],
    ['android-latest.json', Buffer.from(JSON.stringify(feed, null, 2) + '\n')],
  ])
  // Check every name before writing anything; never replace a different candidate.
  for (const [name, data] of files) {
    const existing = await existingData(path.join(output, name))
    requireValue(existing === null || existing.equals(data), `Refusing to overwrite a different file: ${name}`)
  }
  for (const [name, data] of files) {
    const destination = path.join(output, name)
    try {
      if (name === release.filename) await copyFile(apkPath, destination, constants.COPYFILE_EXCL)
      else await writeFile(destination, data, { flag: 'wx' })
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      requireValue((await readFile(destination)).equals(data), `Concurrent file change: ${name}`)
    }
    requireValue((await readFile(destination)).equals(data), `Staged file verification failed: ${name}`)
  }
  return { outputDirectory: output, feed, files: [...files].map(([name, data]) => ({ name, bytes: data.length, sha256: digest(data) })) }
}

async function main() {
  const values = new Map(process.argv.slice(2).map(argument => {
    const separator = argument.indexOf('=')
    requireValue(separator > 2, 'Use --release=... --notes=... --out=... [--published-at=...]')
    return [argument.slice(0, separator), argument.slice(separator + 1)]
  }))
  requireValue([...values.keys()].every(key => ['--release', '--verification', '--notes', '--out', '--published-at'].includes(key)), 'Unknown argument')
  requireValue(values.has('--release') && values.has('--notes') && values.has('--out'), '--release, --notes and --out are required')
  const noteDocument = JSON.parse(await readFile(values.get('--notes'), 'utf8'))
  const result = await generateUpdateBundle({ releasePath: values.get('--release'), verificationPath: values.get('--verification'),
    outputDirectory: values.get('--out'), releaseNotes: noteDocument.releaseNotes,
    releaseNotesEn: noteDocument.releaseNotesEn, publishedAt: values.get('--published-at') })
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
