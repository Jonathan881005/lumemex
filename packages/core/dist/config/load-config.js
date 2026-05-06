"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const validate_config_1 = require("./validate-config");
const repo_root_1 = require("../utils/repo-root");
async function loadConfig(env = process.env) {
    const repoRoot = (0, repo_root_1.repoRootFromCwd)();
    const configPath = env.LUMEMEX_CONFIG_PATH?.trim() ||
        node_path_1.default.join(repoRoot, 'config.json');
    let raw;
    try {
        raw = await promises_1.default.readFile(configPath, 'utf8');
    }
    catch (e) {
        throw new Error(`Cannot read config.json at "${configPath}". ` +
            `Create it by copying config.example.json and filling api_key/model/provider settings.`);
    }
    const parsed = JSON.parse(raw);
    const validated = (0, validate_config_1.validateConfig)(parsed);
    // Normalize directories to absolute paths for later use.
    return {
        ...validated,
        raw_dir: node_path_1.default.isAbsolute(validated.raw_dir) ? validated.raw_dir : node_path_1.default.join(repoRoot, validated.raw_dir),
        wiki_dir: node_path_1.default.isAbsolute(validated.wiki_dir) ? validated.wiki_dir : node_path_1.default.join(repoRoot, validated.wiki_dir),
    };
}
//# sourceMappingURL=load-config.js.map