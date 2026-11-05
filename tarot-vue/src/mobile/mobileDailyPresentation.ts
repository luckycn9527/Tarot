export interface DailyRatingPresentation {
  stars: string | null
  text: string
  ariaLabel: string
}

// The API and saved results keep their original 1–5 rating scale.
export function dailyRatingPresentation(value: unknown, english: boolean): DailyRatingPresentation {
  const rating = typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : null
  const stars = rating === null ? null : '★'.repeat(rating) + '☆'.repeat(5 - rating)
  const unavailable = english ? 'Not rated' : '暂无星级'
  return {
    stars,
    text: stars ?? unavailable,
    ariaLabel: rating === null
      ? unavailable
      : (english ? `${rating} of 5 stars` : `${rating} 星，共 5 星`),
  }
}
