import { defineConfig, mergeConfig } from 'vite'
import { cp, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import baseConfig from './vite.config'

export default defineConfig(async context => {
  const base = typeof baseConfig === 'function' ? await baseConfig(context) : await baseConfig
  const root = process.cwd()
  const output = path.resolve(root, 'dist-mobile')
  return mergeConfig(base, {
    base: '/',
    publicDir: false,
    build: { outDir: output, emptyOutDir: true },
    plugins: [{
      name: 'mobile-offline-assets',
      async closeBundle() {
        const source = path.resolve(root, 'public/mobile')
        await readFile(path.join(source, 'cards', 'The_Star.webp'))
        await mkdir(path.join(output, 'mobile'), { recursive: true })
        await cp(source, path.join(output, 'mobile'), { recursive: true })
      },
    }],
  })
})
