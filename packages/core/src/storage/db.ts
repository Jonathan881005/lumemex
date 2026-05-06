import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { repoRootFromCwd } from '../utils/repo-root';

export function getDbPath(): string {
  const repoRoot = repoRootFromCwd();
  return path.join(repoRoot, 'data', 'lumemex.db');
}

export function openDb(dbPath = getDbPath()): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return new Database(dbPath);
}

export function migrateDb(db: Database.Database, migrationsDir: string): void {
  const applied = new Set<number>();
  const hasMigrationsTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
    .get() as { name: string } | undefined;

  if (hasMigrationsTable) {
    for (const row of db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>) {
      applied.add(Number(row.version));
    }
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const m = file.match(/^(\d+)_.*\.sql$/);
    if (!m) continue;
    const version = Number(m[1]);
    if (applied.has(version)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString());
  }
}

export function initDb(): Database.Database {
  const db = openDb();
  const repoRoot = repoRootFromCwd();
  const migrationsDir = path.join(repoRoot, 'packages', 'core', 'src', 'storage', 'migrations');
  migrateDb(db, migrationsDir);
  return db;
}

