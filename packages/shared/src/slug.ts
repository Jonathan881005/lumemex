function toAsciiLower(s: string): string {
  // Best-effort: keep as-is for English titles; replace whitespace & punctuation.
  return (s ?? '').toString().toLowerCase();
}

/**
 * Convert a title-like string into a slug.
 * This is intentionally simple for MVP; we will refine once we see real data.
 */
export function slugify(input: string): string {
  const s = toAsciiLower(input)
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s;
}

