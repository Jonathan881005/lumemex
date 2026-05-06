"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryQuestion = queryQuestion;
exports.saveQueryCandidate = saveQueryCandidate;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const shared_1 = require("@lumemex/shared");
const hash_1 = require("../utils/hash");
const load_config_1 = require("../config/load-config");
const db_1 = require("../storage/db");
const index_md_1 = require("../wiki/index-md");
const log_1 = require("../wiki/log");
const write_1 = require("../wiki/write");
const index_update_1 = require("../wiki/index-update");
const paths_1 = require("../wiki/paths");
const client_1 = require("../llm/client");
const query_prompt_1 = require("../llm/prompts/query.prompt");
const repo_root_1 = require("../utils/repo-root");
function uuid() {
    return node_crypto_1.default.randomUUID();
}
function truncateForPrompt(s, maxChars) {
    const t = s ?? '';
    if (t.length <= maxChars)
        return t;
    return t.slice(0, maxChars);
}
function fillTemplate(template, vars) {
    let out = template;
    for (const [k, v] of Object.entries(vars))
        out = out.replaceAll(`{{${k}}}`, v);
    return out;
}
function toFtsQuery(input) {
    const tokens = (input ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
        .slice(0, 8);
    if (tokens.length === 0)
        return '*';
    return tokens.map((t) => `"${t}"`).join(' OR ');
}
async function queryQuestion(question) {
    const config = await (0, load_config_1.loadConfig)();
    const db = (0, db_1.initDb)();
    const wikiDir = config.wiki_dir;
    const repoRoot = (0, repo_root_1.repoRootFromCwd)();
    const schemaMd = await promises_1.default.readFile(node_path_1.default.join(repoRoot, 'SCHEMA.md'), 'utf8');
    const index = await (0, index_md_1.readWikiIndex)(wikiDir);
    const logTail = await (0, log_1.readWikiLogTail)(wikiDir, 10);
    const jobId = uuid();
    db.prepare('INSERT INTO jobs (id, operation, status, started_at, model, provider_base_url) VALUES (?, ?, ?, ?, ?, ?)').run(jobId, 'query', 'running', new Date().toISOString(), config.model, config.api_base_url);
    db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(jobId, 'job_started', JSON.stringify({ question }), new Date().toISOString());
    // Candidate retrieval (MVP): FTS over wiki_fts; fall back to empty list.
    const ftsQuery = toFtsQuery(question);
    let candidatePages = [];
    try {
        candidatePages = db
            .prepare(`
        SELECT w.slug, w.title, w.path, w.category, w.content
        FROM wiki_pages w
        JOIN wiki_fts f ON f.wiki_slug = w.slug
        WHERE wiki_fts MATCH ?
        LIMIT 8
        `)
            .all(ftsQuery);
    }
    catch {
        // Fallback to recent pages if FTS query parsing fails.
        candidatePages = db
            .prepare(`SELECT slug, title, path, category, content FROM wiki_pages ORDER BY updated_at DESC LIMIT 8`)
            .all();
    }
    const candidatesJson = JSON.stringify(candidatePages.map((p) => ({
        slug: p.slug,
        title: p.title,
        path: p.path,
        category: p.category,
        content: truncateForPrompt(p.content ?? '', 12000),
    })));
    const userPrompt = fillTemplate(query_prompt_1.queryUserPromptTemplate, {
        SCHEMA_MD: schemaMd,
        INDEX_MD: await promises_1.default.readFile(node_path_1.default.join(wikiDir, 'index.md'), 'utf8'),
        QUESTION: question,
        CANDIDATE_PAGES_JSON: candidatesJson,
        RAW_SNIPPETS_JSON: JSON.stringify([]),
    });
    const started = Date.now();
    let modelOutput;
    try {
        modelOutput = await (0, client_1.completeJson)({
            config,
            operation: 'query',
            systemPrompt: query_prompt_1.querySystemPrompt,
            userPrompt,
            maxTokens: config.max_tokens_per_compilation,
        });
    }
    catch (e) {
        db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(jobId, 'llm_failed', JSON.stringify({ message: e?.message ?? String(e) }), new Date().toISOString());
        db.prepare('UPDATE jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?').run('failed', String(e?.message ?? e), new Date().toISOString(), jobId);
        throw e;
    }
    const answerMarkdown = modelOutput?.answer_markdown;
    const citations = Array.isArray(modelOutput?.citations) ? modelOutput.citations : [];
    const saveCandidate = modelOutput?.save_candidate;
    const usedWikiSlugs = Array.isArray(modelOutput?.usedWikiSlugs) ? modelOutput.usedWikiSlugs : [];
    const usedIndexFirst = Boolean(modelOutput?.usedIndexFirst);
    const logEntry = modelOutput?.log_entry;
    if (!answerMarkdown || !saveCandidate || !logEntry) {
        db.prepare('UPDATE jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?').run('failed', 'LLM output missing required fields for query.', new Date().toISOString(), jobId);
        throw new Error('LLM query output missing required fields.');
    }
    await (0, write_1.appendWikiLog)({ wikiDir, logEntryMarkdown: logEntry });
    db.prepare('UPDATE jobs SET status = ?, finished_at = ? WHERE id = ?').run('success', new Date().toISOString(), jobId);
    db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(jobId, 'job_finished', JSON.stringify({ savedProposed: Boolean(saveCandidate?.should_save) }), new Date().toISOString());
    return {
        jobId,
        question,
        answerMarkdown,
        citations,
        usedIndexFirst,
        usedWikiSlugs,
        saveCandidate,
        compilation: {
            operation: 'query',
            jobId,
            model: config.model,
            providerBaseUrl: config.api_base_url,
            pagesCreated: [],
            pagesUpdated: [],
            indexUpdated: false,
            logAppended: true,
            warnings: [],
            durationMs: Date.now() - started,
        },
    };
}
async function saveQueryCandidate(params) {
    const config = await (0, load_config_1.loadConfig)();
    const db = (0, db_1.initDb)();
    const { saveCandidate, extraLogEntryMarkdown } = params;
    if (!saveCandidate.should_save) {
        throw new Error('saveCandidate.should_save is false.');
    }
    const wikiDir = config.wiki_dir;
    const category = saveCandidate.category;
    const pageSlug = saveCandidate.slug;
    const pageMarkdown = saveCandidate.markdown;
    const pageTitle = saveCandidate.title;
    await (0, write_1.writeWikiPageFile)({
        wikiDir,
        category,
        slug: pageSlug,
        markdown: pageMarkdown,
    });
    const rawIndexEntry = saveCandidate.index_entry;
    const indexEntry = {
        slug: String(rawIndexEntry.slug),
        category: rawIndexEntry.category,
        title: String(rawIndexEntry.title),
        summary: String(rawIndexEntry.summary ?? ''),
        tags: Array.isArray(rawIndexEntry.tags) ? rawIndexEntry.tags : undefined,
        updatedAt: String(rawIndexEntry.updated_at ?? rawIndexEntry.updatedAt ?? new Date().toISOString().slice(0, 10)),
    };
    await (0, index_update_1.writeUpdatedIndexFile)({ wikiDir, entry: indexEntry });
    // Persist to DB
    const nowIso = new Date().toISOString();
    const pageId = uuid();
    const wikiPath = (0, paths_1.wikiPagePath)(wikiDir, category, pageSlug).replaceAll('\\', '/');
    const pageContentHash = (0, hash_1.sha256Hex)(pageMarkdown);
    // Basic overwrite semantics: if the slug already exists, update it.
    db.prepare('INSERT OR IGNORE INTO wiki_pages (id, slug, title, path, category, summary_line, content_hash, created_at, updated_at, generated_by, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(pageId, pageSlug, pageTitle, wikiPath, category, String(indexEntry.summary ?? ''), pageContentHash, nowIso, nowIso, 'query', pageMarkdown);
    db.prepare('UPDATE wiki_pages SET title = ?, path = ?, category = ?, summary_line = ?, content_hash = ?, updated_at = ?, generated_by = ?, content = ? WHERE slug = ?').run(pageTitle, wikiPath, category, String(indexEntry.summary ?? ''), pageContentHash, nowIso, 'query', pageMarkdown, pageSlug);
    // Update outgoing links based on [[wiki-links]] inside the saved page.
    // For MVP, we resolve to slugs only via slugify; lint will catch missing pages.
    const linkTitles = (0, shared_1.extractWikiLinks)(pageMarkdown);
    const outSlugs = linkTitles.map((t) => t.trim()).filter(Boolean).map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
    db.prepare('DELETE FROM wiki_links WHERE from_slug = ?').run(pageSlug);
    for (const toSlug of outSlugs) {
        db.prepare('INSERT OR IGNORE INTO wiki_links (from_slug, to_slug, created_at) VALUES (?, ?, ?)').run(pageSlug, toSlug, nowIso);
    }
    const logEntry = extraLogEntryMarkdown ?? `## [${new Date().toISOString().slice(0, 10)}] save | ${saveCandidate.title}\n- should_save: ${String(saveCandidate.should_save)}\n- slug: ${saveCandidate.slug}\n`;
    await (0, write_1.appendWikiLog)({ wikiDir, logEntryMarkdown: logEntry });
    // raw_to_wiki_refs: not modeled for query MVP (sources may be wiki pages and/or raw).
    return { slug: pageSlug, path: wikiPath };
}
//# sourceMappingURL=query.js.map