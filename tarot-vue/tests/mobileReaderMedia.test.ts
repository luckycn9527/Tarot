import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, ref } from 'vue'
import { mobileReaderAvatarCandidates, useMobileReaderAvatarMedia, type MobileReaderMediaSource } from '../src/mobile/mobileReaderMedia'

const origin = 'https://121.40.27.226:9443'
const thumb = 'https://tarot-1.oss-cn-hangzhou.aliyuncs.com/uploads/admin/reader-avatar-1783587503177-bsp85j-thumb.webp'
const full = 'https://tarot-1.oss-cn-hangzhou.aliyuncs.com/uploads/admin/reader-avatar-1783587503177-bsp85j.webp'
const bundle = '/assets/qinghe-thumb-local.webp'
const qinghe: MobileReaderMediaSource = { id: 'qinghe', avatarThumbUrl: thumb, avatarUrl: full }
const fallback = (id: string) => ['qinghe', 'yanxi'].includes(id) ? `/assets/${id}-thumb-local.webp` : undefined

function withModel(initial: MobileReaderMediaSource | undefined, run: (reader: ReturnType<typeof ref<MobileReaderMediaSource | undefined>>, model: ReturnType<typeof useMobileReaderAvatarMedia>) => void) {
  const scope = effectScope()
  const reader = ref<MobileReaderMediaSource | undefined>(initial)
  try {
    const model = scope.run(() => useMobileReaderAvatarMedia(reader, origin, fallback))!
    run(reader, model)
  } finally { scope.stop() }
}

test('web thumb and full precede the exact local web fallback, with absolute OSS URLs preserved', () => {
  assert.deepEqual(mobileReaderAvatarCandidates(qinghe, origin, bundle), [thumb, full, bundle])
})

test('relative upload URLs use the website origin and snapshot checks compare the exact path', () => {
  const relative = '/uploads/admin/reader-avatar-1782721169316-yy9g29-thumb.webp'
  const relativeFull = '/uploads/admin/reader-avatar-1782721169316-yy9g29.png'
  assert.deepEqual(mobileReaderAvatarCandidates({ id: 'amara', avatarThumbUrl: relative, avatarUrl: relativeFull }, origin, '/assets/amara.webp'), [
    `${origin}${relative}`, `${origin}${relativeFull}`, '/assets/amara.webp',
  ])
})

test('missing URL configuration uses only the known reader ID and never a display name', () => {
  assert.deepEqual(mobileReaderAvatarCandidates({ id: 'qinghe' }, origin, bundle), [bundle])
  assert.deepEqual(mobileReaderAvatarCandidates({ id: 'yanxi', avatarThumbUrl: null, avatarUrl: '' }, origin, '/assets/yanxi.webp'), ['/assets/yanxi.webp'])
  assert.deepEqual(mobileReaderAvatarCandidates({ id: 'removed-reader', name: '清和' } as MobileReaderMediaSource, origin, bundle), [])
  assert.deepEqual(mobileReaderAvatarCandidates({ id: 'toString' }, origin, bundle), [])
  assert.deepEqual(mobileReaderAvatarCandidates(undefined, origin, bundle), [])
})

test('reader identity prevents a different known portrait from being used as an offline fallback', () => {
  assert.deepEqual(mobileReaderAvatarCandidates({ ...qinghe, id: 'yanxi' }, origin, '/assets/yanxi.webp'), [thumb, full])
  assert.deepEqual(mobileReaderAvatarCandidates({ ...qinghe, id: 'unknown' }, origin, bundle), [thumb, full])
})

test('an admin avatar change suppresses the obsolete snapshot after all current URLs fail', () => {
  const newThumb = 'https://new-media.example/uploads/admin/new-thumb.webp'
  const newFull = 'https://new-media.example/uploads/admin/new.webp'
  assert.deepEqual(mobileReaderAvatarCandidates({ id: 'qinghe', avatarThumbUrl: newThumb, avatarUrl: newFull }, origin, bundle), [newThumb, newFull])
  assert.deepEqual(mobileReaderAvatarCandidates({ id: 'qinghe', avatarThumbUrl: thumb, avatarUrl: newFull }, origin, bundle), [thumb, newFull])
})

test('invalid or unsupported media never becomes an image source or authorizes a stale local portrait', () => {
  for (const invalid of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'file:///tmp/a.png', '//foreign.example/a.webp', 'relative.png', ' https://a.example/image.webp', 'https://']) {
    assert.deepEqual(mobileReaderAvatarCandidates({ id: 'qinghe', avatarThumbUrl: invalid, avatarUrl: full }, origin, bundle), [full], invalid)
  }
})

test('identical URLs are requested once without changing thumb-first ordering', () => {
  assert.deepEqual(mobileReaderAvatarCandidates({ id: 'qinghe', avatarThumbUrl: thumb, avatarUrl: thumb }, origin, bundle), [thumb, bundle])
})

test('current image failures advance thumb to full to bundle to the generic placeholder', () => {
  withModel(qinghe, (_reader, model) => {
    assert.equal(model.image.value, thumb)
    model.handleFailure(thumb)
    assert.equal(model.image.value, full)
    model.handleFailure(full)
    assert.equal(model.image.value, bundle)
    model.handleFailure(bundle)
    assert.equal(model.image.value, '')
  })
})

test('late failures from a previous image cannot skip the current candidate', () => {
  withModel(qinghe, (_reader, model) => {
    model.handleFailure(thumb)
    model.handleFailure(thumb)
    assert.equal(model.image.value, full)
    model.handleFailure('')
    assert.equal(model.image.value, full)
  })
})

test('the same reader receiving a new URL resets failures immediately and never reuses the old snapshot', () => {
  withModel(qinghe, (reader, model) => {
    model.handleFailure(thumb)
    model.handleFailure(full)
    assert.equal(model.image.value, bundle)
    const newThumb = 'https://media.example/new-qinghe-thumb.webp'
    reader.value = { id: 'qinghe', avatarThumbUrl: newThumb }
    assert.equal(model.image.value, newThumb)
    model.handleFailure(full)
    assert.equal(model.image.value, newThumb)
    model.handleFailure(newThumb)
    assert.equal(model.image.value, '')
  })
})

test('changing reader IDs or configuring an in-place avatar update resets exhausted image state', () => {
  withModel({ id: 'qinghe' }, (reader, model) => {
    model.handleFailure(bundle)
    assert.equal(model.image.value, '')
    reader.value = { id: 'yanxi' }
    assert.equal(model.image.value, '/assets/yanxi-thumb-local.webp')
    model.handleFailure(model.image.value)
    reader.value.avatarThumbUrl = 'https://media.example/yanxi-new.webp'
    assert.equal(model.image.value, 'https://media.example/yanxi-new.webp')
    reader.value = { id: 'removed-reader' }
    assert.equal(model.image.value, '')
  })
})
