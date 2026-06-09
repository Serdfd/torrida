/**
 * preload.ts
 * Puente seguro entre el proceso principal (Node.js)
 * y el renderer (React) usando contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron'

// ── Exponer API al renderer ────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {

  // ── Base de datos ──────────────────────────────────────────────────────
  db: {
    query<T = Record<string, unknown>>(
      sql:     string,
      params?: unknown[]
    ): Promise<T[]> {
      return ipcRenderer.invoke('db:query', sql, params)
    },

    run(
      sql:     string,
      params?: unknown[]
    ): Promise<{ changes: number; lastInsertRowid: number }> {
      return ipcRenderer.invoke('db:run', sql, params)
    },

    transaction(
      statements: { sql: string; params?: unknown[] }[]
    ): Promise<{ changes: number; lastInsertRowid: number }[]> {
      return ipcRenderer.invoke('db:transaction', statements)
    },

    stats(): Promise<{ tables: Record<string, number>; sizeKb: number }> {
      return ipcRenderer.invoke('db:stats')
    }
  },

  // ── App ────────────────────────────────────────────────────────────────
  app: {
    version(): Promise<string> {
      return ipcRenderer.invoke('app:version')
    },

    userDataPath(): Promise<string> {
      return ipcRenderer.invoke('app:userDataPath')
    },

    name(): Promise<string> {
      return ipcRenderer.invoke('app:name')
    },

    openExternal(url: string): Promise<void> {
      return ipcRenderer.invoke('app:openExternal', url)
    }
  },

  // ── Backup ─────────────────────────────────────────────────────────────
  backup: {
    export(): Promise<{ ok: boolean; filePath?: string; reason?: string }> {
      return ipcRenderer.invoke('backup:export')
    },

    import(): Promise<{ ok: boolean; message?: string; reason?: string }> {
      return ipcRenderer.invoke('backup:import')
    }
  },

  // ── Archivos ───────────────────────────────────────────────────────────
  file: {
    selectImage(): Promise<string | null> {
      return ipcRenderer.invoke('file:selectImage')
    },

    showInFolder(filePath: string): Promise<void> {
      return ipcRenderer.invoke('file:showInFolder', filePath)
    }
  },

  // ── Exportar ───────────────────────────────────────────────────────────
  export: {
    csv(
      content:     string,
      defaultName: string
    ): Promise<{ ok: boolean; filePath?: string; reason?: string }> {
      return ipcRenderer.invoke('export:csv', content, defaultName)
    }
  },

  // ── Ventas ─────────────────────────────────────────────────────────────
  venta: {
    generarNumero(prefijo: string): Promise<string> {
      return ipcRenderer.invoke('venta:generarNumero', prefijo)
    }
  }
})