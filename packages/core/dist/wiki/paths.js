"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wikiPagePath = wikiPagePath;
exports.ensureWikiCategoryDir = ensureWikiCategoryDir;
const node_path_1 = __importDefault(require("node:path"));
const CATEGORY_TO_DIR = {
    entity: 'entity',
    concept: 'concept',
    summary: 'summary',
    comparison: 'comparison',
    synthesis: 'synthesis',
    'query-answer': 'query-answer',
    meta: 'meta',
};
function wikiPagePath(wikiDir, category, slug) {
    const subDir = CATEGORY_TO_DIR[category];
    return node_path_1.default.join(wikiDir, subDir, `${slug}.md`);
}
function ensureWikiCategoryDir(wikiDir, category) {
    const subDir = CATEGORY_TO_DIR[category];
    const dir = node_path_1.default.join(wikiDir, subDir);
    return dir;
}
//# sourceMappingURL=paths.js.map