import { app } from 'electron'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import BetterSqlite3 from 'better-sqlite3'
import path from 'path'
import * as schema from './schema'

const dbPath = path.join(app.getPath('userData'), 'arc.db')
const sqlite = new BetterSqlite3(dbPath)

export const db = drizzle({ client: sqlite, schema })

export async function initializeDatabase() {
  await migrate(db, {
    migrationsFolder: path.join(__dirname, 'migrations'),
  })
}
