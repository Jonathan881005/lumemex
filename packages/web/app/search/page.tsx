'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

type SearchResult = {
  slug: string;
  title: string;
  category: string;
  snippet: string;
};

type WikiPageResponse = {
  slug: string;
  title: string;
  category: string;
  content: string;
  updated_at: string;
};

function categoryColor(category?: string): string {
  if (category === 'concept') return '#3b82f6';
  if (category === 'summary') return '#22c55e';
  if (category === 'synthesis') return '#f59e0b';
  if (category === 'entity') return '#8b5cf6';
  return '#9ca3af';
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 6).map(escapeRegExp);
  if (!terms.length) return text;
  const highlightRe = new RegExp(`(${terms.join('|')})`, 'ig');
  const checkRe = new RegExp(`^(${terms.join('|')})$`, 'i');
  const parts = text.split(highlightRe);
  return (
    <>
      {parts.map((part, idx) =>
        checkRe.test(part) ? (
          <mark key={idx} style={{ background: '#fde68a', padding: '0 1px' }}>
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </>
  );
}

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<WikiPageResponse | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didSearch, setDidSearch] = useState(false);

  useEffect(() => {
    const keyword = q.trim();
    const timer = setTimeout(() => {
      if (!keyword) {
        setResults([]);
        setDidSearch(false);
        setSelectedSlug(null);
        setSelectedPage(null);
        return;
      }
      void runSearch(keyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  async function runSearch(keyword: string) {
    setLoading(true);
    setError(null);
    setDidSearch(true);
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as { results?: SearchResult[] };
      const next = data.results ?? [];
      setResults(next);
      if (next.length > 0) {
        const slug = next[0].slug;
        setSelectedSlug(slug);
        await loadPage(slug);
      } else {
        setSelectedSlug(null);
        setSelectedPage(null);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function loadPage(slug: string) {
    setPageLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/pages/${encodeURIComponent(slug)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const page = (await resp.json()) as WikiPageResponse;
      setSelectedPage(page);
      setSelectedSlug(slug);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setPageLoading(false);
    }
  }

  const noResults = useMemo(() => didSearch && !loading && results.length === 0 && q.trim(), [didSearch, loading, results.length, q]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Search</h2>
      <style>{`@keyframes searchspin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search wiki..."
        style={{
          width: '100%',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          padding: '8px 10px',
        }}
      />
      {error && <pre style={{ color: 'crimson' }}>{error}</pre>}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569' }}>
          <span
            style={{
              width: 14,
              height: 14,
              border: '2px solid #cbd5e1',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'searchspin 0.8s linear infinite',
            }}
          />
          <span>Searching...</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, minHeight: 680 }}>
        <section
          style={{
            width: '45%',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            overflow: 'auto',
            background: '#fff',
          }}
        >
          {!q.trim() && <div style={{ padding: 14, color: '#64748b' }}>Type to search wiki pages.</div>}
          {noResults && (
            <div style={{ padding: 14, color: '#64748b' }}>
              No results for <strong>{q.trim()}</strong>
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.slug}
              onClick={() => loadPage(r.slug)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderBottom: '1px solid #f1f5f9',
                padding: '10px 12px',
                background: selectedSlug === r.slug ? '#eef2ff' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>{highlightText(r.title, q)}</div>
                <span
                  style={{
                    fontSize: 11,
                    color: 'white',
                    background: categoryColor(r.category),
                    borderRadius: 999,
                    padding: '2px 8px',
                    textTransform: 'lowercase',
                  }}
                >
                  {r.category}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                {highlightText(r.snippet || '', q)}
              </div>
            </button>
          ))}
        </section>

        <aside
          style={{
            width: '55%',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#fff',
            padding: 12,
            overflow: 'auto',
          }}
        >
          {!selectedPage && <p style={{ color: '#64748b' }}>Select a result to preview full markdown.</p>}
          {pageLoading && <p>Loading page...</p>}
          {selectedPage && (
            <div style={{ display: 'grid', gap: 8 }}>
              <h3 style={{ margin: 0 }}>{selectedPage.title}</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                {selectedPage.slug} · {selectedPage.category}
              </p>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                <ReactMarkdown>{selectedPage.content}</ReactMarkdown>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

