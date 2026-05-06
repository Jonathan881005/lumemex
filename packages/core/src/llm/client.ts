import OpenAI from 'openai';

import type { LumemexConfig } from '../config/types';

function extractJsonObject(text: string): string {
  const t = text ?? '';
  const firstBrace = t.indexOf('{');
  const lastBrace = t.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Model output does not contain a JSON object.');
  }
  return t.slice(firstBrace, lastBrace + 1);
}

export function createOpenAICompatibleClient(config: LumemexConfig): OpenAI {
  return new OpenAI({
    apiKey: config.api_key,
    baseURL: config.api_base_url,
  });
}

export async function completeJson(params: {
  config: LumemexConfig;
  operation: 'ingest' | 'query' | 'lint';
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  model?: string;
}): Promise<unknown> {
  const { config, operation, systemPrompt, userPrompt, maxTokens } = params;
  const client = createOpenAICompatibleClient(config);
  const opModel =
    operation === 'ingest'
      ? config.ingest_model
      : operation === 'query'
        ? config.query_model
        : config.lint_model;

  const primaryModel = params.model ?? opModel ?? config.model;
  const fallbackModel = config.model;

  const runWithModel = async (model: string) => {
    return client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
    });
  };

  let resp;
  try {
    resp = await runWithModel(primaryModel);
  } catch (e: any) {
    const isNotFound = Number(e?.status ?? 0) === 404;
    const canFallback = fallbackModel && fallbackModel !== primaryModel;
    if (!isNotFound || !canFallback) throw e;
    resp = await runWithModel(fallbackModel);
  }

  const content = resp.choices?.[0]?.message?.content ?? '';
  const jsonText = extractJsonObject(content);
  return JSON.parse(jsonText);
}

