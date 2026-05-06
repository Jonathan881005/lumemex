import OpenAI from 'openai';
import type { LumemexConfig } from '../config/types';
export declare function createOpenAICompatibleClient(config: LumemexConfig): OpenAI;
export declare function completeJson(params: {
    config: LumemexConfig;
    operation: 'ingest' | 'query' | 'lint';
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    model?: string;
}): Promise<unknown>;
