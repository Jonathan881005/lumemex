'use client';

import { useState } from 'react';

export default function IngestPage() {
  const [rawPath, setRawPath] = useState('raw/url/example--2026-05-06--<hash>.md');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runIngest() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawPath }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setResult(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Ingest</h2>
      <label>
        rawPath (relative to repo):
        <input
          value={rawPath}
          onChange={(e) => setRawPath(e.target.value)}
          style={{ width: '100%', marginTop: 6 }}
        />
      </label>
      <button onClick={runIngest} disabled={loading}>
        {loading ? 'Ingesting...' : 'Run Ingest'}
      </button>
      {error && <pre style={{ color: 'crimson' }}>{error}</pre>}
      {result && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

