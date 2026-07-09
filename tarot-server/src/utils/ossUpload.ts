import crypto from 'crypto';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import http from 'http';
import https from 'https';
import path from 'path';

const MIME_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
]);

interface OssUploadConfig {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  prefix: string;
  publicBaseUrl: string;
  acl: string;
  cacheControl: string;
}

interface EndpointInfo {
  protocol: string;
  hostname: string;
  port: string;
}

export interface OssUploadedFile {
  objectKey: string;
  url: string;
}

function envValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function ossConfig(): OssUploadConfig | null {
  const bucket = envValue('OSS_BUCKET', 'ALIYUN_OSS_BUCKET');
  const endpoint = envValue('OSS_ENDPOINT', 'ALIYUN_OSS_ENDPOINT');
  const accessKeyId = envValue('OSS_ACCESS_KEY_ID', 'ALIYUN_OSS_ACCESS_KEY_ID');
  const accessKeySecret = envValue('OSS_ACCESS_KEY_SECRET', 'ALIYUN_OSS_ACCESS_KEY_SECRET');
  if (!bucket || !endpoint || !accessKeyId || !accessKeySecret) return null;

  return {
    bucket,
    endpoint,
    accessKeyId,
    accessKeySecret,
    securityToken: envValue('OSS_SECURITY_TOKEN', 'ALIYUN_OSS_SECURITY_TOKEN'),
    prefix: normalizeSlash(envValue('OSS_PREFIX', 'ALIYUN_OSS_PREFIX')),
    publicBaseUrl: envValue('OSS_PUBLIC_BASE_URL', 'ALIYUN_OSS_PUBLIC_BASE_URL').replace(/\/+$/, ''),
    acl: envValue('OSS_ACL', 'ALIYUN_OSS_ACL'),
    cacheControl: envValue('OSS_CACHE_CONTROL') || 'public, max-age=31536000, immutable',
  };
}

function normalizeSlash(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function joinKey(...parts: string[]): string {
  return parts
    .map((p) => normalizeSlash(String(p ?? '')))
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/g, '/');
}

function encodeObjectKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

function endpointInfo(rawEndpoint: string): EndpointInfo {
  const withProtocol = /^https?:\/\//i.test(rawEndpoint) ? rawEndpoint : `https://${rawEndpoint}`;
  const url = new URL(withProtocol);
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
  };
}

function publicUrl(config: OssUploadConfig, objectKey: string): string {
  if (config.publicBaseUrl) return `${config.publicBaseUrl}/${encodeObjectKey(objectKey)}`;
  const ep = endpointInfo(config.endpoint);
  return `${ep.protocol}//${config.bucket}.${ep.hostname}/${encodeObjectKey(objectKey)}`;
}

function signature(input: {
  config: OssUploadConfig;
  method: string;
  contentType: string;
  date: string;
  objectKey: string;
  ossHeaders: Record<string, string>;
}): string {
  const canonicalizedOssHeaders = Object.entries(input.ossHeaders)
    .map(([k, v]) => [k.toLowerCase(), String(v).trim()] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}\n`)
    .join('');
  const canonicalizedResource = `/${input.config.bucket}/${input.objectKey}`;
  const stringToSign = [
    input.method,
    '',
    input.contentType,
    input.date,
    `${canonicalizedOssHeaders}${canonicalizedResource}`,
  ].join('\n');
  return crypto.createHmac('sha1', input.config.accessKeySecret).update(stringToSign).digest('base64');
}

function objectKeyFromPublicPath(publicPath: string, config: OssUploadConfig): string {
  return joinKey(config.prefix, publicPath.replace(/^\/+/, ''));
}

export function isOssUploadConfigured(): boolean {
  return ossConfig() != null;
}

export async function uploadLocalPublicFileToOss(
  absPath: string,
  publicPath: string,
): Promise<OssUploadedFile | null> {
  const config = ossConfig();
  if (!config) return null;

  const objectKey = objectKeyFromPublicPath(publicPath, config);
  const ep = endpointInfo(config.endpoint);
  const method = 'PUT';
  const ext = path.extname(absPath).toLowerCase();
  const contentType = MIME_TYPES.get(ext) || 'application/octet-stream';
  const stat = await fs.stat(absPath);
  const date = new Date().toUTCString();
  const ossHeaders: Record<string, string> = {};
  if (config.securityToken) ossHeaders['x-oss-security-token'] = config.securityToken;
  if (config.acl) ossHeaders['x-oss-object-acl'] = config.acl;

  const headers = {
    Date: date,
    Authorization: `OSS ${config.accessKeyId}:${signature({
      config,
      method,
      contentType,
      date,
      objectKey,
      ossHeaders,
    })}`,
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': config.cacheControl,
    ...ossHeaders,
  };

  const client = ep.protocol === 'http:' ? http : https;
  const requestOptions = {
    method,
    hostname: `${config.bucket}.${ep.hostname}`,
    port: ep.port || undefined,
    path: `/${encodeObjectKey(objectKey)}`,
    headers,
  };

  await new Promise<void>((resolve, reject) => {
    const req = client.request(requestOptions, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
          return;
        }
        reject(new Error(`OSS ${res.statusCode}: ${body || res.statusMessage || 'upload failed'}`));
      });
    });
    req.on('error', reject);
    createReadStream(absPath).pipe(req);
  });

  return {
    objectKey,
    url: publicUrl(config, objectKey),
  };
}
