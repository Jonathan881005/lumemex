"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findRepoRoot = findRepoRoot;
exports.repoRootFromCwd = repoRootFromCwd;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function findRepoRoot(startDir) {
    let current = startDir;
    let pkgCandidate = null;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const schemaPath = node_path_1.default.join(current, 'SCHEMA.md');
        const pkgPath = node_path_1.default.join(current, 'package.json');
        if (node_fs_1.default.existsSync(schemaPath))
            return current;
        if (!pkgCandidate && node_fs_1.default.existsSync(pkgPath))
            pkgCandidate = current;
        const parent = node_path_1.default.dirname(current);
        if (parent === current)
            return pkgCandidate ?? startDir;
        current = parent;
    }
}
function repoRootFromCwd() {
    return findRepoRoot(process.cwd());
}
//# sourceMappingURL=repo-root.js.map