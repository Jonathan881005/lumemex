import type { QueryResult } from '@lumemex/shared';
export declare function queryQuestion(question: string): Promise<QueryResult>;
export declare function saveQueryCandidate(params: {
    saveCandidate: NonNullable<QueryResult['saveCandidate']>;
    extraLogEntryMarkdown?: string;
}): Promise<{
    slug: string;
    path: string;
}>;
