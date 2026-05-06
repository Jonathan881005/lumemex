export interface FrontmatterParseResult {
    frontmatter: Record<string, unknown>;
    body: string;
}
/**
 * Very small YAML frontmatter parser for MVP:
 * - Supports simple `key: value` pairs.
 * - Ignores advanced YAML structures.
 */
export declare function parseYamlFrontmatter(markdown: string): FrontmatterParseResult;
