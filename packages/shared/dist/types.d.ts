export interface RawItem {
    id: string;
    sourceType: 'url' | 'pdf' | 'txt' | 'md' | 'stdin';
    source: string;
    rawPath: string;
    title: string;
    ingestedAt: string;
    contentHash: string;
    byteSize: number;
    status: 'pending' | 'processing' | 'processed' | 'failed';
    lastError?: string;
    frontmatter: Record<string, unknown>;
}
export type WikiCategory = 'entity' | 'concept' | 'summary' | 'comparison' | 'synthesis' | 'query-answer' | 'meta';
export interface WikiPage {
    id: string;
    slug: string;
    title: string;
    path: string;
    category: WikiCategory;
    summaryLine: string;
    contentHash: string;
    outLinks: string[];
    inLinks?: string[];
    updatedAt: string;
    createdAt: string;
    sourceRawIds: string[];
    generatedBy: 'ingest' | 'query' | 'lint' | 'manual';
}
export interface GraphNode {
    id: string;
    label: string;
    type: 'wiki' | 'raw' | 'meta';
    category?: WikiCategory;
    degree?: number;
    updatedAt?: string;
}
export interface GraphEdge {
    source: string;
    target: string;
    kind: 'wiki-link' | 'source-of';
    weight?: number;
    createdAt?: string;
}
export interface CompilationResult {
    operation: 'ingest' | 'query' | 'lint';
    jobId: string;
    model: string;
    providerBaseUrl: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    pagesCreated: string[];
    pagesUpdated: string[];
    indexUpdated: boolean;
    logAppended: boolean;
    warnings: string[];
    durationMs: number;
}
export interface IngestResult {
    rawItemId: string;
    jobId: string;
    status: 'success' | 'partial' | 'failed';
    primarySummaryPageSlug?: string;
    touchedWikiSlugs: string[];
    crossRefAdded: number;
    compilation: CompilationResult;
    error?: string;
}
export interface QueryResult {
    jobId: string;
    question: string;
    answerMarkdown: string;
    citations: Array<{
        pageSlug: string;
        excerpt?: string;
    }>;
    usedIndexFirst: boolean;
    usedWikiSlugs: string[];
    saveCandidate?: {
        should_save: boolean;
        title: string;
        slug: string;
        category: 'query-answer';
        markdown: string;
        index_entry: {
            slug: string;
            category: 'query-answer';
            title: string;
            summary: string;
            tags?: string[];
            updated_at: string;
        };
    };
    savedAsWikiPage?: {
        slug: string;
        path: string;
    };
    compilation: CompilationResult;
}
