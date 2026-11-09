import type { CapacitorConfig } from '@capacitor/cli'

/**
 * iOS shell around the Vite build. `webDir` is the production bundle, and
 * `server.url` is intentionally unset so the app loads those files from the
 * device. It does not talk to the Vercel deployment at runtime.
 */
const config: CapacitorConfig = {
  appId: 'dev.andrewsolomon.logoremix',
  appName: 'Logo Remix',
  webDir: 'dist',
  // Shown behind the web view until the first paint. Matches the light theme.
  backgroundColor: '#F7F5F1',
  ios: {
    backgroundColor: '#F7F5F1',
    // The shell pads itself with env(safe-area-inset-*). Automatic insets
    // would pad twice and fight the keyboard layout.
    contentInset: 'never',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      // Dark status-bar text on the light paper background. Play mode flips
      // this at runtime (see App.tsx).
      style: 'LIGHT',
      backgroundColor: '#F7F5F1',
    },
  },
}

export default config
