import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'resources/app-icon-star-gate.png')
const directory = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset')
const destination = path.join(directory, 'AppIcon-512@2x.png')
const hash = value => createHash('sha256').update(value).digest('hex')

async function main() {
  const args = process.argv.slice(2)
  if (args.some(value => value !== '--check')) throw new Error('Usage: node scripts/mobile-ios-icon.mjs [--check]')
  const check = args.includes('--check')
  const assetRequire = createRequire(path.join(root, 'node_modules/@capacitor/assets/package.json'))
  const sharp = assetRequire('sharp')
  const master = await readFile(source)
  const masterHash = hash(master)
  const metadata = await sharp(master).metadata()
  if (metadata.format !== 'png' || !metadata.width || metadata.width !== metadata.height) {
    throw new Error('The approved iOS icon master must be a non-empty square PNG')
  }
  const catalog = JSON.parse(await readFile(path.join(directory, 'Contents.json'), 'utf8'))
  if (!catalog.images.some(image => image.filename === path.basename(destination) && image.size === '1024x1024' && image.platform === 'ios' && image.idiom === 'universal')) {
    throw new Error('The iOS asset catalog must reference the universal 1024x1024 icon')
  }
  // Export the approved symbol without cropping, redrawing or adding an icon mask.
  // Apple applies its own mask; the PNG must have no alpha channel.
  const exported = await sharp(master).resize(1024, 1024)
    .flatten({ background: '#09070f' }).removeAlpha().png().toBuffer()
  if (!check) await writeFile(destination, exported)
  const output = await readFile(destination)
  const outputMetadata = await sharp(output).metadata()
  if (outputMetadata.format !== 'png' || outputMetadata.width !== 1024 || outputMetadata.height !== 1024 || outputMetadata.hasAlpha || hash(output) !== hash(exported)) {
    throw new Error('The iOS AppIcon must match the approved export and be an opaque 1024x1024 PNG')
  }
  if (hash(await readFile(source)) !== masterHash) throw new Error('The approved master changed during export')
  console.log(JSON.stringify({
    iosAppIcon: check ? 'verified' : 'generated',
    master: path.relative(root, source).replaceAll('\\', '/'),
    masterSha256: masterHash, masterWidth: metadata.width, masterHeight: metadata.height,
    output: path.relative(root, destination).replaceAll('\\', '/'),
    width: outputMetadata.width, height: outputMetadata.height, hasAlpha: outputMetadata.hasAlpha,
    sha256: hash(output), bytes: output.length, masterUnchanged: true,
  }, null, 2))
}

try { await main() } catch (error) { console.error(`iOS icon export stopped: ${error.message}`); process.exitCode = 1 }
