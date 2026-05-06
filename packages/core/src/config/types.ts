export interface LumemexConfig {
  api_base_url: string;
  api_key: string;
  model: string;
  ingest_model?: string;
  query_model?: string;
  lint_model?: string;
  raw_dir: string;
  wiki_dir: string;
  max_tokens_per_compilation: number;
}

