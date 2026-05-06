"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeWikiPageFile = writeWikiPageFile;
exports.appendWikiLog = appendWikiLog;
exports.makeIndexLine = makeIndexLine;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("./paths");
async function writeWikiPageFile(params) {
    const { wikiDir, category, slug, markdown } = params;
    const dir = (0, paths_1.ensureWikiCategoryDir)(wikiDir, category);
    await promises_1.default.mkdir(dir, { recursive: true });
    const filePath = (0, paths_1.wikiPagePath)(wikiDir, category, slug);
    await promises_1.default.writeFile(filePath, markdown, 'utf8');
    return { path: filePath };
}
async function appendWikiLog(params) {
    const { wikiDir, logEntryMarkdown } = params;
    const logPath = node_path_1.default.join(wikiDir, 'log.md');
    const current = await promises_1.default.readFile(logPath, 'utf8');
    const next = current.trimEnd() + '\n\n' + logEntryMarkdown.trimEnd() + '\n';
    await promises_1.default.writeFile(logPath, next, 'utf8');
}
function makeIndexLine(params) {
    const tags = params.tags && params.tags.length ? ` | tags: ${params.tags.join(',')}` : '';
    return `- slug: ${params.slug} | category: ${params.category} | title: [[${params.title}]] | summary: ${params.summary} | updated_at: ${params.updatedAt}${tags}`;
}
//# sourceMappingURL=write.js.map