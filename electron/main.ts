/**
 * electron/main.ts
 * Proceso principal de Electron.
 * Crea la ventana, inicializa SQLite y registra los handlers IPC.
 */

import { app, BrowserWindow, nativeTheme } from 'electron'
import path                                 from 'path'
import Database                             from 'better-sqlite3'
import fs                                   from 'fs'
import { registerHandlers }                 from './ipc/handlers'
import { runMigrations }                    from './db/migrations'

// ── Path de la base de datos ───────────────────────────────────────────────

const DB_PATH = path.join(app.getPath('userData'), 'torrida.db')
const SCHEMA_PATH = path.join(
  app.isPackaged
    ? path.join(process.resourcesPath, 'schema.sql')
    : path.join(__dirname, '../src/lib/schema.sql')
)

// ── Inicializar DB ─────────────────────────────────────────────────────────

function initDatabase(): Database.Database {
  const db = new Database(DB_PATH)

  // WAL mode para mejor performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Ejecutar schema inicial SOLO si la DB es nueva (no tiene tablas aún)
  const tableCount = (db.prepare(
    `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  ).get() as { n: number }).n

  if (tableCount === 0 && fs.existsSync(SCHEMA_PATH)) {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')
    db.exec(schema)
    console.log('[db] ✅ Schema aplicado (DB nueva)')
  }

  // Ejecutar migraciones
  runMigrations(db)

  console.log('[db] ✅ Base de datos lista:', DB_PATH)
  return db
}

// ── Crear ventana principal ────────────────────────────────────────────────

function createWindow(db: Database.Database): BrowserWindow {
  // Forzar tema oscuro
  nativeTheme.themeSource = 'dark'

  const win = new BrowserWindow({
    width:           1280,
    height:          800,
    minWidth:        900,
    minHeight:       600,
    backgroundColor: '#0A0A14',
    titleBarStyle:   'hiddenInset',
    frame:           process.platform !== 'darwin',
    show:            false,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false
    }
  })

  // Registrar handlers IPC
  registerHandlers(db)

  // Cargar la app
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(
      path.join(__dirname, '../dist/index.html')
    )
  }

  // Mostrar solo cuando esté lista
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  // Maximizar en producción
  if (app.isPackaged) {
    win.maximize()
  }

  return win
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  const db = initDatabase()
  createWindow(db)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(db)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Seguridad: bloquear navegación externa
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
      event.preventDefault()
    }
  })
})