'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type RawListItem = {
  path: string; // relative to raw/
  size: number;
  mtime: string;
  ingestStatus: 'pending' | 'done' | 'error' | 'processing';
};

type BatchState = {
  status: 'idle' | 'processing' | 'done' | 'error';
  error?: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function badgeColor(status: RawListItem['ingestStatus'] | BatchState['status']): string {
  if (status === 'done') return '#16a34a';
  if (status === 'error') return '#dc2626';
  if (status === 'processing') return '#2563eb';
  return '#64748b';
}

export default function IngestPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [items, setItems] = useState<RawListItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [batch, setBatch] = useState<Record<string, BatchState>>({});
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPaths = useMemo(
    () => items.filter((i) => selected[i.path]).map((i) => i.path),
    [items, selected]
  );

  const doneCount = useMemo(
    () => Object.values(batch).filter((b) => b.status === 'done' || b.status === 'error').length,
    [batch]
  );

  useEffect(() => {
    void loadRawList();
  }, []);

  async function loadRawList() {
    setListLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/raw/list');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as { items?: RawListItem[] };
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setListLoading(false);
    }
  }

  async function runBatchIngest() {
    if (!selectedPaths.length || running) return;
    setRunning(true);
    setError(null);
    const nextBatch: Record<string, BatchState> = {};
    for (const p of selectedPaths) nextBatch[p] = { status: 'idle' };
    setBatch(nextBatch);

    for (const p of selectedPaths) {
      setBatch((prev) => ({ ...prev, [p]: { status: 'processing' } }));
      try {
        const resp = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawPath: `raw/${p}` }),
        });
        const bodyText = await resp.text();
        if (!resp.ok) {
          setBatch((prev) => ({ ...prev, [p]: { status: 'error', error: bodyText || `HTTP ${resp.status}` } }));
        } else {
          setBatch((prev) => ({ ...prev, [p]: { status: 'done' } }));
        }
      } catch (e: any) {
        setBatch((prev) => ({ ...prev, [p]: { status: 'error', error: String(e?.message ?? e) } }));
      }
    }

    setRunning(false);
    await loadRawList();
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) {
        form.append('files', f);
      }
      const resp = await fetch('/api/raw/upload', { method: 'POST', body: form });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || `HTTP ${resp.status}`);
      }
      await loadRawList();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setUploading(false);
    }
  }

  function onDrop(ev: any) {
    ev.preventDefault();
    setDragOver(false);
    const files = ev.dataTransfer.files;
    void uploadFiles(files);
  }

  function toggleAll(checked: boolean) {
    const next: Record<string, boolean> = {};
    for (const i of items) next[i.path] = checked;
    setSelected(next);
  }

  const progressPct = selectedPaths.length ? Math.round((doneCount / selectedPaths.length) * 100) : 0;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Ingest</h2>
      {error && <pre style={{ color: 'crimson', margin: 0 }}>{error}</pre>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`,
          borderRadius: 10,
          padding: 16,
          cursor: 'pointer',
          background: dragOver ? '#eff6ff' : '#f8fafc',
        }}
      >
        <strong>Upload raw files</strong>
        <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Drag and drop or click to select .md / .txt / .pdf
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md,.txt,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
        />
        {uploading && <div style={{ marginTop: 8 }}>Uploading...</div>}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <section
          style={{
            width: '60%',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#fff',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 10, borderBottom: '1px solid #e2e8f0' }}>
            <strong>raw/ files {listLoading ? '(loading...)' : `(${items.length})`}</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => toggleAll(true)}>Select all</button>
              <button onClick={() => toggleAll(false)}>Clear</button>
              <button onClick={() => void runBatchIngest()} disabled={running || selectedPaths.length === 0}>
                {running ? 'Ingesting...' : `Ingest Selected (${selectedPaths.length})`}
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 540, overflow: 'auto' }}>
            {items.map((i) => {
              const local = batch[i.path];
              const displayStatus = local?.status === 'idle' ? i.ingestStatus : local?.status ?? i.ingestStatus;
              return (
                <label
                  key={i.path}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr 90px 90px 130px',
                    gap: 8,
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selected[i.path])}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [i.path]: e.target.checked }))}
                  />
                  <span style={{ fontFamily: 'ui-monospace, monospace' }}>{i.path}</span>
                  <span>{formatBytes(i.size)}</span>
                  <span>{new Date(i.mtime).toLocaleDateString()}</span>
                  <span
                    style={{
                      color: 'white',
                      background: badgeColor(displayStatus),
                      borderRadius: 999,
                      fontSize: 12,
                      textAlign: 'center',
                      padding: '2px 8px',
                    }}
                  >
                    {displayStatus}
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <aside
          style={{
            width: '40%',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 12,
            background: '#fff',
            display: 'grid',
            gap: 10,
            alignContent: 'start',
          }}
        >
          <strong>Batch Progress</strong>
          <div style={{ color: '#475569', fontSize: 13 }}>
            {selectedPaths.length ? `${doneCount} / ${selectedPaths.length} completed` : 'No files selected'}
          </div>
          <div style={{ width: '100%', height: 10, background: '#e2e8f0', borderRadius: 999 }}>
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: '#2563eb',
                borderRadius: 999,
                transition: 'width 200ms ease',
              }}
            />
          </div>
          <div style={{ maxHeight: 480, overflow: 'auto' }}>
            {selectedPaths.map((p) => {
              const st = batch[p];
              return (
                <div key={p} style={{ borderBottom: '1px solid #f1f5f9', padding: '8px 0', fontSize: 13 }}>
                  <div style={{ fontFamily: 'ui-monospace, monospace' }}>{p}</div>
                  <div style={{ color: badgeColor(st?.status ?? 'idle') }}>
                    {st?.status ?? 'idle'}
                    {st?.error ? ` — ${st.error}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

