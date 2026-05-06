import Database from 'better-sqlite3';
export declare function getDbPath(): string;
export declare function openDb(dbPath?: string): Database.Database;
export declare function migrateDb(db: Database.Database, migrationsDir: string): void;
export declare function initDb(): Database.Database;
