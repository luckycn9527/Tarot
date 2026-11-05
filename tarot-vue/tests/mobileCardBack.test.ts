import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { compileScript, parse } from '@vue/compiler-sfc'
import { createRenderer, defineComponent, h, nextTick, ref, type Component } from 'vue'

const root = fileURLToPath(new URL('../', import.meta.url))
const purpleBundle = '/bundled/daily-purple-card-back.png'
const pinkRemote = 'https://site.fixture.invalid/back/pocket.webp'
const require = createRequire(import.meta.url)
const compiled = await build({
  entryPoints: {
    cardBack: resolve(root, 'src/mobile/useMobileCardBack.ts'),
    home: resolve(root, 'src/mobile/components/MobileHomeDraw.vue'),
    flip: resolve(root, 'src/mobile/components/MobileFlipCard.vue'),
  },
  outdir: 'card-back-test', bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['vue'], metafile: true, define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'real-mobile-card-back-components', setup(builder) {
    builder.onResolve({ filter: /^@\// }, args => ({ path: resolve(root, 'src', args.path.slice(2)) }))
    // Any reintroduced account/network boundary is observable and cannot silently pass.
    builder.onResolve({ filter: /(?:^|\/)mobile(?:Api|Storage)$/ }, args => ({ path: args.path, namespace: 'card-back-boundary' }))
    builder.onLoad({ filter: /.*/, namespace: 'card-back-boundary' }, args => ({ contents:
      args.path.endsWith('mobileApi') ? 'export const mobileWebsiteOrigin="https://site.fixture.invalid"; export const fetchMobileSettings=()=>__backTest.fetch();' :
        'export const mobileSite="domestic"; export const readMobileValue=key=>__backTest.read(key); export const writeMobileValue=(key,value)=>__backTest.write(key,value);',
    }))
    builder.onLoad({ filter: /\.vue$/ }, args => {
      const { descriptor } = parse(readFileSync(args.path, 'utf8'), { filename: args.path })
      return { contents: compileScript(descriptor, { id: args.path, inlineTemplate: true }).content, loader: 'ts', resolveDir: dirname(args.path) }
    })
    builder.onResolve({ filter: /\.(png|webp)$/ }, args => ({ path: args.path.split('/').pop()!, namespace: 'card-back-asset' }))
    builder.onLoad({ filter: /.*/, namespace: 'card-back-asset' }, args => ({ contents: `export default ${JSON.stringify(`/bundled/${args.path}`)};` }))
  } }],
})
interface Boundary { fetch(): Promise<unknown>; read(key: string): Promise<unknown>; write(key: string, value: unknown): Promise<void> }
function load<T>(name: string, boundary: Boundary): T {
  const module = { exports: {} }
  const output = compiled.outputFiles.find(file => file.path.endsWith(`/${name}.js`) || file.path.endsWith(`\\${name}.js`))!
  new Function('require', 'module', 'exports', '__backTest', output.text)(require, module, module.exports, boundary)
  return module.exports as T
}
interface HostNode { tag: string; props: Record<string, any>; children: HostNode[]; parent: HostNode | null; text?: string }
const node = (tag: string): HostNode => ({ tag, props: {}, children: [], parent: null })
function renderHost(component: Component, initial: Record<string, unknown>) {
  const sourceChanges: string[] = []
  const renderer = createRenderer<HostNode, HostNode>({
    createElement: tag => node(tag),
    createText: text => ({ ...node('#text'), text }),
    createComment: text => ({ ...node('#comment'), text }),
    setText: (target, text) => { target.text = text },
    setComment: (target, text) => { target.text = text },
    setElementText: (target, text) => { target.text = text; target.children = [] },
    patchProp: (target, key, _previous, value) => { target.props[key] = value; if (target.tag === 'img' && key === 'src') sourceChanges.push(value) },
    insert: (child, parent, anchor = null) => {
      if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
      const index = anchor ? parent.children.indexOf(anchor) : -1
      if (index < 0) parent.children.push(child); else parent.children.splice(index, 0, child)
      child.parent = parent
    },
    remove: child => { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = null },
    parentNode: child => child.parent,
    nextSibling: child => child.parent?.children[child.parent.children.indexOf(child) + 1] ?? null,
  })
  const props = ref(initial), root = node('root')
  const app = renderer.createApp({ setup: () => () => h(component, props.value) })
  app.mount(root)
  function find(predicate: (value: HostNode) => boolean, target = root): HostNode[] {
    return [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => find(predicate, child))]
  }
  return { props, sourceChanges, find, stop: () => app.unmount() }
}
function boot(saved = new Map<string, unknown>(), initialOwner: number | null = null, connected = true, sessionReady = true) {
  const calls: string[] = []
  const settings = ref({ cardBack: 'pocket' })
  const boundary: Boundary = {
    fetch: async () => { calls.push('GET /user/settings'); return settings.value },
    read: async key => { calls.push(`READ ${key}`); return saved.get(key) },
    write: async (key, value) => { calls.push(`WRITE ${key}`); saved.set(key, value) },
  }
  const owner = ref(initialOwner), online = ref(connected), ready = ref(sessionReady)
  const referenceBacks = ref([{ code: 'pocket', assetUrl: pinkRemote }])
  const { useMobileCardBack } = load<typeof import('../src/mobile/useMobileCardBack')>('cardBack', boundary)
  const host = renderHost(defineComponent({ setup() {
    const { backImageUrl } = useMobileCardBack()
    return () => h('img', { src: backImageUrl.value, 'data-owner': owner.value, 'data-online': online.value,
      'data-ready': ready.value, 'data-setting': settings.value.cardBack, 'data-reference': referenceBacks.value[0]?.assetUrl })
  } }), {})
  const image = () => host.find(value => value.tag === 'img')[0]!
  return { ...host, owner, online, ready, referenceBacks, settings, image, calls, boundary }
}
const settle = async () => { await nextTick(); await new Promise<void>(resolve => setImmediate(resolve)); await nextTick() }
const assertFixed = (app: ReturnType<typeof boot>) => {
  assert.equal(app.image().props.src, purpleBundle)
  assert.deepEqual(app.sourceChanges, [purpleBundle], 'the mounted image must never reload with another card back')
  assert.deepEqual(app.calls, [], 'APP card backs must not read account settings or legacy storage')
}

test('the bundled purple card back is the approved original and has no account or pink-asset dependencies', () => {
  const actual = createHash('sha256').update(readFileSync(resolve(root, 'src/assets/mobile/daily-purple-card-back.png'))).digest('hex')
  assert.equal(actual, '1efd1b346e000546271695008cdf510b96ff1da283c6cfe14c45055236fec9a2')
  assert.equal(Object.keys(compiled.metafile!.inputs).some(path => /mobileApi|mobileStorage|web-default-card-back|publicAssetUrl|mobileMediaUrl/.test(path)), false)
})

test('anonymous, login, account switch and logout all keep the same mounted purple image', async () => {
  const app = boot()
  try {
    const original = app.image()
    assertFixed(app)
    for (const owner of [7, 8, null]) {
      app.owner.value = owner
      await settle()
      assertFixed(app)
      assert.equal(app.image(), original)
    }
  } finally { app.stop() }
})

test('cold sessions ignore old pocket account caches before and after session restoration', async () => {
  const storage = new Map<string, unknown>([['card-back-7', { schema: 1, owner: 7, site: 'domestic', code: 'pocket' }]])
  for (const connected of [false, true]) {
    const app = boot(storage, null, connected, false)
    try {
      assertFixed(app)
      app.owner.value = 7; app.ready.value = true
      await settle(); assertFixed(app)
      assert.equal((storage.get('card-back-7') as { code: string }).code, 'pocket')
    } finally { app.stop() }
  }
})

test('offline/online changes, stale web settings and reference refreshes never replace purple', async () => {
  const app = boot(new Map(), 7, false)
  try {
    for (const connected of [true, false, true]) {
      app.online.value = connected
      app.settings.value = { cardBack: connected ? 'pocket' : 'retired-code' }
      app.referenceBacks.value = connected ? [{ code: 'pocket', assetUrl: pinkRemote }] : []
      await settle(); assertFixed(app)
    }
  } finally { app.stop() }
})

test('home and reveal components default to purple and retain that same image during flips and failed face loads', async () => {
  const context = boot()
  try {
    for (const name of ['home', 'flip']) {
      const component = load<{ default: Component }>(name, context.boundary).default
      const host = renderHost(component, { card: { id: 0, isReversed: true }, flipped: false, revealed: false,
        english: false, imageUrl: 'https://site.fixture.invalid/face.webp' })
      try {
        const back = host.find(value => value.tag === 'img' && value.props.src === purpleBundle)[0]!
        assert.ok(back, `${name} must use the purple bundle without parent card-back props`)
        host.props.value = { ...host.props.value, flipped: true, revealed: true, english: true }
        await settle()
        assert.equal(host.find(value => value.tag === 'img' && value.props.src === purpleBundle)[0], back)
        const front = host.find(value => value.tag === 'img' && value.props.src === 'https://site.fixture.invalid/face.webp')[0]!
        assert.ok(front)
        if (name === 'flip') {
          front.props.onError()
          await settle()
          assert.notEqual(front.props.src, 'https://site.fixture.invalid/face.webp', 'face fallback still works')
          assert.equal(host.find(value => value.tag === 'img' && value.props.src === purpleBundle)[0], back)
        }
        assert.equal(host.sourceChanges.filter(value => value === purpleBundle).length, 1)
        assert.equal(host.sourceChanges.some(value => value.includes('pocket') || value.includes('web-default')), false)
      } finally { host.stop() }
    }
    assert.deepEqual(context.calls, [])
  } finally { context.stop() }
})
