import type { Request, Response } from 'express';
import { CDN_BASE, tarotCards } from '../data/tarotCards.js';
import { tarotCardDetails } from '../data/tarotCardDetails.js';
import { spreads, readerSpreads } from '../data/spreadsData.js';
import { success } from '../utils/response.js';
import * as AdminModel from '../models/admin.model.js';
import { mergeReadersBundle } from '../utils/mergeReadersBundle.js';

/** 前端启动时拉取：牌面、详情、塔罗师 UI、牌阵元数据（不含大模型 prompt） */
export async function getReferenceBundle(_req: Request, res: Response) {
  const dbCards = await AdminModel.listTarotCardsConfig();

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

  const dbPrompts = await AdminModel.listReaderPromptsConfig();
  const mergedReaders = mergeReadersBundle(dbPrompts);

  const dbBacks = await AdminModel.listCardBacks();
  const activeBacks = dbBacks.filter(b => b.is_active).map(b => ({
    code: b.code,
    name: b.name,
    description: b.description,
    assetUrl: b.asset_url,
    accessType: b.access_type,
    price: b.price,
  }));

  res.set('Cache-Control', 'no-cache');
  res.json(success({
    cdnBase: CDN_BASE,
    cards: mergedCards,
    cardDetails: tarotCardDetails,
    readers: mergedReaders,
    spreads,
    readerSpreads,
    cardBacks: activeBacks,
  }));
}
