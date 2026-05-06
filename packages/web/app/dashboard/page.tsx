'use client';

import { useEffect, useMemo, useState } from 'react';

type StatsResponse = {
  raw: {
    total: number;
    byStatus: {
      pending: number;
      done: number;
      error: number;
    };
  };
  wiki: {
    total: number;
    byCategory: Record<string, number>;
  };
  links: {
    total: number;
  };
  lastIngestAt: string | null;
  recentLogLines: string[];
};

const categoryColor: Record<string, string> = {
  concept: '#3b82f6',
  summary: '#22c55e',
  synthesis: '#f59e0b',
  entity: '#8b5cf6',
};

const rawStatusColor: Record<string, string> = {
  pending: '#64748b',
  done: '#16a34a',
  error: '#dc2626',
};

function fmtDate(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleString();
}

function parseActivity(line: string): { time: string; op: string; title: string } | null {
  const m = line.match(/^##\s+\[([^\]]+)\]\s+([a-zA-Z-]+)\s+\|\s+(.+)$/);
  if (!m) return null;
  return { time: m[1], op: m[2], title: m[3] };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/stats');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as StatsResponse;
      setStats(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStats();
    const timer = setInterval(() => {
      void loadStats();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const categoryRows = useMemo(() => {
    if (!stats) return [];
    const entries = Object.entries(stats.wiki.byCategory);
    const max = Math.max(1, ...entries.map(([, n]) => n));
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([category, n]) => ({
        category,
        n,
        widthPct: Math.round((n / max) * 100),
        color: categoryColor[category] ?? '#9ca3af',
      }));
  }, [stats]);

  const rawRows = useMemo(() => {
    if (!stats) return [];
    const entries = Object.entries(stats.raw.byStatus);
    const total = Math.max(1, stats.raw.total);
    return entries.map(([status, n]) => ({
      status,
      n,
      pct: Math.round((n / total) * 100),
      color: rawStatusColor[status] ?? '#64748b',
    }));
  }, [stats]);

  const activities = useMemo(() => {
    if (!stats) return [];
    return stats.recentLogLines
      .map(parseActivity)
      .filter((x): x is { time: string; op: string; title: string } => Boolean(x))
      .reverse();
  }, [stats]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Dashboard</h2>
      {error && <pre style={{ color: 'crimson' }}>{error}</pre>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Card title="Raw Total" value={String(stats?.raw.total ?? 0)} />
        <Card title="Wiki Pages" value={String(stats?.wiki.total ?? 0)} />
        <Card title="Wiki Links" value={String(stats?.links.total ?? 0)} />
        <Card title="Last Ingest" value={fmtDate(stats?.lastIngestAt ?? null)} />
      </div>

      <div style={{ display: 'flex', gap: 12, minHeight: 420 }}>
        <section
          style={{
            width: '55%',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#fff',
            padding: 12,
            display: 'grid',
            gap: 12,
            alignContent: 'start',
          }}
        >
          <strong>Wiki Categories</strong>
          {categoryRows.map((r) => (
            <div key={r.category} style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{r.category}</span>
                <span>{r.n}</span>
              </div>
              <div style={{ width: '100%', height: 12, background: '#e2e8f0', borderRadius: 999 }}>
                <div
                  style={{
                    width: `${r.widthPct}%`,
                    height: '100%',
                    background: r.color,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ))}

          <strong style={{ marginTop: 10 }}>Raw Status</strong>
          {rawRows.map((r) => (
            <div key={r.status} style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{r.status}</span>
                <span>
                  {r.n} ({r.pct}%)
                </span>
              </div>
              <div style={{ width: '100%', height: 12, background: '#e2e8f0', borderRadius: 999 }}>
                <div
                  style={{
                    width: `${r.pct}%`,
                    height: '100%',
                    background: r.color,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ))}
          {loading && <div style={{ color: '#64748b', fontSize: 12 }}>Refreshing...</div>}
        </section>

        <aside
          style={{
            width: '45%',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#fff',
            padding: 12,
            overflow: 'auto',
          }}
        >
          <strong>Recent Activity (log.md)</strong>
          <div style={{ marginTop: 8 }}>
            {activities.length === 0 && (
              <div style={{ color: '#64748b', fontSize: 13 }}>No structured activity lines found.</div>
            )}
            {activities.map((a, idx) => (
              <div key={`${a.time}-${idx}`} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{a.time}</div>
                <div style={{ fontSize: 13 }}>
                  <strong>{a.op}</strong> | {a.title}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Card(props: { title: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        background: '#fff',
        padding: 12,
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ color: '#64748b', fontSize: 12 }}>{props.title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, wordBreak: 'break-word' }}>{props.value}</div>
    </div>
  );
}

