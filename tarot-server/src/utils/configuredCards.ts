import { tarotCards } from '../data/tarotCards.js';

interface CardOverride {
  id: number; name: string; name_en: string; upright_keywords: string; reversed_keywords: string;
  yes_no_tendency: 'yes' | 'no' | 'neutral'; image_url: string | null; is_active: number;
}

/** Missing overrides retain built-in cards; one custom card must not hide 77 others. */
export function configuredCards(rows: CardOverride[]) {
  const overrides = new Map(rows.map(row => [Number(row.id), row]));
  return tarotCards.map(card => {
    const custom = overrides.get(card.id);
    return custom ? { id: card.id, name: custom.name, nameEn: custom.name_en, uprightKeywords: custom.upright_keywords,
      reversedKeywords: custom.reversed_keywords, yesNoTendency: custom.yes_no_tendency, imageUrl: custom.image_url, isActive: !!custom.is_active }
      : { ...card, imageUrl: null, isActive: true };
  });
}
