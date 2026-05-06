import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h1>lumemex</h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/query">Query</Link>
        <Link href="/ingest">Ingest</Link>
        <Link href="/lint">Lint</Link>
        <Link href="/graph">Graph</Link>
        <Link href="/editor">Editor</Link>
        <Link href="/search">Search</Link>
      </div>
      <p>Local knowledge base workbench.</p>
    </div>
  );
}

