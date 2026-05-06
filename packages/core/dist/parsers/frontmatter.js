"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseYamlFrontmatter = parseYamlFrontmatter;
/**
 * Very small YAML frontmatter parser for MVP:
 * - Supports simple `key: value` pairs.
 * - Ignores advanced YAML structures.
 */
function parseYamlFrontmatter(markdown) {
    const raw = markdown ?? '';
    const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
    if (!m) {
        return { frontmatter: {}, body: raw };
    }
    const fmText = m[1];
    const body = raw.slice(m.index + m[0].length);
    const frontmatter = {};
    for (const line of fmText.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const idx = trimmed.indexOf(':');
        if (idx === -1)
            continue;
        const key = trimmed.slice(0, idx).trim();
        const valueRaw = trimmed.slice(idx + 1).trim();
        // Strip surrounding quotes.
        const value = valueRaw.startsWith('"') && valueRaw.endsWith('"')
            ? valueRaw.slice(1, -1)
            : valueRaw.startsWith("'") && valueRaw.endsWith("'")
                ? valueRaw.slice(1, -1)
                : valueRaw;
        frontmatter[key] = value;
    }
    return { frontmatter, body };
}
//# sourceMappingURL=frontmatter.js.map