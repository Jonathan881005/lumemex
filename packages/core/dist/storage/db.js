"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbPath = getDbPath;
exports.openDb = openDb;
exports.migrateDb = migrateDb;
exports.initDb = initDb;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const repo_root_1 = require("../utils/repo-root");
function getDbPath() {
    const repoRoot = (0, repo_root_1.repoRootFromCwd)();
    return node_path_1.default.join(repoRoot, 'data', 'lumemex.db');
}
function openDb(dbPath = getDbPath()) {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(dbPath), { recursive: true });
    return new better_sqlite3_1.default(dbPath);
}
function migrateDb(db, migrationsDir) {
    const applied = new Set();
    const hasMigrationsTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
        .get();
    if (hasMigrationsTable) {
        for (const row of db.prepare('SELECT version FROM schema_migrations').all()) {
            applied.add(Number(row.version));
        }
    }
    const files = node_fs_1.default
        .readdirSync(migrationsDir)
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort();
    for (const file of files) {
        const m = file.match(/^(\d+)_.*\.sql$/);
        if (!m)
            continue;
        const version = Number(m[1]);
        if (applied.has(version))
            continue;
        const sql = node_fs_1.default.readFileSync(node_path_1.default.join(migrationsDir, file), 'utf8');
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString());
    }
}
function initDb() {
    const db = openDb();
    const repoRoot = (0, repo_root_1.repoRootFromCwd)();
    const migrationsDir = node_path_1.default.join(repoRoot, 'packages', 'core', 'src', 'storage', 'migrations');
    migrateDb(db, migrationsDir);
    return db;
}
//# sourceMappingURL=db.js.map