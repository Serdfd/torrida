/**
 * handlers.ts
 * Registra todos los handlers IPC de Electron.
 * El proceso renderer llama a window.electronAPI.*
 * y estos handlers responden desde el proceso principal.
 */

import { ipcMain, app, shell, dialog } from 'electron'
import type { Database }               from 'better-sqlite3'
import { runMigrations, getMigrationsStatus } from '../db/migrations'
import path  from 'path'
import fs    from 'fs'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface RunResult {
  changes:         number
  lastInsertRowid: number
}

// ── Registro principal ─────────────────────────────────────────────────────

export function registerHandlers(db: Database): void {

  // ── DB: query (SELECT) ───────────────────────────────────────────────────
  ipcMain.handle(
    'db:query',
    (_event, sql: string, params: unknown[] = []) => {
      try {
        const stmt = db.prepare(sql)
        return stmt.all(...params)
      } catch (err) {
        console.error('[db:query] Error:', err)
        console.error('[db:query] SQL:', sql)
        throw err
      }
    }
  )

  // ── DB: run (INSERT / UPDATE / DELETE) ───────────────────────────────────
  ipcMain.handle(
    'db:run',
    (_event, sql: string, params: unknown[] = []): RunResult => {
      try {
        const stmt   = db.prepare(sql)
        const result = stmt.run(...params)
        return {
          changes:         result.changes,
          lastInsertRowid: result.lastInsertRowid as number
        }
      } catch (err) {
        console.error('[db:run] Error:', err)
        console.error('[db:run] SQL:', sql)
        throw err
      }
    }
  )

  // ── DB: transaction (batch atómico) ─────────────────────────────────────
  ipcMain.handle(
    'db:transaction',
    (_event, statements: { sql: string; params?: unknown[] }[]): RunResult[] => {
      const results: RunResult[] = []

      const run = db.transaction(() => {
        for (const stmt of statements) {
          const prepared = db.prepare(stmt.sql)
          const result   = prepared.run(...(stmt.params ?? []))
          results.push({
            changes:         result.changes,
            lastInsertRowid: result.lastInsertRowid as number
          })
        }
      })

      try {
        run()
        return results
      } catch (err) {
        console.error('[db:transaction] Error, rollback ejecutado:', err)
        throw err
      }
    }
  )

  // ── DB: migraciones ──────────────────────────────────────────────────────
  ipcMain.handle('db:runMigrations', () => {
    runMigrations(db)
  })

  ipcMain.handle('db:migrationsStatus', () => {
    return getMigrationsStatus(db)
  })

  // ── App: info ────────────────────────────────────────────────────────────
  ipcMain.handle('app:version', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:userDataPath', () => {
    return app.getPath('userData')
  })

  ipcMain.handle('app:name', () => {
    return app.getName()
  })

  // ── App: abrir URL externa ───────────────────────────────────────────────
  ipcMain.handle('app:openExternal', (_event, url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
  })

  // ── Backup: exportar DB ──────────────────────────────────────────────────
  ipcMain.handle('backup:export', async (_event) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title:       'Exportar base de datos',
      defaultPath: `torrida_backup_${new Date().toISOString().slice(0, 10)}.db`,
      filters: [
        { name: 'SQLite Database', extensions: ['db'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    })

    if (canceled || !filePath) return { ok: false, reason: 'cancelado' }

    try {
      // Usa el método de backup de better-sqlite3
      await (db as any).backup(filePath)
      return { ok: true, filePath }
    } catch (err) {
      console.error('[backup:export] Error:', err)
      return { ok: false, reason: String(err) }
    }
  })

  // ── Backup: importar DB ──────────────────────────────────────────────────
  ipcMain.handle('backup:import', async (_event) => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title:       'Importar base de datos',
      filters: [
        { name: 'SQLite Database', extensions: ['db'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (canceled || filePaths.length === 0) {
      return { ok: false, reason: 'cancelado' }
    }

    const srcPath  = filePaths[0]
    const destPath = path.join(app.getPath('userData'), 'torrida.db')
    const bakPath  = destPath + '.bak'

    try {
      // Hacer backup del archivo actual antes de reemplazar
      if (fs.existsSync(destPath)) {
        fs.copyFileSync(destPath, bakPath)
      }
      fs.copyFileSync(srcPath, destPath)
      return { ok: true, message: 'Importación exitosa. Reinicia la app.' }
    } catch (err) {
      // Restaurar backup si algo salió mal
      if (fs.existsSync(bakPath)) {
        fs.copyFileSync(bakPath, destPath)
      }
      console.error('[backup:import] Error:', err)
      return { ok: false, reason: String(err) }
    }
  })

  // ── Archivos: seleccionar imagen ─────────────────────────────────────────
  ipcMain.handle('file:selectImage', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title:       'Seleccionar imagen',
      filters: [
        { name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'webp', 'svg'] }
      ],
      properties: ['openFile']
    })

    if (canceled || filePaths.length === 0) return null

    const src      = filePaths[0]
    const ext      = path.extname(src)
    const fileName = `img_${Date.now()}${ext}`
    const destDir  = path.join(app.getPath('userData'), 'imagenes')
    const dest     = path.join(destDir, fileName)

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    fs.copyFileSync(src, dest)
    return dest
  })

  // ── Archivos: abrir en explorador ────────────────────────────────────────
  ipcMain.handle('file:showInFolder', (_event, filePath: string) => {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath)
    }
  })

  // ── Exportar CSV ─────────────────────────────────────────────────────────
  ipcMain.handle(
    'export:csv',
    async (_event, content: string, defaultName: string) => {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title:       'Exportar CSV',
        defaultPath: defaultName,
        filters: [
          { name: 'CSV', extensions: ['csv'] },
          { name: 'Todos los archivos', extensions: ['*'] }
        ]
      })

      if (canceled || !filePath) return { ok: false, reason: 'cancelado' }

      try {
        fs.writeFileSync(filePath, '\uFEFF' + content, 'utf8') // BOM para Excel
        return { ok: true, filePath }
      } catch (err) {
        return { ok: false, reason: String(err) }
      }
    }
  )

  // ── Número de venta: generar correlativo ─────────────────────────────────
  ipcMain.handle('venta:generarNumero', (_event, prefijo: string) => {
    try {
      const hoy   = new Date()
      const anio  = hoy.getFullYear()
      const mes   = String(hoy.getMonth() + 1).padStart(2, '0')

      const row = db
        .prepare<[], { max_num: number }>(
          `SELECT COUNT(*) + 1 AS max_num
           FROM ventas
           WHERE strftime('%Y-%m', fecha) = ?`,
        )
        .get(`${anio}-${mes}`)

      const seq  = String(row?.max_num ?? 1).padStart(4, '0')
      return `${prefijo}${anio}${mes}-${seq}`
    } catch {
      return `${prefijo}${Date.now()}`
    }
  })

  // ── Stats: info de la DB ─────────────────────────────────────────────────
  ipcMain.handle('db:stats', () => {
    try {
      const tables = db
        .prepare<[], { name: string }>(
          `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
        )
        .all()

      const stats: Record<string, number> = {}

      for (const { name } of tables) {
        if (name.startsWith('_')) continue
        const row = db
          .prepare<[], { count: number }>(`SELECT COUNT(*) AS count FROM "${name}"`)
          .get()
        stats[name] = row?.count ?? 0
      }

      const dbPath = path.join(app.getPath('userData'), 'torrida.db')
      const size   = fs.existsSync(dbPath)
        ? Math.round(fs.statSync(dbPath).size / 1024)
        : 0

      return { tables: stats, sizeKb: size }
    } catch (err) {
      console.error('[db:stats] Error:', err)
      return { tables: {}, sizeKb: 0 }
    }
  })

  console.log('[handlers] ✅ IPC handlers registrados')
}