"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWikiLinkTitles = extractWikiLinkTitles;
exports.resolveWikiLinkTitlesToSlugs = resolveWikiLinkTitlesToSlugs;
const shared_1 = require("@lumemex/shared");
function extractWikiLinkTitles(markdown) {
    return (0, shared_1.extractWikiLinks)(markdown);
}
function resolveWikiLinkTitlesToSlugs(params) {
    const { linkTitles, byTitle, bySlug } = params;
    const resolvedSlugs = [];
    const missingTitles = [];
    const seen = new Set();
    for (const t0 of linkTitles) {
        const t = (t0 ?? '').trim();
        if (!t)
            continue;
        // If the title string already equals a slug in index, accept it.
        const bySlugHit = bySlug.get(t);
        if (bySlugHit) {
            if (!seen.has(bySlugHit.slug)) {
                resolvedSlugs.push(bySlugHit.slug);
                seen.add(bySlugHit.slug);
            }
            continue;
        }
        const byTitleHit = byTitle.get(t);
        if (byTitleHit) {
            if (!seen.has(byTitleHit.slug)) {
                resolvedSlugs.push(byTitleHit.slug);
                seen.add(byTitleHit.slug);
            }
            continue;
        }
        missingTitles.push(t);
    }
    return { resolvedSlugs, missingTitles };
}
//# sourceMappingURL=links.js.map