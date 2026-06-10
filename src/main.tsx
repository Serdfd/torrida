/**
 * main.tsx
 * Punto de entrada del renderer de React.
 * Inicializa la app y monta el componente raíz.
 */

import React    from 'react'
import ReactDOM from 'react-dom/client'
import App      from './App'
import './index.css'

// ── Inicializar schema y migraciones ───────────────────────────────────────

async function initDatabase() {
  try {
    // Configurar pragmas al arrancar
    await window.electronAPI.db.run(`PRAGMA journal_mode = WAL`)
    await window.electronAPI.db.run(`PRAGMA foreign_keys = ON`)
    console.log('[main] ✅ Base de datos lista')
  } catch (err) {
    console.error('[main] ❌ Error inicializando DB:', err)
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

async function bootstrap() {
  await initDatabase()

  const root = document.getElementById('root')
  if (!root) throw new Error('[main] No se encontró #root en el DOM')

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

bootstrap()