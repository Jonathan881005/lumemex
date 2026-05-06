"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestOneRawPath = ingestOneRawPath;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const shared_1 = require("@lumemex/shared");
const hash_1 = require("../utils/hash");
const load_config_1 = require("../config/load-config");
const db_1 = require("../storage/db");
const index_md_1 = require("../wiki/index-md");
const log_1 = require("../wiki/log");
const frontmatter_1 = require("../parsers/frontmatter");
const write_1 = require("../wiki/write");
const index_update_1 = require("../wiki/index-update");
const paths_1 = require("../wiki/paths");
const links_1 = require("../wiki/links");
const ingest_prompt_1 = require("../llm/prompts/ingest.prompt");
const client_1 = require("../llm/client");
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
    for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll(`{{${k}}}`, v);
    }
    return out;
}
async function ingestOneRawPath(rawPathRelativeToRepo, options) {
    const force = Boolean(options?.force);
    const config = await (0, load_config_1.loadConfig)();
    const db = (0, db_1.initDb)();
    const wikiDir = config.wiki_dir;
    const repoRoot = (0, repo_root_1.repoRootFromCwd)();
    const schemaMd = await promises_1.default.readFile(node_path_1.default.join(repoRoot, 'SCHEMA.md'), 'utf8');
    const index = await (0, index_md_1.readWikiIndex)(wikiDir);
    const logTail = await (0, log_1.readWikiLogTail)(wikiDir, 10);
    const rawAbsPath = node_path_1.default.isAbsolute(rawPathRelativeToRepo)
        ? rawPathRelativeToRepo
        : node_path_1.default.join(repoRoot, rawPathRelativeToRepo);
    const rawContent = await promises_1.default.readFile(rawAbsPath, 'utf8');
    const { frontmatter, body } = (0, frontmatter_1.parseYamlFrontmatter)(rawContent);
    const source = String(frontmatter['source'] ?? '');
    const title = String(frontmatter['title'] ?? '');
    const ingestedAt = String(frontmatter['ingested_at'] ?? '');
    if (!source || !title || !ingestedAt) {
        throw new Error('raw frontmatter must include: source, title, ingested_at');
    }
    const contentHash = (0, hash_1.sha256Hex)(body);
    const byteSize = Buffer.byteLength(body, 'utf8');
    const rawPathNormalized = node_path_1.default.relative(repoRoot, rawAbsPath).replaceAll('\\', '/');
    const existing = db
        .prepare('SELECT id, status, content_hash FROM raw_items WHERE raw_path = ?')
        .get(rawPathNormalized);
    if (!force && existing && existing.status === 'processed' && existing.content_hash === contentHash) {
        return {
            rawItemId: existing.id,
            jobId: '',
            status: 'success',
            touchedWikiSlugs: [],
            crossRefAdded: 0,
            compilation: {
                operation: 'ingest',
                jobId: '',
                model: config.model,
                providerBaseUrl: config.api_base_url,
                pagesCreated: [],
                pagesUpdated: [],
                indexUpdated: false,
                logAppended: false,
                warnings: [],
                durationMs: 0,
            },
        };
    }
    const rawItemId = existing?.id ?? uuid();
    const jobId = uuid();
    db.prepare('INSERT INTO jobs (id, operation, status, started_at, model, provider_base_url) VALUES (?, ?, ?, ?, ?, ?)').run(jobId, 'ingest', 'running', new Date().toISOString(), config.model, config.api_base_url);
    db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(jobId, 'job_started', JSON.stringify({ rawPath: rawPathNormalized, rawTitle: title }), new Date().toISOString());
    // Insert/mark raw item
    if (!existing) {
        db.prepare('INSERT INTO raw_items (id, source_type, source, raw_path, title, ingested_at, content_hash, byte_size, status, content, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(rawItemId, inferSourceTypeFromRawPath(rawPathNormalized), source, rawPathNormalized, title, ingestedAt, contentHash, byteSize, 'processing', body, null);
    }
    else {
        db.prepare('UPDATE raw_items SET status = ?, content_hash = ?, byte_size = ?, content = ?, last_error = ? WHERE id = ?').run('processing', contentHash, byteSize, body, null, rawItemId);
    }
    const rawItemJson = JSON.stringify({
        id: rawItemId,
        rawPath: rawPathNormalized,
        title,
        ingestedAt,
        frontmatter,
        content: truncateForPrompt(body, 18000),
    });
    // Related wiki pages: try FTS only if DB has wiki content.
    const relatedPages = db
        .prepare('SELECT slug, title, path, category, content FROM wiki_pages ORDER BY updated_at DESC LIMIT 6')
        .all();
    const allWikiContentRows = db.prepare('SELECT title, content FROM wiki_pages').all();
    const preExistingWikiText = allWikiContentRows.map((r) => `${r.title}\n${r.content ?? ''}`).join('\n\n');
    const relatedPagesJson = JSON.stringify(relatedPages.map((p) => ({
        slug: p.slug,
        title: p.title,
        path: p.path,
        category: p.category,
        content: truncateForPrompt(p.content ?? '', 12000),
    })));
    const existingWikiPagesJson = JSON.stringify(index.entries.map((e) => ({
        slug: e.slug,
        title: e.title,
        category: e.category,
    })));
    const userPrompt = fillTemplate(ingest_prompt_1.ingestUserPromptTemplate, {
        SCHEMA_MD: schemaMd,
        INDEX_MD: await promises_1.default.readFile(node_path_1.default.join(wikiDir, 'index.md'), 'utf8'),
        LOG_TAIL: logTail,
        EXISTING_WIKI_PAGES_JSON: existingWikiPagesJson,
        RELATED_PAGES_JSON: relatedPagesJson,
        RAW_ITEM_JSON: rawItemJson,
        MAX_TOKENS: String(config.max_tokens_per_compilation ?? 8000),
    });
    const started = Date.now();
    let modelOutput;
    try {
        modelOutput = await (0, client_1.completeJson)({
            config,
            operation: 'ingest',
            systemPrompt: ingest_prompt_1.ingestSystemPrompt,
            userPrompt,
            maxTokens: config.max_tokens_per_compilation,
        });
    }
    catch (e) {
        db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(jobId, 'llm_failed', JSON.stringify({ message: e?.message ?? String(e) }), new Date().toISOString());
        db.prepare('UPDATE jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?').run('failed', String(e?.message ?? e), new Date().toISOString(), jobId);
        db.prepare('UPDATE raw_items SET status = ?, last_error = ? WHERE id = ?').run('failed', String(e?.message ?? e), rawItemId);
        throw e;
    }
    const primary = modelOutput?.primary_page;
    const indexEntry = modelOutput?.index_entry;
    const logEntry = modelOutput?.log_entry;
    const secondaryUpdates = Array.isArray(modelOutput?.secondary_updates) ? modelOutput.secondary_updates : [];
    if (!primary || !primary.slug || !primary.title || !primary.category || !primary.markdown || !indexEntry || !logEntry) {
        db.prepare('UPDATE jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?').run('failed', 'LLM output missing required fields for ingest.', new Date().toISOString(), jobId);
        throw new Error('LLM ingest output missing required fields.');
    }
    const touchedWikiSlugs = [];
    const pagesCreated = [];
    const pagesUpdated = [];
    const pageMarkdownBySlug = new Map();
    // Write primary page first.
    const primaryCategory = primary.category;
    const primaryMarkdown = String(primary.markdown);
    const primarySlug = String(primary.slug);
    const primaryTitle = String(primary.title);
    const nowIso = new Date().toISOString();
    const updatedAt = (String(indexEntry.updated_at ?? indexEntry.updatedAt ?? '').trim() ||
        new Date().toISOString().slice(0, 10));
    // Update wiki/index.md (fixed-field index) for primary.
    const entryForIndex = {
        slug: String(indexEntry.slug ?? primarySlug),
        category: primaryCategory,
        title: String(indexEntry.title ?? primaryTitle),
        summary: String(indexEntry.summary ?? ''),
        updatedAt: String(indexEntry.updated_at ?? indexEntry.updatedAt ?? updatedAt).slice(0, 10),
        tags: Array.isArray(indexEntry.tags) ? indexEntry.tags : undefined,
    };
    await upsertWikiPageAndIndex({
        db,
        wikiDir,
        slug: primarySlug,
        title: primaryTitle,
        category: primaryCategory,
        markdown: primaryMarkdown,
        summary: String(entryForIndex.summary ?? ''),
        tags: entryForIndex.tags,
        nowIso,
        onCreated: (slug) => pagesCreated.push(slug),
        onUpdated: (slug) => pagesUpdated.push(slug),
    });
    pageMarkdownBySlug.set(primarySlug, primaryMarkdown);
    touchedWikiSlugs.push(primarySlug);
    // Apply secondary updates returned by the model.
    for (const u of secondaryUpdates) {
        const slug = String(u?.slug ?? '').trim();
        const markdown = String(u?.markdown ?? u?.patch_markdown ?? '').trim();
        if (!slug || !markdown)
            continue;
        const existingPage = db
            .prepare('SELECT title, category FROM wiki_pages WHERE slug = ?')
            .get(slug);
        const titleForUpdate = String(u?.title ?? existingPage?.title ?? slug).trim();
        const categoryForUpdate = String(u?.category ?? existingPage?.category ?? 'concept');
        await upsertWikiPageAndIndex({
            db,
            wikiDir,
            slug,
            title: titleForUpdate,
            category: categoryForUpdate,
            markdown,
            summary: String(u?.added_paragraph_summary ?? u?.reason ?? ''),
            tags: undefined,
            nowIso,
            onCreated: (createdSlug) => pagesCreated.push(createdSlug),
            onUpdated: (updatedSlug) => pagesUpdated.push(updatedSlug),
        });
        pageMarkdownBySlug.set(slug, markdown);
        touchedWikiSlugs.push(slug);
    }
    await (0, write_1.appendWikiLog)({ wikiDir, logEntryMarkdown: logEntry });
    // Re-read index after all page writes so link title -> slug resolution includes new pages.
    const freshIndex = await (0, index_md_1.readWikiIndex)(wikiDir);
    let crossRefAdded = 0;
    for (const slug of new Set(touchedWikiSlugs)) {
        const markdown = pageMarkdownBySlug.get(slug) ?? '';
        const outLinkTitles = (0, shared_1.extractWikiLinks)(markdown).map((t) => t.trim());
        const { resolvedSlugs } = (0, links_1.resolveWikiLinkTitlesToSlugs)({
            linkTitles: outLinkTitles,
            byTitle: freshIndex.byTitle,
            bySlug: freshIndex.bySlug,
        });
        db.prepare('DELETE FROM wiki_links WHERE from_slug = ?').run(slug);
        for (const toSlug of resolvedSlugs.filter(Boolean)) {
            if (toSlug === slug)
                continue;
            db.prepare('INSERT OR IGNORE INTO wiki_links (from_slug, to_slug, created_at) VALUES (?, ?, ?)').run(slug, toSlug, nowIso);
            crossRefAdded += 1;
        }
    }
    // raw -> wiki refs for all touched pages.
    for (const slug of new Set(touchedWikiSlugs)) {
        db.prepare('INSERT OR IGNORE INTO raw_to_wiki_refs (raw_id, wiki_slug) VALUES (?, ?)').run(rawItemId, slug);
    }
    const warnings = validateIngestResult({
        rawBody: body,
        preExistingWikiText,
        pagesUpdated,
        pagesCreated,
        pageMarkdownBySlug,
        db,
    });
    db.prepare('UPDATE raw_items SET status = ?, last_error = ? WHERE id = ?').run('processed', null, rawItemId);
    db.prepare('UPDATE jobs SET status = ?, finished_at = ? WHERE id = ?').run('success', new Date().toISOString(), jobId);
    db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(jobId, 'job_finished', JSON.stringify({ pagesCreated, pagesUpdated, warnings }), new Date().toISOString());
    const durationMs = Date.now() - started;
    return {
        rawItemId,
        jobId,
        status: 'success',
        primarySummaryPageSlug: primarySlug,
        touchedWikiSlugs,
        crossRefAdded,
        compilation: {
            operation: 'ingest',
            jobId,
            model: config.model,
            providerBaseUrl: config.api_base_url,
            pagesCreated: [...new Set(pagesCreated)],
            pagesUpdated: [...new Set(pagesUpdated)],
            indexUpdated: true,
            logAppended: true,
            warnings,
            durationMs,
        },
    };
}
async function upsertWikiPageAndIndex(params) {
    const { db, wikiDir, slug, title, category, markdown, summary, tags, nowIso, onCreated, onUpdated } = params;
    const existing = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(slug);
    await (0, write_1.writeWikiPageFile)({ wikiDir, category, slug, markdown });
    await (0, index_update_1.writeUpdatedIndexFile)({
        wikiDir,
        entry: {
            slug,
            category,
            title,
            summary,
            updatedAt: nowIso.slice(0, 10),
            tags,
        },
    });
    if (existing) {
        db.prepare('UPDATE wiki_pages SET title = ?, path = ?, category = ?, summary_line = ?, content_hash = ?, updated_at = ?, generated_by = ?, content = ? WHERE slug = ?').run(title, (0, paths_1.wikiPagePath)(wikiDir, category, slug).replaceAll('\\', '/'), category, summary, (0, hash_1.sha256Hex)(markdown), nowIso, 'ingest', markdown, slug);
        onUpdated(slug);
        return;
    }
    db.prepare('INSERT INTO wiki_pages (id, slug, title, path, category, summary_line, content_hash, created_at, updated_at, generated_by, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uuid(), slug, title, (0, paths_1.wikiPagePath)(wikiDir, category, slug).replaceAll('\\', '/'), category, summary, (0, hash_1.sha256Hex)(markdown), nowIso, nowIso, 'ingest', markdown);
    onCreated(slug);
}
function validateIngestResult(params) {
    const { rawBody, preExistingWikiText, pagesUpdated, pagesCreated, pageMarkdownBySlug, db } = params;
    const warnings = [];
    const rawKeywords = keywordSet(rawBody);
    const wikiKeywords = keywordSet(preExistingWikiText);
    let overlapCount = 0;
    for (const k of rawKeywords) {
        if (wikiKeywords.has(k))
            overlapCount += 1;
    }
    if (pagesUpdated.length === 0 && overlapCount > 2) {
        warnings.push('[warn] No existing pages updated despite content overlap');
    }
    for (const [slug, markdown] of pageMarkdownBySlug.entries()) {
        if (!/\n##\s+Sources\s*$/m.test(`\n${markdown}`)) {
            warnings.push(`[warn] Missing ## Sources: ${slug}`);
        }
    }
    for (const slug of pagesCreated) {
        const inbound = db
            .prepare('SELECT COUNT(*) AS c FROM wiki_links WHERE to_slug = ? AND from_slug <> ?')
            .get(slug, slug);
        if (Number(inbound.c ?? 0) === 0) {
            warnings.push(`[warn] Orphan page: ${slug}`);
        }
    }
    for (const w of warnings) {
        console.warn(w);
    }
    return warnings;
}
function keywordSet(text) {
    const STOP_WORDS = new Set([
        'the',
        'and',
        'for',
        'with',
        'that',
        'this',
        'from',
        'into',
        'wiki',
        'page',
        'pages',
        'llm',
        'raw',
        'ingest',
        'query',
        'lint',
        'using',
        'about',
        'over',
        'than',
        'are',
        'was',
        'were',
        'have',
        'has',
        'will',
        'your',
        'their',
    ]);
    const tokens = (text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []).filter((t) => !STOP_WORDS.has(t));
    return new Set(tokens);
}
function inferSourceTypeFromRawPath(rawPath) {
    const p = rawPath.toLowerCase();
    if (p.includes('/url/'))
        return 'url';
    if (p.includes('/pdf/'))
        return 'pdf';
    if (p.includes('/txt/'))
        return 'txt';
    if (p.includes('/md/'))
        return 'md';
    return 'stdin';
}
//# sourceMappingURL=ingest.js.map