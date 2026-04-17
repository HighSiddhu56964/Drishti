import { useEffect, useState, useMemo } from "react";
import type { NodeData, GraphPayload, WikiInfo, NodeDetails } from "../types";
import { getColor } from "../types";

interface Props {
  node: NodeData | null;
  graphData: GraphPayload | null;
  onClose: () => void;
  onNavigate: (node: NodeData) => void;
  onExpand: (nodeId: string, label: string) => void;
  expanding: boolean;
}

export default function IntelPanel({ node, graphData, onClose, onNavigate, onExpand, expanding }: Props) {
  const [wiki, setWiki] = useState<WikiInfo | null>(null);
  const [details, setDetails] = useState<NodeDetails | null>(null);
  const [loadingWiki, setLoadingWiki] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Build adjacency + connections
  const connections = useMemo(() => {
    if (!graphData || !node) return [];
    const byId: Record<string, NodeData> = {};
    graphData.nodes.forEach((n) => { byId[n.id] = n; });
    const conns: { node: NodeData; relationship: string }[] = [];
    graphData.edges.forEach((e) => {
      if (e.source === node.id && byId[e.target]) {
        conns.push({ node: byId[e.target], relationship: e.relationship });
      } else if (e.target === node.id && byId[e.source]) {
        conns.push({ node: byId[e.source], relationship: e.relationship });
      }
    });
    return conns;
  }, [graphData, node]);

  // Fetch wiki + AI details on node change
  useEffect(() => {
    if (!node) return;
    setLoadingWiki(true);
    setWiki(null);
    fetch(`/graph/entity/${encodeURIComponent(node.label || node.id)}`)
      .then((r) => r.json())
      .then((w: WikiInfo) => { setWiki(w); setLoadingWiki(false); })
      .catch(() => { setLoadingWiki(false); });

    setLoadingDetails(true);
    setDetails(null);
    fetch("/graph/node-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: node.label || node.id,
        type: node.type,
        description: node.properties?.description || "",
      }),
    })
      .then((r) => r.json())
      .then((d: NodeDetails) => { setDetails(d); setLoadingDetails(false); })
      .catch(() => { setLoadingDetails(false); });
  }, [node]);

  if (!node) return null;

  const col = getColor(node.type);
  const imageQuery = encodeURIComponent(node.label || node.id);

  return (
    <div className={`intel-panel ${node ? "open" : ""}`}>
      {/* ═══ HEADER ═══ */}
      <div className="ip-header">
        <div className="ip-header-glow" style={{ background: `radial-gradient(ellipse at 30% 0%, ${col}22 0%, transparent 70%)` }} />
        <div className="ip-header-content">
          <div className="ip-title-wrap">
            <h1 className="ip-title">{node.label || node.id}</h1>
            <div className="ip-badge" style={{ background: col + "22", color: col, border: `1px solid ${col}44` }}>
              {(node.type || "entity").toUpperCase()}
            </div>
            {node.properties?.importance && (
              <div className="ip-importance">
                <span className="ip-imp-bar" style={{ width: `${(node.properties.importance as number) * 10}%`, background: col }} />
                <span className="ip-imp-label">Importance: {node.properties.importance}/10</span>
              </div>
            )}
          </div>
          <button className="ip-close" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* ═══ MEDIA ═══ */}
      <div className="ip-media">
        <img
          className="ip-thumb"
          src={wiki?.thumbnail || `https://source.unsplash.com/featured/?${imageQuery}`}
          alt={node.label}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      {/* ═══ BODY (SCROLLABLE) ═══ */}
      <div className="ip-body">

        {/* Stat cards */}
        <div className="ip-stats">
          <div className="ip-stat-card" style={{ borderTop: `3px solid ${col}` }}>
            <div className="ip-stat-num" style={{ color: col }}>{(node.type || "Entity").toUpperCase()}</div>
            <div className="ip-stat-label">Classification</div>
          </div>
          <div className="ip-stat-card" style={{ borderTop: "3px solid #a78bfa" }}>
            <div className="ip-stat-num" style={{ color: "#a78bfa" }}>{connections.length}</div>
            <div className="ip-stat-label">Connections</div>
          </div>
          <div className="ip-stat-card" style={{ borderTop: "3px solid #34d399" }}>
            <div className="ip-stat-num" style={{ color: "#34d399" }}>{node.properties?.importance || "—"}</div>
            <div className="ip-stat-label">Importance</div>
          </div>
          <div className="ip-stat-card" style={{ borderTop: "3px solid #38bdf8" }}>
            <div className="ip-stat-num" style={{ color: "#38bdf8" }}>{graphData?.meta?.dataSource === "gdelt" ? "GDELT" : "AI"}</div>
            <div className="ip-stat-label">Source</div>
          </div>
        </div>

        {/* Expand button */}
        <button
          className="ip-expand-btn"
          onClick={() => onExpand(node.id, node.label || node.id)}
          disabled={expanding}
        >
          {expanding ? (
            <>
              <span className="ip-expand-spinner" /> Expanding Graph...
            </>
          ) : (
            <>🔗 Expand Knowledge Graph</>
          )}
        </button>

        {/* ═══ SECTION 1: FULL DESCRIPTION ═══ */}
        <div className="ip-section">
          <div className="ip-section-title">
            <span className="ip-section-icon">📋</span> Intelligence Overview
          </div>
          {loadingDetails ? (
            <div className="ip-loading-mini"><div className="ip-spinner-sm" /><span>Generating AI analysis...</span></div>
          ) : (
            <div className="ip-desc">
              {details?.fullDescription || wiki?.extract || node.properties?.description || "Intelligence data is being processed."}
            </div>
          )}
        </div>

        {/* ═══ SECTION 2: RELATIONSHIPS ═══ */}
        {connections.length > 0 && (
          <div className="ip-section">
            <div className="ip-section-title">
              <span className="ip-section-icon">🔗</span> Network Connections ({connections.length})
            </div>
            <div className="ip-conn-list">
              {connections.map((conn, i) => (
                <div key={i} className="ip-conn" onClick={() => onNavigate(conn.node)}>
                  <div className="ip-conn-dot" style={{ background: getColor(conn.node.type) }} />
                  <div className="ip-conn-info">
                    <span className="ip-conn-name">{conn.node.label || conn.node.id}</span>
                    <span className="ip-conn-type">{(conn.node.type || "entity").toUpperCase()}</span>
                  </div>
                  <span className="ip-conn-rel">{conn.relationship.toUpperCase().replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SECTION 3: GLOBAL CONTEXT ═══ */}
        <div className="ip-section">
          <div className="ip-section-title">
            <span className="ip-section-icon">🌍</span> Global Impact Analysis
          </div>
          {loadingDetails ? (
            <div className="ip-loading-mini"><div className="ip-spinner-sm" /><span>Analyzing global impact...</span></div>
          ) : details?.globalImpact ? (
            <div className="ip-impact-grid">
              <div className="ip-impact-card">
                <div className="ip-impact-header" style={{ color: "#34d399" }}>💰 Economy</div>
                <p>{details.globalImpact.economy}</p>
              </div>
              <div className="ip-impact-card">
                <div className="ip-impact-header" style={{ color: "#818cf8" }}>🏛️ Geopolitics</div>
                <p>{details.globalImpact.geopolitics}</p>
              </div>
              <div className="ip-impact-card">
                <div className="ip-impact-header" style={{ color: "#f59e0b" }}>📦 Trade</div>
                <p>{details.globalImpact.trade}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* ═══ SECTION 4: TIMELINE ═══ */}
        {details?.timeline && details.timeline.length > 0 && (
          <div className="ip-section">
            <div className="ip-section-title">
              <span className="ip-section-icon">📅</span> Event Timeline
            </div>
            <div className="ip-timeline">
              {details.timeline.map((item, i) => (
                <div key={i} className="ip-timeline-item">
                  <div className="ip-timeline-dot" style={{ background: col }} />
                  <div className="ip-timeline-line" />
                  <div className="ip-timeline-content">
                    <span className="ip-timeline-year">{item.year}</span>
                    <span className="ip-timeline-event">{item.event}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SECTION 5: KEY INSIGHTS ═══ */}
        {details?.insights && details.insights.length > 0 && (
          <div className="ip-section">
            <div className="ip-section-title">
              <span className="ip-section-icon">⚡</span> Key Insights
            </div>
            <div className="ip-insights-list">
              {details.insights.map((insight, i) => (
                <div key={i} className="ip-insight">
                  <span className="ip-insight-bullet" style={{ color: col }}>▸</span>
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SECTION 6: LINKS ═══ */}
        <div className="ip-section">
          {wiki?.url && (
            <a className="ip-wiki-link" href={wiki.url} target="_blank" rel="noreferrer">
              🌐 Full article on Wikipedia
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
