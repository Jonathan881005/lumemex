import fsSync from 'node:fs';
import path from 'node:path';

export function findRepoRoot(startDir: string): string {
  let current = startDir;
  let pkgCandidate: string | null = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const schemaPath = path.join(current, 'SCHEMA.md');
    const pkgPath = path.join(current, 'package.json');
    if (fsSync.existsSync(schemaPath)) return current;
    if (!pkgCandidate && fsSync.existsSync(pkgPath)) pkgCandidate = current;
    const parent = path.dirname(current);
    if (parent === current) return pkgCandidate ?? startDir;
    current = parent;
  }
}

export function repoRootFromCwd(): string {
  return findRepoRoot(process.cwd());
}

