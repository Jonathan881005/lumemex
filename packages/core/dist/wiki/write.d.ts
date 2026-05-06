import type { WikiCategory } from '@lumemex/shared';
export declare function writeWikiPageFile(params: {
    wikiDir: string;
    category: WikiCategory;
    slug: string;
    markdown: string;
}): Promise<{
    path: string;
}>;
export declare function appendWikiLog(params: {
    wikiDir: string;
    logEntryMarkdown: string;
}): Promise<void>;
export declare function makeIndexLine(params: {
    slug: string;
    category: WikiCategory;
    title: string;
    summary: string;
    updatedAt: string;
    tags?: string[];
}): string;
