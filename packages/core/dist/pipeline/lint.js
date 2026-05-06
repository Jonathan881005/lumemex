"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLint = runLint;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_1 = require("../storage/db");
const load_config_1 = require("../config/load-config");
const index_md_1 = require("../wiki/index-md");
const log_1 = require("../wiki/log");
const write_1 = require("../wiki/write");
const lint_prompt_1 = require("../llm/prompts/lint.prompt");
const client_1 = require("../llm/client");
const repo_root_1 = require("../utils/repo-root");
function uuid() {
    return node_crypto_1.default.randomUUID();
}
function extractWikiLinksFromMarkdown(markdown) {
    const out = [];
    const re = /\[\[([^\]]+)\]\]/g;
    for (const m of markdown.matchAll(re)) {
        const t = String(m[1] ?? '').trim();
        if (t)
            out.push(t);
    }
    return out;
}
function hasSourcesSection(markdown) {
    if (!/^##\s+Sources\s*$/im.test(markdown))
        return false;
    const lines = markdown.split(/\r?\n/);
    const idx = lines.findIndex((line) => /^##\s+Sources\s*$/i.test(line.trim()));
    if (idx < 0)
        return false;
    let nextIdx = lines.length;
    for (let i = idx + 1; i < lines.length; i++) {
        if (/^##\s+/.test(lines[i].trim())) {
            nextIdx = i;
            break;
        }
    }
    return lines
        .slice(idx + 1, nextIdx)
        .some((line) => Boolean(line.trim()));
}
function withSourceTag(issue, source) {
    return {
        ...issue,
        description: `[${source}] ${issue.description}`,
        suggested_fix: `[${source}] ${issue.suggested_fix}`,
    };
}
function deterministicLint(pages) {
    const issues = [];
    const bySlug = new Map();
    const byTitle = new Map();
    const inboundCount = new Map();
    for (const p of pages) {
        bySlug.set(p.slug, p);
        byTitle.set(p.title, p);
        inboundCount.set(p.slug, 0);
    }
    for (const p of pages) {
        const content = p.content ?? '';
        if (!hasSourcesSection(content)) {
            issues.push(withSourceTag({
                type: 'missing-sources',
                severity: 'S2',
                pages: [p.slug],
                description: `Page "${p.slug}" is missing a non-empty ## Sources section.`,
                suggested_fix: `Add a ## Sources section with at least one raw source reference in "${p.slug}".`,
            }, 'deterministic'));
        }
        const linkTexts = [...new Set(extractWikiLinksFromMarkdown(content))];
        const brokenTargets = [];
        for (const linkText of linkTexts) {
            const bySlugTarget = bySlug.get(linkText);
            const byTitleTarget = byTitle.get(linkText);
            const targetSlug = bySlugTarget?.slug ?? byTitleTarget?.slug;
            if (!targetSlug) {
                brokenTargets.push(linkText);
                continue;
            }
            if (targetSlug !== p.slug) {
                inboundCount.set(targetSlug, Number(inboundCount.get(targetSlug) ?? 0) + 1);
            }
        }
        if (brokenTargets.length > 0) {
            issues.push(withSourceTag({
                type: 'broken-link',
                severity: 'S2',
                pages: [p.slug],
                description: `Page "${p.slug}" links to missing targets: ${brokenTargets.join(', ')}.`,
                suggested_fix: `Create the missing target pages or update invalid [[wiki-links]] in "${p.slug}".`,
            }, 'deterministic'));
        }
    }
    for (const p of pages) {
        if (Number(inboundCount.get(p.slug) ?? 0) === 0) {
            issues.push(withSourceTag({
                type: 'orphan',
                severity: 'S3',
                pages: [p.slug],
                description: `Page "${p.slug}" has no inbound links from other wiki pages.`,
                suggested_fix: `Add at least one inbound [[wiki-link]] to "${p.slug}" from a related page.`,
            }, 'deterministic'));
        }
    }
    return issues;
}
async function runLint() {
    const config = await (0, load_config_1.loadConfig)();
    const db = (0, db_1.initDb)();
    const wikiDir = config.wiki_dir;
    const repoRoot = (0, repo_root_1.repoRootFromCwd)();
    const schemaMd = await promises_1.default.readFile(node_path_1.default.join(repoRoot, 'SCHEMA.md'), 'utf8');
    const indexMd = await promises_1.default.readFile(node_path_1.default.join(wikiDir, 'index.md'), 'utf8');
    await (0, index_md_1.readWikiIndex)(wikiDir); // validate parse/format early (MVP)
    const logTail = await (0, log_1.readWikiLogTail)(wikiDir, 10);
    const jobId = uuid();
    db.prepare('INSERT INTO jobs (id, operation, status, started_at, model, provider_base_url) VALUES (?, ?, ?, ?, ?, ?)').run(jobId, 'lint', 'running', new Date().toISOString(), config.model, config.api_base_url);
    db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(jobId, 'job_started', JSON.stringify({}), new Date().toISOString());
    // Page metadata from DB (MVP).
    const pageMetaRows = db
        .prepare(`SELECT slug, category, title, updated_at, content
       FROM wiki_pages
       ORDER BY updated_at DESC
       LIMIT 80`)
        .all();
    const pageMetadata = pageMetaRows.map((r) => {
        const outLinks = (r.content ? (r.content.match(/\[\[([^\]]+)\]\]/g) ?? []) : []).slice(0, 60);
        return {
            slug: r.slug,
            category: r.category,
            title: r.title,
            updated_at: r.updated_at,
            out_links: outLinks,
            in_links: [],
        };
    });
    const samplePages = pageMetaRows.slice(0, 3).map((r) => ({ slug: r.slug, content: r.content }));
    const deterministicIssues = deterministicLint(pageMetaRows.map((r) => ({
        slug: String(r.slug),
        title: String(r.title),
        content: String(r.content ?? ''),
    })));
    const filledUserPrompt = lint_prompt_1.lintUserPromptTemplate
        .replaceAll('{{SCHEMA_MD}}', schemaMd)
        .replaceAll('{{INDEX_MD}}', indexMd)
        .replaceAll('{{LOG_TAIL}}', logTail)
        .replaceAll('{{PAGE_METADATA_JSON}}', JSON.stringify(pageMetadata))
        .replaceAll('{{SAMPLE_PAGES_JSON}}', JSON.stringify(samplePages));
    let modelOutput;
    try {
        modelOutput = await (0, client_1.completeJson)({
            config,
            operation: 'lint',
            systemPrompt: lint_prompt_1.lintSystemPrompt,
            userPrompt: filledUserPrompt,
            maxTokens: config.max_tokens_per_compilation,
        });
    }
    catch (e) {
        db.prepare('UPDATE jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?').run('failed', String(e?.message ?? e), new Date().toISOString(), jobId);
        db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(jobId, 'llm_failed', JSON.stringify({ message: e?.message ?? String(e) }), new Date().toISOString());
        throw e;
    }
    const logEntry = modelOutput?.log_entry;
    if (typeof logEntry !== 'string' || !logEntry.trim()) {
        throw new Error('LLM lint output missing log_entry.');
    }
    await (0, write_1.appendWikiLog)({ wikiDir, logEntryMarkdown: logEntry });
    db.prepare('UPDATE jobs SET status = ?, finished_at = ? WHERE id = ?').run('success', new Date().toISOString(), jobId);
    db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(jobId, 'job_finished', JSON.stringify({}), new Date().toISOString());
    return {
        issues: [
            ...deterministicIssues,
            ...((Array.isArray(modelOutput?.issues) ? modelOutput.issues : []).map((i) => withSourceTag({
                type: String(i?.type ?? 'unknown'),
                severity: String(i?.severity ?? 'S3'),
                pages: Array.isArray(i?.pages) ? i.pages.map((p) => String(p)) : [],
                description: String(i?.description ?? ''),
                suggested_fix: String(i?.suggested_fix ?? ''),
            }, 'llm'))),
        ],
        proposedActions: modelOutput?.proposed_actions ?? [],
    };
}
//# sourceMappingURL=lint.js.map