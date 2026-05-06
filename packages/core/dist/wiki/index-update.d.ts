import type { IndexEntry } from './index-md';
export declare function indexLineForEntry(entry: IndexEntry): string;
export declare function upsertIndexEntryLine(params: {
    indexMd: string;
    entry: IndexEntry;
}): string;
export declare function writeUpdatedIndexFile(params: {
    wikiDir: string;
    entry: IndexEntry;
}): Promise<void>;
