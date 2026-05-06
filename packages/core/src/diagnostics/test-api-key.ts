import { loadConfig } from '../config/load-config';
import { createOpenAICompatibleClient } from '../llm/client';

export type ApiKeyTestResult =
  | {
      ok: true;
      model: string;
      providerBaseUrl: string;
      text: string;
    }
  | {
      ok: false;
      model: string;
      providerBaseUrl: string;
      statusCode?: number;
      errorBody: unknown;
    };

export async function testApiKey(): Promise<ApiKeyTestResult> {
  const config = await loadConfig();
  const model = config.query_model ?? config.model;
  const client = createOpenAICompatibleClient(config);

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
  } catch (e: any) {
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

