import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const requireFromServer = createRequire(path.join(REPO_ROOT, 'tarot-server', 'package.json'));
const sharp = requireFromServer('sharp');

function relPath(abs) {
  return path.relative(REPO_ROOT, abs).replace(/\\/g, '/');
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collect(dir, predicate) {
  const out = [];
  async function walk(current) {
    if (!(await pathExists(current))) return;
    const items = await fs.readdir(current, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(current, item.name);
      if (item.isDirectory()) await walk(itemPath);
      else if (item.isFile() && predicate(itemPath)) out.push(itemPath);
    }
  }
  await walk(dir);
  return out;
}

async function writeWebpVariant(source, options) {
  const dest = source.replace(/\.[^.]+$/, '.webp');
  const before = await fs.stat(source);
  let pipeline = sharp(source, { limitInputPixels: 32_000_000, animated: false }).rotate();
  if (options.maxDimension) {
    pipeline = pipeline.resize({
      width: options.maxDimension,
      height: options.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  await pipeline.webp({ quality: options.quality, effort: 6 }).toFile(dest);
  const after = await fs.stat(dest);
  return {
    type: 'webp-variant',
    source: relPath(source),
    output: relPath(dest),
    sourceBytes: before.size,
    outputBytes: after.size,
  };
}

async function writeReaderThumb(source) {
  const dest = source.replace(/\.[^.]+$/, '-thumb.webp');
  const before = await fs.stat(source);
  await sharp(source, { limitInputPixels: 32_000_000, animated: false })
    .rotate()
    .resize(128, 128, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82, effort: 6 })
    .toFile(dest);
  const after = await fs.stat(dest);
  return {
    type: 'reader-thumb',
    source: relPath(source),
    output: relPath(dest),
    sourceBytes: before.size,
    outputBytes: after.size,
  };
}

async function main() {
  const yesNoDir = path.join(REPO_ROOT, 'tarot-vue', 'public', 'images', 'yes-no');
  const logoDir = path.join(REPO_ROOT, 'tarot-vue', 'src', 'assets', 'logo');
  const cardBackDir = path.join(REPO_ROOT, 'tarot-server', 'uploads', 'card-backs');
  const adminDir = path.join(REPO_ROOT, 'tarot-server', 'uploads', 'admin');

  const yesNoPngs = await collect(yesNoDir, (p) => p.toLowerCase().endsWith('.png'));
  const logos = await collect(logoDir, (p) => path.basename(p).toLowerCase() === 'logo.png');
  const cardBackPngs = await collect(cardBackDir, (p) => p.toLowerCase().endsWith('.png'));
  const adminCardBackPngs = await collect(adminDir, (p) => /^card-back-.*\.png$/i.test(path.basename(p)));
  const readerAvatarSources = await collect(adminDir, (p) => {
    const base = path.basename(p).toLowerCase();
    return /^reader-avatar-.*\.(png|jpg|jpeg|webp)$/.test(base) && !base.includes('-thumb.');
  });

  const results = [];
  for (const file of yesNoPngs) {
    results.push(await writeWebpVariant(file, { maxDimension: 1440, quality: 84 }));
  }
  for (const file of logos) {
    results.push(await writeWebpVariant(file, { maxDimension: 512, quality: 90 }));
  }
  for (const file of [...cardBackPngs, ...adminCardBackPngs]) {
    results.push(await writeWebpVariant(file, { maxDimension: 1280, quality: 86 }));
  }
  for (const file of readerAvatarSources) {
    results.push(await writeReaderThumb(file));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    files: results.sort((a, b) => a.output.localeCompare(b.output)),
  };
  const manifestPath = path.join(REPO_ROOT, 'image-derivatives-manifest.json');
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  for (const item of manifest.files) {
    console.log(`${item.type} ${item.output}: ${Math.round(item.sourceBytes / 1024)}KB -> ${Math.round(item.outputBytes / 1024)}KB`);
  }
  console.log(`manifest written: ${relPath(manifestPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
