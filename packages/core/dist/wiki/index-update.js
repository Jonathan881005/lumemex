"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexLineForEntry = indexLineForEntry;
exports.upsertIndexEntryLine = upsertIndexEntryLine;
exports.writeUpdatedIndexFile = writeUpdatedIndexFile;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const CATEGORY_TO_SECTION = {
    entity: 'Entities',
    concept: 'Concepts',
    summary: 'Summaries',
    comparison: 'Comparisons',
    synthesis: 'Syntheses',
    'query-answer': 'Query Answers',
    meta: 'Meta',
};
function indexLineForEntry(entry) {
    // Uses the canonical format required by SCHEMA.md.
    const tags = entry.tags && entry.tags.length ? ` | tags: ${entry.tags.join(',')}` : '';
    const updatedAt = entry.updatedAt ?? new Date().toISOString().slice(0, 10);
    const normalizedTitle = String(entry.title ?? '').replace(/^\[\[|\]\]$/g, '').trim();
    return `- slug: ${entry.slug} | category: ${entry.category} | title: [[${normalizedTitle}]] | summary: ${entry.summary ?? ''} | updated_at: ${updatedAt}${tags}`;
}
function upsertIndexEntryLine(params) {
    const { indexMd, entry } = params;
    const index = indexMd ?? '';
    const slugNeedle = `slug: ${entry.slug}`;
    if (index.includes(slugNeedle))
        return index;
    const section = CATEGORY_TO_SECTION[entry.category];
    const sectionRe = new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'm');
    const nextHeadingRe = /^##\s+/m;
    const m = index.match(sectionRe);
    if (!m || m.index == null) {
        // If the section doesn't exist, append at end.
        return index.trimEnd() + `\n\n${section ? `## ${section}\n` : ''}${indexLineForEntry(entry)}\n`;
    }
    const start = m.index;
    nextHeadingRe.lastIndex = start + m[0].length;
    const next = nextHeadingRe.exec(index);
    const insertPos = next ? next.index : index.length;
    const before = index.slice(0, insertPos).trimEnd();
    const after = index.slice(insertPos);
    // Insert right before next heading (so it's within section by construction).
    return before + '\n' + indexLineForEntry(entry) + '\n' + after;
}
async function writeUpdatedIndexFile(params) {
    const { wikiDir, entry } = params;
    const indexPath = node_path_1.default.join(wikiDir, 'index.md');
    const current = await promises_1.default.readFile(indexPath, 'utf8');
    const updated = upsertIndexEntryLine({ indexMd: current, entry });
    await promises_1.default.writeFile(indexPath, updated, 'utf8');
}
//# sourceMappingURL=index-update.js.map