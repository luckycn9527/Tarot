import { spawnSync } from 'node:child_process'
import { mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
await mkdir(path.join(root, 'resources'), { recursive: true })
for (const name of ['icon-only.png', 'splash.png']) {
  await copyFile(path.join(root, 'src/assets/logo/logo.png'), path.join(root, 'resources', name))
}
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/@capacitor/assets/bin/capacitor-assets'),
  'generate', '--android', '--ios', '--assetPath', 'resources', '--iconBackgroundColor', '#0c0b12', '--splashBackgroundColor', '#0c0b12'],
{ cwd: root, stdio: 'inherit' })
if (result.error) throw result.error
process.exit(result.status || 0)
