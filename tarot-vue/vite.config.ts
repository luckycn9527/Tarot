import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_PUBLIC_API_ORIGIN || 'http://localhost:5174'

  return {
    plugins: [
      vue(),
      tailwindcss(),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('maplibre-gl') || id.includes('vue-maplibre')) return 'maplibre'
              if (id.includes('lunar-javascript')) return 'lunar'
              if (id.includes('vue-i18n')) return 'vue-i18n'
              if (id.includes('vue-router')) return 'vue-router'
              if (id.includes('pinia')) return 'pinia'
              if (id.includes('zod')) return 'zod'
              if (id.includes('@vueuse')) return 'vueuse'
              if (id.includes('axios')) return 'axios'
              if (id.includes('vue')) return 'vue-vendor'
            }
            return undefined
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@icons': path.resolve(__dirname, '../icon/vue'),
      },
    },
    server: {
      host: '0.0.0.0',
      /** 与 tarot-server 默认 PORT=5174 错开，避免 5173 被占用时顺延抢端口 */
      port: 5175,
      strictPort: false,
      /** 避免开发时 index.html 被浏览器强缓存，表现为「改了代码页面不变」 */
      headers: {
        'Cache-Control': 'no-store',
      },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
