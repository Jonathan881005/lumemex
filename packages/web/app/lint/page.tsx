'use client';

import { useState } from 'react';

export default function LintPage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runLint() {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const resp = await fetch('/api/lint', { method: 'POST' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setReport(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Lint</h2>
      <button onClick={runLint} disabled={loading}>
        {loading ? 'Running...' : 'Run Lint'}
      </button>
      {error && <pre style={{ color: 'crimson' }}>{error}</pre>}
      {report && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(report, null, 2)}</pre>}
    </div>
  );
}

