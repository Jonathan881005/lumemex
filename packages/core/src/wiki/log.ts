import fs from 'node:fs/promises';
import path from 'node:path';

export async function readWikiLogTail(wikiDir: string, maxEntries = 10): Promise<string> {
  const logPath = path.join(wikiDir, 'log.md');
  const raw = await fs.readFile(logPath, 'utf8');

  const headerRe = /^##\s+\[[^\]]+\].*$/gm;
  const starts: number[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const m = headerRe.exec(raw);
    if (!m) break;
    starts.push(m.index);
  }

  if (starts.length === 0) return raw.slice(Math.max(0, raw.length - 8000));

  const lastStarts = starts.slice(Math.max(0, starts.length - maxEntries));
  const parts: string[] = [];
  for (let i = 0; i < lastStarts.length; i++) {
    const start = lastStarts[i];
    const end = i < lastStarts.length - 1 ? lastStarts[i + 1] : raw.length;
    parts.push(raw.slice(start, end).trim());
  }
  return parts.join('\n\n');
}

