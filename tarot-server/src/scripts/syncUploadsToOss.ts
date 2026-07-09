import fs from 'fs/promises';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { isOssUploadConfigured, uploadLocalPublicFileToOss } from '../utils/ossUpload.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverRoot = path.resolve(__dirname, '../..');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

const inputDir = argValue('--dir') || 'uploads';
const uploadsRoot = path.resolve(serverRoot, inputDir);

async function exists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(absDir: string): Promise<string[]> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absPath = path.join(absDir, entry.name);
    if (entry.isDirectory()) return listFiles(absPath);
    if (entry.isFile()) return [absPath];
    return [];
  }));
  return files.flat();
}

function toPublicPath(absPath: string): string {
  const rel = path.relative(serverRoot, absPath).replace(/\\/g, '/');
  return `/${rel.replace(/^\/+/, '')}`;
}

async function main(): Promise<void> {
  if (!(await exists(uploadsRoot))) {
    throw new Error(`Uploads directory not found: ${uploadsRoot}`);
  }

  if (!isOssUploadConfigured()) {
    throw new Error('OSS is not configured. Please set OSS_BUCKET, OSS_ENDPOINT, OSS_ACCESS_KEY_ID, and OSS_ACCESS_KEY_SECRET.');
  }

  const files = await listFiles(uploadsRoot);
  if (files.length === 0) {
    console.log(`No files found in ${uploadsRoot}`);
    return;
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}Syncing ${files.length} file(s) from ${uploadsRoot} to OSS...`);

  let synced = 0;
  let failed = 0;

  for (const absPath of files) {
    const publicPath = toPublicPath(absPath);
    try {
      if (dryRun) {
        console.log(`[dry-run] ${publicPath}`);
      } else {
        const uploaded = await uploadLocalPublicFileToOss(absPath, publicPath);
        console.log(`[ok] ${publicPath} -> ${uploaded?.url || '(local only)'}`);
      }
      synced += 1;
    } catch (e) {
      failed += 1;
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[fail] ${publicPath}: ${message}`);
    }
  }

  console.log(`Done. Synced: ${synced}, Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
