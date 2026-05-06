"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testApiKey = testApiKey;
const load_config_1 = require("../config/load-config");
const client_1 = require("../llm/client");
async function testApiKey() {
    const config = await (0, load_config_1.loadConfig)();
    const model = config.query_model ?? config.model;
    const client = (0, client_1.createOpenAICompatibleClient)(config);
    try {
        const resp = await client.chat.completions.create({
            model,
            messages: [{ role: 'user', content: 'say hello' }],
            max_tokens: 10,
            temperature: 0,
        });
        return {
            ok: true,
            model,
            providerBaseUrl: config.api_base_url,
            text: resp.choices?.[0]?.message?.content ?? '',
        };
    }
    catch (e) {
        return {
            ok: false,
            model,
            providerBaseUrl: config.api_base_url,
            statusCode: typeof e?.status === 'number' ? e.status : undefined,
            errorBody: {
                message: e?.message ?? String(e),
                status: e?.status,
                error: e?.error,
                headers: e?.headers,
                request_id: e?.request_id,
            },
        };
    }
}
//# sourceMappingURL=test-api-key.js.map