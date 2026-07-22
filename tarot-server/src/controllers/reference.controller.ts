import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import { CDN_BASE, tarotCards } from '../data/tarotCards.js';
import { tarotCardDetails } from '../data/tarotCardDetails.js';
import { spreads, readerSpreads } from '../data/spreadsData.js';
import { success } from '../utils/response.js';
import * as AdminModel from '../models/admin.model.js';
import { mergeReadersBundle } from '../utils/mergeReadersBundle.js';
import { getUploadsRoot } from '../config/uploadsRoot.js';

type ReaderBundle = ReturnType<typeof mergeReadersBundle>;

interface ReferenceCore {
  cdnBase: string;
  cards: Array<{
    id: number;
    name: string;
    nameEn: string;
    uprightKeywords: string;
    reversedKeywords: string;
    yesNoTendency: 'yes' | 'no' | 'neutral';
    imageUrl?: string | null;
  }>;
  readers: ReaderBundle;
  featuredReaders: ReaderBundle;
  spreads: typeof spreads;
  readerSpreads: typeof readerSpreads;
  cardBacks: Array<{
    code: string;
    name: string;
    description: string | null;
    assetUrl: string | null;
    accessType: 'free' | 'vip' | 'paid';
    price: number | null;
  }>;
}

const CORE_CACHE_TTL_MS = 60_000;
let coreCache: { expiresAt: number; data: ReferenceCore } | null = null;
let coreInflight: Promise<ReferenceCore> | null = null;

export function invalidateReferenceCore(): void {
  coreCache = null;
}

function preferWebpUploadAsset(assetUrl: string | null): string | null {
  if (!assetUrl || !assetUrl.startsWith('/uploads/') || !/\.(png|jpe?g)$/i.test(assetUrl)) {
    return assetUrl;
  }
  const webpUrl = assetUrl.replace(/\.(png|jpe?g)$/i, '.webp');
  const webpPath = path.join(getUploadsRoot(), webpUrl.slice('/uploads/'.length));
  return fs.existsSync(webpPath) ? webpUrl : assetUrl;
}

async function buildReferenceCore(): Promise<ReferenceCore> {
  const [dbCards, dbPrompts, dbFeatured, dbBacks] = await Promise.all([
    AdminModel.listTarotCardsConfig(),
    AdminModel.listReaderPromptsConfig(),
    AdminModel.listFeaturedReadersConfig(),
    AdminModel.listCardBacks(),
  ]);

  const mergedCards = dbCards.length > 0
    ? dbCards.filter(c => c.is_active).map(c => ({
        id: c.id,
        name: c.name,
        nameEn: c.name_en,
        uprightKeywords: c.upright_keywords,
        reversedKeywords: c.reversed_keywords,
        yesNoTendency: c.yes_no_tendency,
        imageUrl: c.image_url || null,
      }))
    : tarotCards;

  const mergedReaders = mergeReadersBundle(dbPrompts);
  const readerByCode = new Map(mergedReaders.map((r) => [r.id, r]));
  const featuredReaders = dbFeatured
    .filter((f) => f.is_active === 1 && readerByCode.has(f.reader_code))
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.reader_code.localeCompare(b.reader_code);
    })
    .map((f) => readerByCode.get(f.reader_code)!);

  const cardBacks = dbBacks.filter(b => b.is_active).map(b => ({
    code: b.code,
    name: b.name,
    description: b.description,
    assetUrl: preferWebpUploadAsset(b.asset_url),
    accessType: b.access_type,
    price: b.price,
  }));

  return {
    cdnBase: CDN_BASE,
    cards: mergedCards,
    readers: mergedReaders,
    featuredReaders,
    spreads,
    readerSpreads,
    cardBacks,
  };
}

async function getCachedReferenceCore(): Promise<ReferenceCore> {
  const now = Date.now();
  if (coreCache && coreCache.expiresAt > now) return coreCache.data;
  if (!coreInflight) {
    coreInflight = buildReferenceCore()
      .then((data) => {
        coreCache = { data, expiresAt: Date.now() + CORE_CACHE_TTL_MS };
        return data;
      })
      .finally(() => {
        coreInflight = null;
      });
  }
  return coreInflight;
}

export async function getReferenceCore(_req: Request, res: Response) {
  const data = await getCachedReferenceCore();
  res.set('Cache-Control', 'public, max-age=30, must-revalidate');
  res.json(success(data));
}

export async function getTarotCardDetails(_req: Request, res: Response) {
  res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.json(success({ cardDetails: tarotCardDetails }));
}

export async function getReferenceBundle(_req: Request, res: Response) {
  const core = await getCachedReferenceCore();
  res.set('Cache-Control', 'public, max-age=30, must-revalidate');
  res.json(success({
    ...core,
    cardDetails: tarotCardDetails,
  }));
}
