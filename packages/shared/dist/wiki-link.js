"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWikiLinks = extractWikiLinks;
exports.normalizeWikiLinkText = normalizeWikiLinkText;
const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;
/**
 * Extracts all wiki links like [[Some Title]] from a markdown string.
 * Returns the raw inner text (no slug resolution).
 */
function extractWikiLinks(markdown) {
    const out = [];
    const text = markdown ?? '';
    for (;;) {
        const m = WIKI_LINK_RE.exec(text);
        if (!m)
            break;
        out.push(m[1].trim());
    }
    return out;
}
function normalizeWikiLinkText(s) {
    return (s ?? '').trim();
}
//# sourceMappingURL=wiki-link.js.map