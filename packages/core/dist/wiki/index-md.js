"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIndexEntryLine = parseIndexEntryLine;
exports.readWikiIndex = readWikiIndex;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const shared_1 = require("@lumemex/shared");
function parseIndexEntryLine(line) {
    const trimmed = (line ?? '').trim();
    if (!trimmed || !trimmed.startsWith('-'))
        return null;
    // Example:
    // - slug: contrastive-learning | category: concept | title: [[Contrastive Learning]] | summary: ... | updated_at: 2026-05-06 | tags: ml,representation
    const parts = trimmed
        .replace(/^-+\s*/, '')
        .split('|')
        .map((p) => p.trim())
        .filter(Boolean);
    const get = (key) => {
        const part = parts.find((p) => p.toLowerCase().startsWith(`${key.toLowerCase()}:`));
        if (!part)
            return undefined;
        return part.slice(part.indexOf(':') + 1).trim();
    };
    const slug = get('slug');
    const categoryRaw = get('category');
    const titleRaw = get('title');
    if (!slug || !categoryRaw || !titleRaw)
        return null;
    const category = categoryRaw;
    if (!['entity', 'concept', 'summary', 'comparison', 'synthesis', 'query-answer', 'meta'].includes(category)) {
        return null;
    }
    // title: [[Some Title]]
    const m = titleRaw.match(/\[\[([^\]]+)\]\]/);
    const title = m?.[1]?.trim() || titleRaw.trim();
    const summary = get('summary');
    const updatedAt = get('updated_at') || get('updated_at:');
    const tagsRaw = get('tags');
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    return {
        slug: slug.trim() || (0, shared_1.slugify)(title),
        category,
        title,
        summary,
        updatedAt,
        tags,
    };
}
async function readWikiIndex(wikiDir) {
    const indexPath = node_path_1.default.join(wikiDir, 'index.md');
    const raw = await promises_1.default.readFile(indexPath, 'utf8');
    const entries = [];
    for (const line of raw.split(/\r?\n/)) {
        const e = parseIndexEntryLine(line);
        if (e)
            entries.push(e);
    }
    const bySlug = new Map();
    const byTitle = new Map();
    for (const e of entries) {
        bySlug.set(e.slug, e);
        byTitle.set(e.title, e);
    }
    return { entries, bySlug, byTitle };
}
//# sourceMappingURL=index-md.js.map