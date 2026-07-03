import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
]);

function argValue(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function normalizeSlash(value) {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function joinKey(...parts) {
  return parts
    .map((p) => normalizeSlash(String(p ?? '')))
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/g, '/');
}

function encodeObjectKey(key) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function endpointInfo(rawEndpoint) {
  const withProtocol = /^https?:\/\//i.test(rawEndpoint) ? rawEndpoint : `https://${rawEndpoint}`;
  const url = new URL(withProtocol);
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
  };
}

function publicUrl(config, objectKey) {
  const base = String(config.publicBaseUrl || '').replace(/\/+$/, '');
  if (!base) {
    const ep = endpointInfo(config.endpoint);
    return `${ep.protocol}//${config.bucket}.${ep.hostname}/${encodeObjectKey(objectKey)}`;
  }
  return `${base}/${encodeObjectKey(objectKey)}`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(entry, config) {
  const abs = path.resolve(REPO_ROOT, entry.from);
  if (!(await pathExists(abs))) {
    console.warn(`skip missing path: ${entry.from}`);
    return [];
  }

  const exts = new Set((config.extensions || [...MIME_TYPES.keys()]).map((x) => String(x).toLowerCase()));
  const stat = await fs.stat(abs);
  const out = [];

  if (stat.isFile()) {
    const ext = path.extname(abs).toLowerCase();
    if (!exts.has(ext)) return out;
    const objectKey = entry.to && path.extname(entry.to)
      ? joinKey(config.prefix, entry.to)
      : joinKey(config.prefix, entry.to, path.basename(abs));
    out.push({ abs, rel: normalizeSlash(path.relative(REPO_ROOT, abs)), objectKey });
    return out;
  }

  async function walk(dir) {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        await walk(itemPath);
        continue;
      }
      if (!item.isFile()) continue;
      const ext = path.extname(item.name).toLowerCase();
      if (!exts.has(ext)) continue;
      const relToEntry = normalizeSlash(path.relative(abs, itemPath));
      const objectKey = joinKey(config.prefix, entry.to, relToEntry);
      out.push({
        abs: itemPath,
        rel: normalizeSlash(path.relative(REPO_ROOT, itemPath)),
        objectKey,
      });
    }
  }

  await walk(abs);
  return out;
}

function aliyunSignature({ config, method, contentType, date, objectKey, ossHeaders }) {
  const canonicalizedOssHeaders = Object.entries(ossHeaders)
    .map(([k, v]) => [k.toLowerCase(), String(v).trim()])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}\n`)
    .join('');
  const canonicalizedResource = `/${config.bucket}/${objectKey}`;
  const stringToSign = [
    method,
    '',
    contentType,
    date,
    `${canonicalizedOssHeaders}${canonicalizedResource}`,
  ].join('\n');
  return crypto.createHmac('sha1', config.accessKeySecret).update(stringToSign).digest('base64');
}

async function uploadFile(file, config) {
  const ep = endpointInfo(config.endpoint);
  const method = 'PUT';
  const ext = path.extname(file.abs).toLowerCase();
  const contentType = MIME_TYPES.get(ext) || 'application/octet-stream';
  const stat = await fs.stat(file.abs);
  const date = new Date().toUTCString();
  const ossHeaders = {};
  if (config.securityToken) ossHeaders['x-oss-security-token'] = config.securityToken;
  if (config.acl) ossHeaders['x-oss-object-acl'] = config.acl;

  const signature = aliyunSignature({
    config,
    method,
    contentType,
    date,
    objectKey: file.objectKey,
    ossHeaders,
  });

  const headers = {
    Date: date,
    Authorization: `OSS ${config.accessKeyId}:${signature}`,
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': config.cacheControl || 'public, max-age=31536000, immutable',
    ...ossHeaders,
  };

  const client = ep.protocol === 'http:' ? http : https;
  const requestOptions = {
    method,
    hostname: `${config.bucket}.${ep.hostname}`,
    port: ep.port || undefined,
    path: `/${encodeObjectKey(file.objectKey)}`,
    headers,
  };

  await new Promise((resolve, reject) => {
    const req = client.request(requestOptions, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`OSS ${res.statusCode}: ${body || res.statusMessage}`));
      });
    });
    req.on('error', reject);
    createReadStream(file.abs).pipe(req);
  });
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
  const configPath = path.resolve(REPO_ROOT, argValue('--config', 'oss-upload.config.local.json'));
  const config = await readJson(configPath);
  if (config.provider !== 'aliyun-oss') throw new Error('Only provider "aliyun-oss" is supported now.');
  for (const key of ['bucket', 'endpoint', 'accessKeyId', 'accessKeySecret']) {
    if (!config[key]) throw new Error(`Missing required config field: ${key}`);
  }

  const uploadEntries = Array.isArray(config.upload) ? config.upload : [];
  const files = (await Promise.all(uploadEntries.map((entry) => collectFiles(entry, config)))).flat();
  const unique = new Map();
  for (const file of files) {
    unique.set(`${file.rel}::${file.objectKey}`, file);
  }
  const uploadFiles = [...unique.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey));

  console.log(`${config.dryRun ? 'DRY RUN: ' : ''}found ${uploadFiles.length} image file(s).`);
  for (const file of uploadFiles) {
    console.log(`${file.rel} -> ${file.objectKey}`);
  }

  const manifest = [];
  if (!config.dryRun) {
    let done = 0;
    await runPool(uploadFiles, Number(config.concurrency || 4), async (file) => {
      await uploadFile(file, config);
      done += 1;
      console.log(`[${done}/${uploadFiles.length}] uploaded ${file.objectKey}`);
    });
  }

  for (const file of uploadFiles) {
    manifest.push({
      localPath: file.rel,
      objectKey: file.objectKey,
      url: publicUrl(config, file.objectKey),
    });
  }

  const manifestPath = path.resolve(REPO_ROOT, config.manifest || 'oss-upload-manifest.json');
  await fs.writeFile(manifestPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    dryRun: Boolean(config.dryRun),
    bucket: config.bucket,
    endpoint: config.endpoint,
    publicBaseUrl: config.publicBaseUrl || '',
    files: manifest,
  }, null, 2)}\n`);
  console.log(`manifest written: ${path.relative(REPO_ROOT, manifestPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
