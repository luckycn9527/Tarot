import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspace = path.dirname(root)
const source = path.join(root, 'resources/app-icon-star-gate.png')
const inputs = path.join(workspace, '.cache/app-icon-20261029/launcher-inputs')
const reportDirectory = path.join(workspace, 'output/app-icon-20261029')
const resources = path.join(root, 'android/app/src/main/res')
const assetRequire = createRequire(path.join(root, 'node_modules/@capacitor/assets/package.json'))
const sharp = assetRequire('sharp')
const hash = value => createHash('sha256').update(value).digest('hex')
async function files(directory) {
  const found = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...await files(target))
    else if (entry.isFile()) found.push(target)
  }
  return found
}
const launcher = file => path.basename(path.dirname(file)).startsWith('mipmap-') && /^ic_launcher(?:_round|_foreground|_background)?\.(?:png|xml)$/.test(path.basename(file))
const protectedFiles = [
  ...(await files(resources)).filter(file => !launcher(file)),
  ...await files(path.join(root, 'ios/App/App/Assets.xcassets')),
  path.join(root, 'src/assets/logo/logo.png'), path.join(root, 'src/assets/logo/logo.webp'),
]
const before = new Map(await Promise.all(protectedFiles.map(async file => [file, hash(await readFile(file))])))
await mkdir(inputs, { recursive: true })
await mkdir(reportDirectory, { recursive: true })
const allowedInputs = new Set(['icon-only.png', 'icon-foreground.png', 'icon-background.png'])
if ((await readdir(inputs)).some(file => !allowedInputs.has(file))) throw Error('Launcher input folder contains unexpected assets')
// Preserve the approved symbol exactly. Native size/mask exports are handled by Capacitor Assets.
await copyFile(source, path.join(inputs, 'icon-only.png'))
await copyFile(source, path.join(inputs, 'icon-foreground.png'))
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#09070f' } }).png().toFile(path.join(inputs, 'icon-background.png'))
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/@capacitor/assets/bin/capacitor-assets'),
  'generate', '--android', '--assetPath', path.relative(root, inputs), '--androidProject', 'android'], { cwd: root, stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) throw Error(`Android launcher generation failed: ${result.status}`)
const adaptiveSizes = { ldpi: 81, mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }
// Capacitor's explicit foreground branch uses legacy dimensions. Export the same pixels at
// Android's 108dp layer resolution, retaining the generator's single standard XML inset.
for (const [density, size] of Object.entries(adaptiveSizes)) {
  const directory = path.join(resources, `mipmap-${density}`)
  await mkdir(directory, { recursive: true })
  await sharp(source).resize(size, size).png().toFile(path.join(directory, 'ic_launcher_foreground.png'))
  await sharp({ create: { width: size, height: size, channels: 4, background: '#09070f' } }).png().toFile(path.join(directory, 'ic_launcher_background.png'))
}
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  const xml = await readFile(path.join(resources, 'mipmap-anydpi-v26', name), 'utf8')
  if (!xml.includes('inset') || !xml.includes('ic_launcher_foreground')) throw Error('Adaptive launcher XML was not generated correctly')
}
const changedProtectedFiles = []
for (const [file, digest] of before) if (hash(await readFile(file)) !== digest) changedProtectedFiles.push(path.relative(root, file).replaceAll('\\', '/'))
if (changedProtectedFiles.length) throw Error(`Launcher export changed unrelated assets: ${changedProtectedFiles.join(', ')}`)
const generated = (await files(resources)).filter(launcher).sort()
if (generated.length < 26) throw Error('Android launcher export omitted density variants')
const master = await readFile(source)
const metadata = await sharp(master).metadata()
const report = {
  selectedConcept: '01-star-gate', date: '2026-10-29', generator: '@capacitor/assets 3.0.5; Android only',
  master: path.relative(root, source).replaceAll('\\', '/'), masterSha256: hash(master),
  masterDimensions: { width: metadata.width, height: metadata.height },
  background: '#09070f', adaptiveSafety: 'Capacitor Assets foreground XML includes its standard 16.7% inset', adaptiveRasterSizes: adaptiveSizes,
  protectedFilesChecked: before.size, changedProtectedFiles,
  resources: await Promise.all(generated.map(async file => ({ file: path.relative(root, file).replaceAll('\\', '/'), sha256: hash(await readFile(file)) }))),
}
await writeFile(path.join(reportDirectory, 'icon-assets.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ selectedConcept: report.selectedConcept, generatedResources: report.resources.length, changedProtectedFiles }))
