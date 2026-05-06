/**
 * Extracts all wiki links like [[Some Title]] from a markdown string.
 * Returns the raw inner text (no slug resolution).
 */
export declare function extractWikiLinks(markdown: string): string[];
export declare function normalizeWikiLinkText(s: string): string;
