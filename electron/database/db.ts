import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import { SCHEMA_SQL } from './schema'
import path from 'path'
import { app } from 'electron'

let SQL: SqlJsStatic | null = null
let db: Database | null = null

async function getSql(): Promise<SqlJsStatic> {
  if (SQL) return SQL
  SQL = await initSqlJs({
    locateFile: (file: string) => {
      if (app.isPackaged) {
        return path.join(process.resourcesPath, file)
      }
      return path.join(app.getAppPath(), 'node_modules/sql.js/dist', file)
    }
  })
  return SQL
}

export async function openDatabase(dbPath: string): Promise<Database> {
  const sql = await getSql()
  const fs = await import('fs')

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new sql.Database(buffer)
  } else {
    db = new sql.Database()
    db.run(SCHEMA_SQL)
    persist(dbPath)
  }

  return db
}

export function getDb(): Database {
  if (!db) throw new Error('Base de datos no inicializada')
  return db
}

export function persist(dbPath: string): void {
  if (!db) return
  const fs = require('fs')
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

// ── Helpers de consulta ────────────────────────────────────

export function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T[] {
  const database = getDb()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T | null {
  const rows = queryAll<T>(sql, params)
  return rows.length > 0 ? rows[0] : null
}

export function execute(sql: string, params: unknown[] = []): void {
  const database = getDb()
  database.run(sql, params)
}

export function insertAndGetId(sql: string, params: unknown[] = []): number {
  const database = getDb()
  database.run(sql, params)
  const result = database.exec('SELECT last_insert_rowid() as id')
  if (result.length === 0) throw new Error('No se pudo obtener el ID insertado')
  return result[0].values[0][0] as number
}

export function runTransaction(fn: () => void): void {
  const database = getDb()
  database.run('BEGIN TRANSACTION')
  try {
    fn()
    database.run('COMMIT')
  } catch (err) {
    database.run('ROLLBACK')
    throw err
  }
}