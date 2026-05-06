'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import ReactMarkdown from 'react-markdown';

type GraphNode = {
  id: string;
  label: string;
  type: 'wiki' | 'raw' | 'meta';
  category?: string;
};

type GraphEdge = {
  source: string;
  target: string;
  kind: 'wiki-link' | 'source-of';
  weight?: number;
};

type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type WikiPageResponse = {
  slug: string;
  title: string;
  category: string;
  content: string;
  updated_at: string;
};

type LegendItem = { label: string; color: string };

const LEGEND_ITEMS: LegendItem[] = [
  { label: 'concept', color: '#3b82f6' },
  { label: 'summary', color: '#22c55e' },
  { label: 'synthesis', color: '#f59e0b' },
  { label: 'entity', color: '#8b5cf6' },
  { label: 'other', color: '#9ca3af' },
];

function nodeColor(category?: string): string {
  if (category === 'concept') return '#3b82f6'; // blue
  if (category === 'summary') return '#22c55e'; // green
  if (category === 'synthesis') return '#f59e0b'; // orange
  if (category === 'entity') return '#8b5cf6'; // purple
  return '#9ca3af'; // gray
}

function truncateLabel(label: string, maxChars = 12): string {
  if (!label) return '';
  if (label.length <= maxChars) return label;
  return `${label.slice(0, maxChars)}...`;
}

export default function GraphPage() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<WikiPageResponse | null>(null);
  const [pageLoading, setPageLoading] = useState(false);

  const wikiOnlyData = useMemo(() => {
    if (!graphData) return null;
    const nodes = graphData.nodes.filter((n) => n.type === 'wiki');
    const set = new Set(nodes.map((n) => n.id));
    const edges = graphData.edges.filter((e) => set.has(String(e.source)) && set.has(String(e.target)));
    return { nodes, edges };
  }, [graphData]);

  async function loadGraph() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/graph?showRaw=0');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const d = (await resp.json()) as GraphResponse;
      setGraphData(d);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function loadPage(slug: string) {
    setPageLoading(true);
    try {
      const resp = await fetch(`/api/pages/${encodeURIComponent(slug)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const d = (await resp.json()) as WikiPageResponse;
      setSelectedPage(d);
      setSelectedSlug(slug);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    loadGraph();
  }, []);

  useEffect(() => {
    if (!wikiOnlyData || !svgRef.current || !hostRef.current) return;

    const container = hostRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = Math.max(400, container.clientWidth);
    const height = 700;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);

    const nodes = wikiOnlyData.nodes.map((n) => ({ ...n })) as Array<
      GraphNode & { x?: number; y?: number; fx?: number | null; fy?: number | null }
    >;
    const links = wikiOnlyData.edges.map((e) => ({ ...e })) as Array<{
      source: string | (GraphNode & { id: string });
      target: string | (GraphNode & { id: string });
      kind: 'wiki-link' | 'source-of';
      weight?: number;
    }>;

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        'link',
        d3
          .forceLink<any, any>(links as any)
          .id((d: any) => d.id)
          .distance(90)
      )
      .force('charge', d3.forceManyBody().strength(-220))
      .force('collision', d3.forceCollide(20))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg
      .append('g')
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', 0.7)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 1.2);

    const node = svg
      .append('g')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 7)
      .attr('fill', (d) => nodeColor(d.category))
      .style('cursor', 'pointer');

    const label = svg
      .append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text((d) => truncateLabel(d.label, 12))
      .attr('font-size', 11)
      .attr('fill', '#334155')
      .attr('dx', 10)
      .attr('dy', 3);

    const tooltip = d3.select(tooltipRef.current);

    node
      .on('mouseover', (event, d: any) => {
        tooltip
          .style('display', 'block')
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY + 10}px`)
          .html(`<div><strong>${d.label}</strong></div><div>type: ${d.category ?? d.type}</div>`);
      })
      .on('mousemove', (event) => {
        tooltip.style('left', `${event.pageX + 10}px`).style('top', `${event.pageY + 10}px`);
      })
      .on('mouseout', () => {
        tooltip.style('display', 'none');
      })
      .on('click', (_event, d: any) => {
        loadPage(d.id);
      });

    (node as any).call(
      d3
        .drag<SVGCircleElement, any>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x ?? 0)
        .attr('y1', (d: any) => d.source.y ?? 0)
        .attr('x2', (d: any) => d.target.x ?? 0)
        .attr('y2', (d: any) => d.target.y ?? 0);

      node.attr('cx', (d: any) => d.x ?? 0).attr('cy', (d: any) => d.y ?? 0);

      label.attr('x', (d: any) => d.x ?? 0).attr('y', (d: any) => d.y ?? 0);
    });

    return () => {
      simulation.stop();
      tooltip.style('display', 'none');
    };
  }, [wikiOnlyData]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Graph</h2>
      <button onClick={loadGraph} disabled={loading}>
        {loading ? 'Loading graph...' : 'Reload Graph'}
      </button>
      {error && <pre style={{ color: 'crimson' }}>{error}</pre>}

      <div style={{ display: 'flex', width: '100%', gap: 12, minHeight: 720 }}>
        <div
          ref={hostRef}
          style={{
            width: '80%',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            position: 'relative',
            background: '#f8fafc',
            overflow: 'hidden',
          }}
        >
          {!wikiOnlyData?.nodes.length && !loading && (
            <div style={{ padding: 16, color: '#475569' }}>No wiki nodes found. Ingest data first.</div>
          )}
          <svg ref={svgRef} />
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              color: '#334155',
            }}
          >
            {LEGEND_ITEMS.map((item) => (
              <div
                key={item.label}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: item.color,
                    display: 'inline-block',
                  }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div
            ref={tooltipRef}
            style={{
              display: 'none',
              position: 'fixed',
              pointerEvents: 'none',
              zIndex: 10,
              background: '#0f172a',
              color: '#f8fafc',
              padding: '6px 8px',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
        </div>

        <aside
          style={{
            width: '20%',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 12,
            overflow: 'auto',
            background: '#ffffff',
          }}
        >
          {!selectedSlug && <p style={{ color: '#64748b' }}>Click a node to preview markdown.</p>}
          {pageLoading && <p>Loading page...</p>}
          {selectedPage && (
            <div style={{ display: 'grid', gap: 8 }}>
              <h3 style={{ margin: 0 }}>{selectedPage.title}</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>
                slug: {selectedPage.slug} | type: {selectedPage.category}
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

