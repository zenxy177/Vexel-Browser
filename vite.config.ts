import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              onwarn(warning, warn) {
                if (warning.message?.includes('platform') || warning.code === 'UNKNOWN_OPTION') return;
                warn(warning);
              },
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            lib: {
              formats: ['cjs'],
            },
            rollupOptions: {
              output: {
                format: 'cjs',
              },
              onwarn(warning, warn) {
                if (warning.message?.includes('platform') || warning.code === 'UNKNOWN_OPTION') return;
                warn(warning);
              },
            },
          },
        },
      },
      {
        entry: 'electron/webview-preload.ts',
        vite: {
          build: {
            rollupOptions: {
              onwarn(warning, warn) {
                if (warning.message?.includes('platform') || warning.code === 'UNKNOWN_OPTION') return;
                warn(warning);
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
