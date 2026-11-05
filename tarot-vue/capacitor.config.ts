import type { CapacitorConfig } from '@capacitor/cli'

// Native assets are bundled in the application. Never point release builds at
// a remote website with server.url: the API origin is selected at web build time.
const config: CapacitorConfig = {
  appId: 'cn.zaopic.etomd',
  appName: 'E-Tomd',
  webDir: 'dist-mobile',
  // Never log bridge payloads or authentication/storage data, including in the
  // internal debug APK. WebView debugging is a separate opt-in build flag.
  loggingBehavior: 'none',
  backgroundColor: '#0c0b12',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: process.env.MOBILE_DEBUG === 'true',
    backgroundColor: '#0c0b12',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0c0b12',
  },
  plugins: {
    SystemBars: { style: 'DARK', insetsHandling: 'native', initialViewportFitValueHint: 'cover' },
    Keyboard: { resize: 'body' },
  },
}

export default config
