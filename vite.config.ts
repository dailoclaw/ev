import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.jpg', 'theme-init.js'],
      manifest: {
        name: 'EV Command',
        short_name: 'EV Command',
        description: 'Private EV charging ledger, savings analysis, and vehicle running costs.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f3f5f7',
        theme_color: '#f3f5f7',
        icons: [{ src: '/icon.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'any maskable' }],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,jpg,webp,woff2}'],
        globIgnores: ['car*.jpg'],
      },
    }),
  ],
})
