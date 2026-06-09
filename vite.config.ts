import { defineConfig } from 'vite'
import react            from '@vitejs/plugin-react'
import path             from 'path'
import electron         from 'vite-plugin-electron'
import renderer         from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),

    electron([
      // ── Proceso principal ───────────────────────────────────────────────
      {
        entry:  'electron/main.ts',
        onstart({ startup }) {
          startup()
        },
        vite: {
          build: {
            sourcemap: true,
            outDir:    'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3', 'electron']
            }
          }
        }
      },

      // ── Preload ─────────────────────────────────────────────────────────
      {
        entry: 'electron/preload.ts',
        onstart({ reload }) {
          reload()
        },
        vite: {
          build: {
            sourcemap:    'inline',
            outDir:       'dist-electron',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),

    renderer()
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },

  // ── Dev server ───────────────────────────────────────────────────────────
  server: {
    port:        5173,
    strictPort:  true,
    host:        'localhost'
  },

  // ── Build renderer ───────────────────────────────────────────────────────
  build: {
    outDir:          'dist',
    emptyOutDir:     true,
    sourcemap:       false,
    minify:          'esbuild',
    target:          'chrome110',
    rollupOptions: {
      output: {
        manualChunks: {
          react:    ['react', 'react-dom'],
          recharts: ['recharts'],
          zustand:  ['zustand']
        }
      }
    }
  },

  // ── Optimizaciones ───────────────────────────────────────────────────────
  optimizeDeps: {
    exclude: ['better-sqlite3']
  }
})