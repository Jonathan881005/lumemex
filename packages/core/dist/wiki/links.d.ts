import type { IndexEntry } from './index-md';
export declare function extractWikiLinkTitles(markdown: string): string[];
export declare function resolveWikiLinkTitlesToSlugs(params: {
    linkTitles: string[];
    byTitle: Map<string, IndexEntry>;
    bySlug: Map<string, IndexEntry>;
}): {
    resolvedSlugs: string[];
    missingTitles: string[];
};
