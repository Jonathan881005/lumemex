"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readWikiLogTail = readWikiLogTail;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
async function readWikiLogTail(wikiDir, maxEntries = 10) {
    const logPath = node_path_1.default.join(wikiDir, 'log.md');
    const raw = await promises_1.default.readFile(logPath, 'utf8');
    const headerRe = /^##\s+\[[^\]]+\].*$/gm;
    const starts = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const m = headerRe.exec(raw);
        if (!m)
            break;
        starts.push(m.index);
    }
    if (starts.length === 0)
        return raw.slice(Math.max(0, raw.length - 8000));
    const lastStarts = starts.slice(Math.max(0, starts.length - maxEntries));
    const parts = [];
    for (let i = 0; i < lastStarts.length; i++) {
        const start = lastStarts[i];
        const end = i < lastStarts.length - 1 ? lastStarts[i + 1] : raw.length;
        parts.push(raw.slice(start, end).trim());
    }
    return parts.join('\n\n');
}
//# sourceMappingURL=log.js.map