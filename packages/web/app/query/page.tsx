'use client';

import { useState } from 'react';

export default function QueryPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [saveCandidate, setSaveCandidate] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<any | null>(null);

  async function runQuery() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setAnswer(data.answerMarkdown);
      setSaveCandidate(data.saveCandidate ?? null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setAnswer(null);
      setSaveCandidate(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveProposed() {
    if (!saveCandidate) return;
    const ok = window.confirm(`Save proposed answer to wiki? (slug: ${saveCandidate.slug})`);
    if (!ok) return;
    setError(null);
    const resp = await fetch('/api/query/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveCandidate }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      setError(t || `HTTP ${resp.status}`);
      return;
    }
    const saved = await resp.json();
    setError(`Saved: ${saved.path}`);
  }

  async function runApiKeyTest() {
    setTestingKey(true);
    setApiTestResult(null);
    try {
      const resp = await fetch('/api/debug/test-key', { method: 'POST' });
      const body = await resp.json().catch(() => ({}));
      setApiTestResult({
        ok: resp.ok,
        statusCode: resp.status,
        body,
      });
    } catch (e: any) {
      setApiTestResult({
        ok: false,
        statusCode: 0,
        body: { message: String(e?.message ?? e) },
      });
    } finally {
      setTestingKey(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Query</h2>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={6}
        placeholder="Ask a question..."
        style={{ width: '100%' }}
      />
      <button onClick={runQuery} disabled={loading || !question.trim()}>
        {loading ? 'Running...' : 'Run Query'}
      </button>

      {error && <pre style={{ color: 'crimson' }}>{error}</pre>}

      {answer && (
        <div>
          <h3>Answer</h3>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f6f6', padding: 12 }}>{answer}</pre>
        </div>
      )}

      {saveCandidate?.should_save && (
        <div style={{ display: 'grid', gap: 8 }}>
          <h3>Proposed Save</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{`slug: ${saveCandidate.slug}\ncategory: ${saveCandidate.category}\ntitle: ${saveCandidate.title}`}</pre>
          <button onClick={saveProposed} disabled={loading}>
            Save proposed answer
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
        <h3 style={{ margin: 0 }}>API Key Diagnostic</h3>
        <button onClick={runApiKeyTest} disabled={testingKey}>
          {testingKey ? 'Testing API key...' : 'Test API Key'}
        </button>
        {apiTestResult && (
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 12, borderRadius: 8 }}>
            {JSON.stringify(apiTestResult, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

