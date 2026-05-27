import { ref } from 'vue'
import { tarotCards } from '../data/tarotCards'

export interface ShuffledCard {
  card: typeof tarotCards[0]
  isReversed: boolean
}

function fisherYatesShuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function useShuffle() {
  const deck = ref<ShuffledCard[]>([])

  function shuffle() {
    const pool: ShuffledCard[] = tarotCards.map(card => ({
      card,
      isReversed: Math.random() < 0.5,
    }))
    deck.value = fisherYatesShuffle(pool)
  }

  function drawRandom(): ShuffledCard {
    const idx = Math.floor(Math.random() * tarotCards.length)
    return {
      card: tarotCards[idx],
      isReversed: Math.random() < 0.5,
    }
  }

  return { deck, shuffle, drawRandom }
}
