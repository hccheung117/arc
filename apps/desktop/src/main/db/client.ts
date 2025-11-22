import { app } from 'electron'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import BetterSqlite3 from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import * as schema from './schema'

const dbPath = path.join(app.getPath('userData'), 'arc.db')
const sqlite = new BetterSqlite3(dbPath)

export const db = drizzle({ client: sqlite, schema })

export async function initializeDatabase() {
  const migrationsFolder = path.join(__dirname, 'migrations')
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json')

  // In dev mode, migrations may not exist yet - skip if journal doesn't exist
  // Use `pnpm db:dev` to push schema changes during development
  if (!fs.existsSync(journalPath)) {
    console.log('[DB] No migrations found, skipping. Use `pnpm db:dev` to set up schema.')
    return
  }

  await migrate(db, { migrationsFolder })
}
