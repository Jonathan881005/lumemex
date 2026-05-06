-- lumemex initial schema (tables + FTS5)

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- Tracks immutable source documents under raw/
CREATE TABLE IF NOT EXISTS raw_items (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source TEXT NOT NULL,
  raw_path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  status TEXT NOT NULL,
  last_error TEXT,
  content TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_items_status ON raw_items(status);
CREATE INDEX IF NOT EXISTS idx_raw_items_ingested_at ON raw_items(ingested_at);

-- Tracks wiki pages written/maintained by the LLM
CREATE TABLE IF NOT EXISTS wiki_pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  summary_line TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  content TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_category ON wiki_pages(category);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_updated_at ON wiki_pages(updated_at);

-- wiki -> wiki relationships derived from [[wiki-links]]
CREATE TABLE IF NOT EXISTS wiki_links (
  from_slug TEXT NOT NULL,
  to_slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (from_slug, to_slug)
);

CREATE INDEX IF NOT EXISTS idx_wiki_links_to_slug ON wiki_links(to_slug);

-- raw -> wiki traceability
CREATE TABLE IF NOT EXISTS raw_to_wiki_refs (
  raw_id TEXT NOT NULL,
  wiki_slug TEXT NOT NULL,
  PRIMARY KEY (raw_id, wiki_slug)
);

CREATE INDEX IF NOT EXISTS idx_raw_to_wiki_refs_wiki_slug ON raw_to_wiki_refs(wiki_slug);

-- Async jobs tracking (ingest/query/lint)
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  model TEXT,
  provider_base_url TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_operation_started_at ON jobs(operation, started_at);

CREATE TABLE IF NOT EXISTS job_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events(job_id);

-- FTS5: raw content search
CREATE VIRTUAL TABLE IF NOT EXISTS raw_fts USING fts5(
  raw_id UNINDEXED,
  title,
  content
);

-- FTS5: wiki content search
CREATE VIRTUAL TABLE IF NOT EXISTS wiki_fts USING fts5(
  wiki_slug UNINDEXED,
  title,
  summary_line,
  content
);

-- Keep raw_fts synchronized
DROP TRIGGER IF EXISTS raw_fts_insert;
DROP TRIGGER IF EXISTS raw_fts_delete;
DROP TRIGGER IF EXISTS raw_fts_update;

CREATE TRIGGER raw_fts_insert AFTER INSERT ON raw_items BEGIN
  INSERT INTO raw_fts(raw_id, title, content)
  VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER raw_fts_delete AFTER DELETE ON raw_items BEGIN
  DELETE FROM raw_fts WHERE raw_id = old.id;
END;

CREATE TRIGGER raw_fts_update AFTER UPDATE ON raw_items BEGIN
  DELETE FROM raw_fts WHERE raw_id = old.id;
  INSERT INTO raw_fts(raw_id, title, content)
  VALUES (new.id, new.title, new.content);
END;

-- Keep wiki_fts synchronized
DROP TRIGGER IF EXISTS wiki_fts_insert;
DROP TRIGGER IF EXISTS wiki_fts_delete;
DROP TRIGGER IF EXISTS wiki_fts_update;

CREATE TRIGGER wiki_fts_insert AFTER INSERT ON wiki_pages BEGIN
  INSERT INTO wiki_fts(wiki_slug, title, summary_line, content)
  VALUES (new.slug, new.title, new.summary_line, new.content);
END;

CREATE TRIGGER wiki_fts_delete AFTER DELETE ON wiki_pages BEGIN
  DELETE FROM wiki_fts WHERE wiki_slug = old.slug;
END;

CREATE TRIGGER wiki_fts_update AFTER UPDATE ON wiki_pages BEGIN
  DELETE FROM wiki_fts WHERE wiki_slug = old.slug;
  INSERT INTO wiki_fts(wiki_slug, title, summary_line, content)
  VALUES (new.slug, new.title, new.summary_line, new.content);
END;

