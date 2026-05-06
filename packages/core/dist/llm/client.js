"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOpenAICompatibleClient = createOpenAICompatibleClient;
exports.completeJson = completeJson;
const openai_1 = __importDefault(require("openai"));
function extractJsonObject(text) {
    const t = text ?? '';
    const firstBrace = t.indexOf('{');
    const lastBrace = t.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('Model output does not contain a JSON object.');
    }
    return t.slice(firstBrace, lastBrace + 1);
}
function createOpenAICompatibleClient(config) {
    return new openai_1.default({
        apiKey: config.api_key,
        baseURL: config.api_base_url,
    });
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function completeJson(params) {
    const { config, operation, systemPrompt, userPrompt, maxTokens } = params;
    const client = createOpenAICompatibleClient(config);
    const opModel = operation === 'ingest'
        ? config.ingest_model
        : operation === 'query'
            ? config.query_model
            : config.lint_model;
    const primaryModel = params.model ?? opModel ?? config.model;
    const fallbackModel = config.model;
    const runWithModel = async (model) => {
        const retryDelaysMs = [2000, 4000, 8000];
        for (let attempt = 0;; attempt++) {
            try {
                return await client.chat.completions.create({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.2,
                    max_tokens: maxTokens,
                });
            }
            catch (e) {
                const status = Number(e?.status ?? 0);
                const canRetry = status === 500 && attempt < retryDelaysMs.length;
                if (!canRetry)
                    throw e;
                const waitMs = retryDelaysMs[attempt];
                console.warn(`[retry ${attempt + 1}/3] 500 error, retrying in ${Math.round(waitMs / 1000)}s...`);
                await sleep(waitMs);
            }
        }
    };
    let resp;
    try {
        resp = await runWithModel(primaryModel);
    }
    catch (e) {
        const isNotFound = Number(e?.status ?? 0) === 404;
        const canFallback = fallbackModel && fallbackModel !== primaryModel;
        if (!isNotFound || !canFallback)
            throw e;
        resp = await runWithModel(fallbackModel);
    }
    const content = resp.choices?.[0]?.message?.content ?? '';
    const jsonText = extractJsonObject(content);
    return JSON.parse(jsonText);
}
//# sourceMappingURL=client.js.map