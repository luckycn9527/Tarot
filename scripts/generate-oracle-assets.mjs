import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(root, 'tarot-vue', 'public', 'images', 'oracle')

const cards = [
  ['01', 'Rider', '♞'], ['02', 'Clover', '♧'], ['03', 'Ship', '⚓'], ['04', 'House', '⌂'], ['05', 'Tree', '♣'], ['06', 'Clouds', '☁'],
  ['07', 'Snake', '∿'], ['08', 'Coffin', '▣'], ['09', 'Bouquet', '❈'], ['10', 'Scythe', '⌁'], ['11', 'Whip', '╱╲'], ['12', 'Birds', '⌁'],
  ['13', 'Child', '✧'], ['14', 'Fox', '◇'], ['15', 'Bear', '◈'], ['16', 'Stars', '✦'], ['17', 'Stork', '↗'], ['18', 'Dog', '●'],
  ['19', 'Tower', '▥'], ['20', 'Garden', '❋'], ['21', 'Mountain', '△'], ['22', 'Crossroads', '╳'], ['23', 'Mice', '⌇'], ['24', 'Heart', '♡'],
  ['25', 'Ring', '○'], ['26', 'Book', '▤'], ['27', 'Letter', '▱'], ['28', 'Man', '♂'], ['29', 'Woman', '♀'], ['30', 'Lily', '♢'],
  ['31', 'Sun', '☼'], ['32', 'Moon', '☾'], ['33', 'Key', '⚿'], ['34', 'Fish', '≈'], ['35', 'Anchor', '⚓'], ['36', 'Cross', '✚'],
]

function escapeXml(value) {
  return value.replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]))
}

function renderCard([number, name, symbol]) {
  const hue = 248 + (Number(number) * 7) % 54
  const accent = `hsl(${hue} 64% 72%)`
  const accentSoft = `hsl(${hue} 55% 45% / .38)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(name)} oracle card</title>
  <desc id="desc">Original decorative card artwork for the ${escapeXml(name)} Lenormand reference card.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#21153a"/><stop offset=".56" stop-color="#111020"/><stop offset="1" stop-color="#0a0912"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="24%" r="70%"><stop stop-color="${accentSoft}"/><stop offset="1" stop-color="#090812" stop-opacity="0"/></radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="22"/></filter>
  </defs>
  <rect width="600" height="800" rx="28" fill="url(#bg)"/>
  <rect width="600" height="800" rx="28" fill="url(#glow)"/>
  <circle cx="110" cy="120" r="80" fill="${accentSoft}" filter="url(#blur)" opacity=".75"/>
  <circle cx="500" cy="700" r="110" fill="#8b5cf6" opacity=".08" filter="url(#blur)"/>
  <rect x="28" y="28" width="544" height="744" rx="20" fill="none" stroke="${accent}" stroke-opacity=".52" stroke-width="2"/>
  <path d="M90 220h420M90 580h420" stroke="${accent}" stroke-opacity=".18"/>
  <text x="68" y="88" fill="#f5efe7" fill-opacity=".78" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="4">${number}</text>
  <text x="300" y="430" text-anchor="middle" fill="${accent}" fill-opacity=".92" font-family="Georgia, serif" font-size="190">${escapeXml(symbol)}</text>
  <text x="300" y="690" text-anchor="middle" fill="#f5efe7" fill-opacity=".84" font-family="Georgia, serif" font-size="28" letter-spacing="3">${escapeXml(name.toUpperCase())}</text>
  <text x="300" y="730" text-anchor="middle" fill="${accent}" fill-opacity=".68" font-family="Arial, sans-serif" font-size="13" letter-spacing="5">LENORMAND ORACLE</text>
</svg>`
}

await fs.mkdir(outputDir, { recursive: true })
await Promise.all(cards.map(async (card) => {
  const filePath = path.join(outputDir, `lenormand-${card[0]}.svg`)
  await fs.writeFile(filePath, renderCard(card), 'utf8')
}))
console.log(`Generated ${cards.length} oracle card assets in ${path.relative(root, outputDir)}`)
