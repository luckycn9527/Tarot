import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const requireFromServer = createRequire(path.join(REPO_ROOT, 'tarot-server', 'package.json'));
const sharp = requireFromServer('sharp');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const DEFAULT_ROOTS = [
  'tarot-vue/public/images',
  'tarot-vue/src/assets',
  'tarot-server/uploads',
];

function argValue(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalizeSlash(value) {
  return value.replace(/\\/g, '/');
}

function relPath(abs) {
  return normalizeSlash(path.relative(REPO_ROOT, abs));
}

function isImage(name) {
  return IMAGE_EXTS.has(path.extname(name).toLowerCase());
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(root) {
  const absRoot = path.resolve(REPO_ROOT, root);
  if (!(await pathExists(absRoot))) return [];
  const out = [];
  async function walk(dir) {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        await walk(itemPath);
      } else if (item.isFile() && isImage(item.name)) {
        out.push(itemPath);
      }
    }
  }
  await walk(absRoot);
  return out;
}

function imagePolicy(filePath) {
  const rel = relPath(filePath);
  const lower = rel.toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();

  if (base.includes('-thumb.')) return { skip: true, reason: 'thumbnail' };
  if (lower.includes('/uploads/cards/')) return { skip: true, reason: 'tarot-card-under-threshold-policy' };

  if (lower.includes('/uploads/avatars/') || lower.includes('/uploads/admin/reader-avatar-')) {
    return { ext, maxDimension: 640, quality: 82, effort: 9, palette: true };
  }
  if (lower.includes('/card-backs/') || lower.includes('/assets/back/')) {
    return { ext, maxDimension: 1280, quality: 86, effort: 9, palette: false };
  }
  if (lower.includes('/images/yes-no/')) {
    return { ext, maxDimension: 1440, quality: 86, effort: 9, palette: false };
  }
  if (lower.includes('/assets/logo/')) {
    return { ext, maxDimension: 512, quality: 86, effort: 9, palette: true };
  }
  return { ext, maxDimension: 1280, quality: 84, effort: 8, palette: false };
}

function outputFor(input, metadata, policy) {
  let pipeline = sharp(input, { limitInputPixels: 32_000_000, animated: false }).rotate();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const maxSide = Math.max(width, height);
  if (maxSide > policy.maxDimension) {
    pipeline = pipeline.resize({
      width: policy.maxDimension,
      height: policy.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (policy.ext === '.png') {
    return pipeline.png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      effort: policy.effort,
      palette: policy.palette,
      quality: policy.quality,
    });
  }
  if (policy.ext === '.webp') {
    return pipeline.webp({ quality: policy.quality, effort: policy.effort });
  }
  return pipeline.jpeg({ quality: policy.quality, mozjpeg: true });
}

function percentSaved(before, after) {
  if (!before) return 0;
  return Math.round((1 - after / before) * 1000) / 10;
}

async function optimizeFile(filePath, options) {
  const beforeStat = await fs.stat(filePath);
  if (beforeStat.size < options.minBytes) {
    return null;
  }

  const policy = imagePolicy(filePath);
  if (policy.skip) {
    return {
      localPath: relPath(filePath),
      beforeBytes: beforeStat.size,
      afterBytes: beforeStat.size,
      savedBytes: 0,
      savedPercent: 0,
      changed: false,
      skipped: policy.reason,
    };
  }

  let metadata;
  try {
    metadata = await sharp(filePath, { limitInputPixels: 32_000_000, animated: false }).metadata();
  } catch (err) {
    return {
      localPath: relPath(filePath),
      beforeBytes: beforeStat.size,
      afterBytes: beforeStat.size,
      savedBytes: 0,
      savedPercent: 0,
      changed: false,
      skipped: err instanceof Error ? err.message : String(err),
    };
  }

  const tmp = `${filePath}.opt-${process.pid}-${Date.now()}`;
  await outputFor(filePath, metadata, policy).toFile(tmp);
  const afterStat = await fs.stat(tmp);
  const minGain = beforeStat.size * options.minGain;
  const changed = afterStat.size + minGain < beforeStat.size;

  if (!options.dryRun && changed) {
    await fs.copyFile(tmp, filePath);
  }
  await fs.rm(tmp, { force: true });

  return {
    localPath: relPath(filePath),
    width: metadata.width || null,
    height: metadata.height || null,
    maxDimension: policy.maxDimension,
    beforeBytes: beforeStat.size,
    afterBytes: changed ? afterStat.size : beforeStat.size,
    savedBytes: changed ? beforeStat.size - afterStat.size : 0,
    savedPercent: changed ? percentSaved(beforeStat.size, afterStat.size) : 0,
    changed,
    skipped: changed ? undefined : 'gain-too-small',
  };
}

async function runPool(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const dryRun = hasFlag('--dry-run');
  const minKb = Number(argValue('--min-kb', '250'));
  const minGainPercent = Number(argValue('--min-gain-percent', '5'));
  const concurrency = Number(argValue('--concurrency', '3'));
  const manifestName = argValue('--manifest', dryRun ? 'image-optimization-manifest.dry-run.json' : 'image-optimization-manifest.json');
  const rootsArg = argValue('--roots', '');
  const roots = rootsArg ? rootsArg.split(',').map((x) => x.trim()).filter(Boolean) : DEFAULT_ROOTS;

  const files = (await Promise.all(roots.map(collectFiles))).flat().sort((a, b) => a.localeCompare(b));
  const options = {
    dryRun,
    minBytes: Math.max(1, minKb) * 1024,
    minGain: Math.max(0, minGainPercent) / 100,
  };

  const results = [];
  let done = 0;
  await runPool(files, concurrency, async (file) => {
    const result = await optimizeFile(file, options);
    if (result) {
      results.push(result);
      if (result.changed) {
        console.log(`${dryRun ? 'would optimize' : 'optimized'} ${result.localPath}: ${Math.round(result.beforeBytes / 1024)}KB -> ${Math.round(result.afterBytes / 1024)}KB (${result.savedPercent}%)`);
      }
    }
    done += 1;
    if (done % 25 === 0) console.log(`scanned ${done}/${files.length}`);
  });

  results.sort((a, b) => b.savedBytes - a.savedBytes || a.localPath.localeCompare(b.localPath));
  const changed = results.filter((r) => r.changed);
  const beforeBytes = changed.reduce((sum, r) => sum + r.beforeBytes, 0);
  const afterBytes = changed.reduce((sum, r) => sum + r.afterBytes, 0);
  const manifest = {
    generatedAt: new Date().toISOString(),
    dryRun,
    roots,
    minKb,
    minGainPercent,
    scannedFiles: files.length,
    candidateFiles: results.length,
    changedFiles: changed.length,
    beforeBytes,
    afterBytes,
    savedBytes: beforeBytes - afterBytes,
    savedPercent: percentSaved(beforeBytes, afterBytes),
    files: results,
  };
  const manifestPath = path.resolve(REPO_ROOT, manifestName);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest written: ${relPath(manifestPath)}`);
  console.log(`changed ${changed.length} file(s), saved ${Math.round((beforeBytes - afterBytes) / 1024)}KB (${manifest.savedPercent}%)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
