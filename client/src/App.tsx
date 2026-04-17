import { useState, useCallback, useRef } from "react";
import QueryBar from "./components/QueryBar";
import GraphCanvas from "./components/GraphCanvas";
import IntelPanel from "./components/IntelPanel";
import Legend from "./components/Legend";
import GraphSearch from "./components/GraphSearch";
import type { GraphPayload, NodeData } from "./types";
import { sanitizeGraphData, mergeGraphData } from "./types";

export default function App() {
  const [graphData, setGraphData] = useState<GraphPayload | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [expanding, setExpanding] = useState(false);
  const graphRef = useRef<any>(null);

  const handleSubmit = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedNode(null);
    setQuery(q);
    try {
      const res = await fetch("/graph/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Request failed: ${res.status}`);
      }
      const raw = await res.json();
      setGraphData(sanitizeGraphData(raw));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNodeClick = useCallback((node: NodeData) => {
    setSelectedNode(node);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Node expansion
  const handleExpand = useCallback(async (nodeId: string, label: string) => {
    if (!graphData) return;
    setExpanding(true);
    try {
      const res = await fetch("/graph/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, label }),
      });
      if (!res.ok) throw new Error("Expansion failed");
      const raw = await res.json();
      const incoming = sanitizeGraphData(raw);
      setGraphData((prev) => prev ? mergeGraphData(prev, incoming) : incoming);
    } catch (e) {
      setError("Failed to expand node: " + (e as Error).message);
    } finally {
      setExpanding(false);
    }
  }, [graphData]);

  // Search node selection — zoom to it
  const handleSearchSelect = useCallback((node: NodeData) => {
    setSelectedNode(node);
    // Trigger highlight in graph
    if (graphRef.current?.highlightNode) {
      graphRef.current.highlightNode(node.id);
    }
  }, []);

  return (
    <>
      <QueryBar onSubmit={handleSubmit} />

      {graphData && (
        <>
          <div className="graph-header">
            <div className="gh-left">
              <span className="gh-icon">⓿</span>
              <h2>Knowledge Graph</h2>
              <div className="gh-query">Query: &quot;{query}&quot;</div>
            </div>
            <div className="gh-right">
              <span className="gh-stat">{graphData.nodes.length}</span> nodes
              <span className="gh-sep">·</span>
              <span className="gh-stat">{graphData.edges.length}</span> edges
              <span className="gh-sep">·</span>
              {graphData.meta?.dataSource === "gdelt" ? (
                <span style={{ color: "#34d399" }}>🌐 GDELT</span>
              ) : (
                <span style={{ color: "#fb923c" }}>🤖 AI</span>
              )}
            </div>
          </div>
          <div className="graph-sub">◌ GRAPH VISUALIZATION</div>
        </>
      )}

      <div className="graph-container">
        {!graphData && !loading && (
          <div className="welcome">
            <h2>Knowledge Graph Engine</h2>
            <p>Enter a query above to generate an interactive intelligence graph</p>
          </div>
        )}
        {graphData && (
          <GraphCanvas ref={graphRef} data={graphData} onNodeClick={handleNodeClick} />
        )}
      </div>

      {/* Graph search overlay */}
      <GraphSearch graphData={graphData} onSelectNode={handleSearchSelect} />

      {graphData && <Legend />}

      {loading && (
        <div className="loading-overlay">
          <div className="spinner-lg" />
          <p>Fetching real-time intelligence data...</p>
          <p className="sub">Analyzing GDELT + generating knowledge graph</p>
        </div>
      )}

      {error && <div className="error-box">⚠ {error}</div>}

      <IntelPanel
        node={selectedNode}
        graphData={graphData}
        onClose={handleClosePanel}
        onNavigate={handleNodeClick}
        onExpand={handleExpand}
        expanding={expanding}
      />
    </>
  );
}
