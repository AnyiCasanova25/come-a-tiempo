import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Versión y fecha de publicación, visibles en Ajustes (para saber si el celular ya actualizó)
  define: {
    __VERSION__: JSON.stringify(version),
    __PUBLICADA__: JSON.stringify(new Date().toISOString()),
  },
  // En GitHub Pages la app vive en /<repositorio>/; en local, en la raíz
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    // "npm run movil": HTTPS en la red local, que el celular exige para usar la cámara
    mode === 'movil' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'icono-192.png'],
      manifest: {
        name: 'Come a tiempo con SyA',
        short_name: 'Come a tiempo',
        description: 'Vencimientos, alertas y lista de compras del mercado de la casa',
        lang: 'es-CO',
        theme_color: '#15803d',
        background_color: '#f6f7f4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Alertas en segundo plano y clic en la notificación (public/sw-alertas.js)
        importScripts: ['sw-alertas.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ].filter(Boolean),
  server: mode === 'movil' ? { host: true } : undefined,
}))
