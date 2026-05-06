import fs from 'node:fs/promises';
import path from 'node:path';
import { validateConfig } from './validate-config';
import type { LumemexConfig } from './types';
import { repoRootFromCwd } from '../utils/repo-root';

export async function loadConfig(env = process.env): Promise<LumemexConfig> {
  const repoRoot = repoRootFromCwd();

  const configPath =
    (env.LUMEMEX_CONFIG_PATH as string | undefined)?.trim() ||
    path.join(repoRoot, 'config.json');

  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch (e) {
    throw new Error(
      `Cannot read config.json at "${configPath}". ` +
        `Create it by copying config.example.json and filling api_key/model/provider settings.`
    );
  }

  const parsed = JSON.parse(raw) as unknown;
  const validated = validateConfig(parsed);

  // Normalize directories to absolute paths for later use.
  return {
    ...validated,
    raw_dir: path.isAbsolute(validated.raw_dir) ? validated.raw_dir : path.join(repoRoot, validated.raw_dir),
    wiki_dir: path.isAbsolute(validated.wiki_dir) ? validated.wiki_dir : path.join(repoRoot, validated.wiki_dir),
  };
}

