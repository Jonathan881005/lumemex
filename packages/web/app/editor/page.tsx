'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

type PageListItem = {
  slug: string;
  title: string;
  category: string;
  updated_at: string;
};

type PageDetail = {
  slug: string;
  title: string;
  category: string;
  content: string;
  updated_at: string;
};

export default function EditorPage() {
  const [pages, setPages] = useState<PageListItem[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<PageDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (!detail) return false;
    return draft !== detail.content;
  }, [detail, draft]);

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    loadPage(selectedSlug);
  }, [selectedSlug]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isDirty || saving || !detail || !selectedSlug) return;
      void saveCurrent(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [isDirty, saving, detail, selectedSlug, draft]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  async function loadPages() {
    setLoadingList(true);
    setError(null);
    try {
      const resp = await fetch('/api/pages');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as { pages: PageListItem[] };
      setPages(data.pages ?? []);
      if (!selectedSlug && data.pages?.length) {
        setSelectedSlug(data.pages[0].slug);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoadingList(false);
    }
  }

  async function loadPage(slug: string) {
    setLoadingPage(true);
    setError(null);
    try {
      const resp = await fetch(`/api/pages/${encodeURIComponent(slug)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as PageDetail;
      setDetail(data);
      setDraft(data.content);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoadingPage(false);
    }
  }

  async function saveCurrent(silent = false) {
    if (!detail || !selectedSlug) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch(`/api/pages/${encodeURIComponent(selectedSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const res = (await resp.json()) as { updated_at: string };
      setDetail({ ...detail, content: draft, updated_at: res.updated_at });
      setPages((prev) =>
        prev.map((p) => (p.slug === selectedSlug ? { ...p, updated_at: res.updated_at } : p))
      );
      if (!silent) {
        showToast('Saved successfully');
      } else {
        setLastAutosavedAt(new Date().toLocaleTimeString('en-GB', { hour12: false }));
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setError(msg);
      if (!silent) showToast(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  function requestSelectSlug(nextSlug: string) {
    if (nextSlug === selectedSlug) return;
    if (isDirty) {
      const ok = window.confirm('You have unsaved changes. Leave?');
      if (!ok) return;
    }
    setSelectedSlug(nextSlug);
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Editor</h2>
      {error && <pre style={{ color: 'crimson', margin: 0 }}>{error}</pre>}
      {toast && (
        <div
          style={{
            position: 'fixed',
            right: 16,
            top: 16,
            background: '#0f766e',
            color: 'white',
            padding: '8px 10px',
            borderRadius: 8,
            zIndex: 20,
            fontSize: 13,
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, minHeight: 720 }}>
        <aside
          style={{
            width: '28%',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            overflow: 'auto',
            background: '#fff',
          }}
        >
          <div style={{ padding: 10, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>
            Wiki Pages {loadingList ? '(loading...)' : `(${pages.length})`}
          </div>
          {pages.map((p) => (
            <button
              key={p.slug}
              onClick={() => requestSelectSlug(p.slug)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderBottom: '1px solid #f1f5f9',
                padding: '10px 12px',
                background: selectedSlug === p.slug ? '#eef2ff' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {p.slug} · {p.category}
              </div>
            </button>
          ))}
        </aside>

        <section
          style={{
            width: '72%',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 12,
            background: '#fff',
            display: 'grid',
            gap: 8,
          }}
        >
          {!selectedSlug && <p style={{ color: '#64748b' }}>Select a wiki page to edit.</p>}
          {loadingPage && <p>Loading page...</p>}
          {detail && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{detail.title}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    slug: {detail.slug} · type: {detail.category}
                  </div>
                </div>
                <button onClick={() => void saveCurrent(false)} disabled={saving || !isDirty}>
                  {saving ? 'Saving...' : isDirty ? 'Save' : 'Saved'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setActiveTab('edit')}
                  style={{
                    background: activeTab === 'edit' ? '#e2e8f0' : '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  style={{
                    background: activeTab === 'preview' ? '#e2e8f0' : '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Preview
                </button>
              </div>
              {activeTab === 'edit' ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  style={{
                    width: '100%',
                    minHeight: 580,
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: 10,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                />
              ) : (
                <div
                  style={{
                    minHeight: 580,
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: 10,
                    overflow: 'auto',
                    background: '#fcfcfc',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  <ReactMarkdown>{draft}</ReactMarkdown>
                </div>
              )}
              {(saving || lastAutosavedAt) && (
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {saving ? 'Saving...' : `Last autosaved at ${lastAutosavedAt}`}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

