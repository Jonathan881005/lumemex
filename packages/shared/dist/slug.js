"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugify = slugify;
function toAsciiLower(s) {
    // Best-effort: keep as-is for English titles; replace whitespace & punctuation.
    return (s ?? '').toString().toLowerCase();
}
/**
 * Convert a title-like string into a slug.
 * This is intentionally simple for MVP; we will refine once we see real data.
 */
function slugify(input) {
    const s = toAsciiLower(input)
        .replace(/['"]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return s;
}
//# sourceMappingURL=slug.js.map