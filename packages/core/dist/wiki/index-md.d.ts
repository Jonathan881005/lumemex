import type { WikiCategory } from '@lumemex/shared';
export interface IndexEntry {
    slug: string;
    category: WikiCategory;
    title: string;
    summary?: string;
    updatedAt?: string;
    tags?: string[];
}
export declare function parseIndexEntryLine(line: string): IndexEntry | null;
export declare function readWikiIndex(wikiDir: string): Promise<{
    entries: IndexEntry[];
    bySlug: Map<string, IndexEntry>;
    byTitle: Map<string, IndexEntry>;
}>;
