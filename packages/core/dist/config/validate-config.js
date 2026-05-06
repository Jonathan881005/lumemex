"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = validateConfig;
function validateConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new Error('config.json is missing or invalid (expected a JSON object).');
    }
    const c = config;
    const requireString = (key) => {
        const v = c[key];
        if (typeof v !== 'string' || !v.trim()) {
            throw new Error(`config.json: "${key}" is required and must be a non-empty string.`);
        }
        return v;
    };
    const requireNumber = (key) => {
        const v = c[key];
        if (typeof v !== 'number' || !Number.isFinite(v)) {
            throw new Error(`config.json: "${key}" is required and must be a finite number.`);
        }
        return v;
    };
    const api_base_url = requireString('api_base_url');
    const api_key = requireString('api_key');
    const raw_dir = requireString('raw_dir');
    const wiki_dir = requireString('wiki_dir');
    const max_tokens_per_compilation = requireNumber('max_tokens_per_compilation');
    const model = typeof c.model === 'string' && c.model.trim() ? c.model : undefined;
    const ingest_model = typeof c.ingest_model === 'string' && c.ingest_model.trim() ? c.ingest_model : undefined;
    const query_model = typeof c.query_model === 'string' && c.query_model.trim() ? c.query_model : undefined;
    const lint_model = typeof c.lint_model === 'string' && c.lint_model.trim() ? c.lint_model : undefined;
    const resolvedModel = model || ingest_model || query_model || lint_model;
    if (!resolvedModel) {
        throw new Error('config.json must include either "model" or at least one of "ingest_model", "query_model", "lint_model".');
    }
    return {
        api_base_url,
        api_key,
        model: resolvedModel,
        ingest_model,
        query_model,
        lint_model,
        raw_dir,
        wiki_dir,
        max_tokens_per_compilation,
    };
}
//# sourceMappingURL=validate-config.js.map