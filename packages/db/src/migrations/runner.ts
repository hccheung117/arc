import type { IPlatformDatabase } from "@arc/core";

import type { Migration } from "./migrations.js";
import { migrations } from "./migrations.js";

type MigrationRow = { name: string };
type CountRow = { count: number };

async function getAppliedMigrations(
  db: IPlatformDatabase
): Promise<Set<string>> {
  try {
    const result = await db.query<MigrationRow>(
      "SELECT name FROM migrations ORDER BY id ASC"
    );
    return new Set(result.rows.map((row) => row.name));
  } catch {
    // Table does not exist yet (first migration)
    return new Set();
  }
}

async function recordMigration(db: IPlatformDatabase, name: string): Promise<void> {
  const now = Date.now();
  await db.exec("INSERT INTO migrations (name, applied_at) VALUES (?, ?)", [
    name,
    now,
  ]);
}

async function applyMigration(
  db: IPlatformDatabase,
  migration: Migration
): Promise<void> {
  await db.transaction(async () => {
    await db.execScript(migration.sql);
    await recordMigration(db, migration.name);
  });
}

export async function runMigrations(db: IPlatformDatabase): Promise<number> {
  const applied = await getAppliedMigrations(db);
  let appliedCount = 0;

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      console.log(`Applying migration: ${migration.name}`);
      await applyMigration(db, migration);
      appliedCount++;
    }
  }

  if (appliedCount > 0) {
    console.log(`Applied ${appliedCount} migration(s)`);
  } else {
    console.log("Database is up to date");
  }

  return appliedCount;
}

export async function getSchemaVersion(db: IPlatformDatabase): Promise<number> {
  try {
    const result = await db.query<CountRow>(
      "SELECT COUNT(*) as count FROM migrations"
    );
    const value = result.rows[0]?.count ?? 0;
    return typeof value === "number" ? value : Number(value) || 0;
  } catch {
    return 0;
  }
}
