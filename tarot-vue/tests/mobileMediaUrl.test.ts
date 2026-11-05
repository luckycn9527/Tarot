import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveMobileMediaUrl } from '../src/mobile/mobileMediaUrl'

const origin = 'https://121.40.27.226:9443'
test('mobile root media paths use the injected site origin', () => {
  assert.equal(resolveMobileMediaUrl('/uploads/admin/card.png?version=2#preview', origin), `${origin}/uploads/admin/card.png?version=2#preview`)
  assert.equal(resolveMobileMediaUrl('/uploads/avatar.webp', `${origin}/api`), `${origin}/uploads/avatar.webp`)
})
test('absolute OSS, site and external HTTP media URLs retain their exact original value', () => {
  for (const url of [
    'https://tarot-1.oss-cn-hangzhou.aliyuncs.com/uploads/admin/card.png',
    'https://tarot.zaopic.cn/uploads/avatar.webp?v=1',
    'http://media.fixture.invalid/image.webp?x=%2F',
    'HTTPS://MEDIA.fixture.invalid:443/photo.png',
  ]) assert.equal(resolveMobileMediaUrl(url, origin), url)
})
test('mobile media rejects unsupported schemes, protocol-relative hosts and invalid input', () => {
  for (const value of [null, undefined, '', 'relative/photo.png', '//evil.invalid/photo.png', '/\\evil.invalid/photo.png',
    'javascript:alert(1)', 'data:image/png;base64,AA==', 'file:///tmp/a.png', 'https://', 'https://a.invalid/\nphoto.png',
    ' https://media.invalid/a.png', 'https://user:pass@media.invalid/a.png',
  ]) assert.equal(resolveMobileMediaUrl(value, origin), '', String(value))
  assert.equal(resolveMobileMediaUrl('/uploads/avatar.png', 'capacitor://localhost'), '')
})
