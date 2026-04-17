import { useState, useCallback, useRef } from "react";
import StatusBar from "./components/StatusBar";
import JarvisPanel from "./components/JarvisPanel";
import GlobeView from "./components/GlobeView";
import GraphCanvas from "./components/GraphCanvas";
import IntelPanel from "./components/IntelPanel";
import Legend from "./components/Legend";
import type { GraphPayload, NodeData } from "./types";
import { sanitizeGraphData, mergeGraphData } from "./types";
import { io } from "socket.io-client";
import "../src/predictive.css";

export default function App() {
  const [activeView, setActiveView] = useState<'globe' | 'graph'>('globe');
  const [graphData, setGraphData] = useState<GraphPayload | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [predictivePanelOpen, setPredictivePanelOpen] = useState(false);
  const [reEvalLoading, setReEvalLoading] = useState(false);
  const [reEvalResult, setReEvalResult] = useState<any>(null);
  const graphRef = useRef<any>(null);
  const aisEnabled = useRef(false);

  // Setup WebSocket for Live AIS Streaming
  import("react").then((react) => {
    react.useEffect(() => {
      const socket = io(window.location.origin, { path: "/socket.io" });
      socket.on("connect", () => console.log("[Socket] Connected to server for real-time intel"));
      socket.on("ais-graph-update", (payload: GraphPayload) => {
        if (!aisEnabled.current) aisEnabled.current = true;
        setGraphData(prev => {
          if (!prev) return payload; // If no graph, this becomes the graph
          return mergeGraphData(prev, payload);
        });
      });
      return () => { socket.disconnect(); };
    }, []);
  });

  const handleQuery = useCallback(async (q: string) => {
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
      setActiveView('graph');
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

  const handleApplySuggestions = useCallback((newNodes: any[], newEdges: any[]) => {
    setGraphData(prev => {
      if (!prev) return prev;
      const incoming: GraphPayload = { nodes: newNodes, edges: newEdges, meta: prev.meta };
      return mergeGraphData(prev, incoming);
    });
  }, []);

  const handleSwitchView = useCallback((view: 'globe' | 'graph') => {
    if (view === 'graph' && !graphData) return;
    setActiveView(view);
  }, [graphData]);

  const handleReEvaluate = useCallback(async () => {
    if (!graphData || reEvalLoading) return;
    setReEvalLoading(true);
    setReEvalResult(null);
    try {
      const res = await fetch("/graph/re-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: graphData.nodes, edges: graphData.edges }),
      });
      if (!res.ok) throw new Error("Re-evaluation failed");
      const data = await res.json();
      setReEvalResult(data);
    } catch (e) {
      setError("Re-evaluation failed: " + (e as Error).message);
    } finally {
      setReEvalLoading(false);
    }
  }, [graphData, reEvalLoading]);

  const handleApplyReEval = useCallback(() => {
    if (!reEvalResult?.newNodes || !reEvalResult?.newEdges) return;
    setGraphData(prev => {
      if (!prev) return prev;
      const incoming: GraphPayload = { nodes: reEvalResult.newNodes, edges: reEvalResult.newEdges, meta: prev.meta };
      return mergeGraphData(prev, incoming);
    });
    setReEvalResult(null);
  }, [reEvalResult]);

  const graphStats = graphData ? { nodes: graphData.nodes.length, edges: graphData.edges.length } : null;

  return (
    <div className="dashboard">
      {/* Top Status Bar */}
      <StatusBar activeView={activeView} graphStats={graphStats} />

      {/* Main Content Area */}
      <div className="dashboard-body">
        {/* Main Viewport — Globe or Graph */}
        <div className="main-viewport">
          {/* Graph Header when in graph mode */}
          {activeView === 'graph' && graphData && (
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
                <button className="btn-predictive" onClick={() => setPredictivePanelOpen(true)}>
                  PREDICTIVE ANALYSIS
                </button>
                <button className="btn-reevaluate" onClick={handleReEvaluate} disabled={reEvalLoading}>
                  {reEvalLoading ? '⟳ ANALYZING...' : '⚡ RE-EVALUATE'}
                </button>
              </div>
            </div>
          )}

          <div className="viewport-content">
            {activeView === 'globe' && <GlobeView />}
            {activeView === 'graph' && graphData && (
              <div className="graph-container">
                <GraphCanvas ref={graphRef} data={graphData} onNodeClick={handleNodeClick} />
              </div>
            )}
          </div>

          {/* Loading Overlay */}
          {loading && (
            <div className="loading-overlay">
              <div className="spinner-lg" />
              <p>Generating intelligence graph...</p>
              <p className="sub">Analyzing GDELT + knowledge extraction</p>
            </div>
          )}

          {error && <div className="error-box">⚠ {error}</div>}
          {activeView === 'graph' && graphData && <Legend />}
        </div>

        {/* Jarvis Sidebar */}
        <JarvisPanel
          onQuery={handleQuery}
          onSwitchView={handleSwitchView}
          activeView={activeView}
          loading={loading}
          graphStats={graphStats}
        />
      </div>

      {/* Intel Panel */}
      <IntelPanel
        node={selectedNode}
        graphData={graphData}
        onClose={handleClosePanel}
        onNavigate={handleNodeClick}
        onExpand={handleExpand}
        expanding={expanding}
      />

      {/* Re-Evaluation Results Overlay */}
      {reEvalResult && (
        <div className="reeval-overlay" onClick={() => setReEvalResult(null)}>
          <div className="reeval-panel" onClick={(e) => e.stopPropagation()}>
            <div className="reeval-header">
              <h3>⚡ PALANTIR RE-EVALUATION</h3>
              <button className="ip-close" onClick={() => setReEvalResult(null)}>✕</button>
            </div>
            <div className="reeval-body">
              {reEvalResult.deepInsights && (
                <div className="result-section">
                  <h3>DEEP INTELLIGENCE FINDINGS</h3>
                  <ul>
                    {reEvalResult.deepInsights.map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {reEvalResult.threatAssessment && (
                <div className="result-section">
                  <h3>THREAT ASSESSMENT</h3>
                  <ul>
                    {reEvalResult.threatAssessment.map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(reEvalResult.newNodes?.length > 0 || reEvalResult.newEdges?.length > 0) && (
                <div className="result-section suggestions">
                  <h3>DISCOVERED INTELLIGENCE</h3>
                  <div className="summary-boxes">
                    <div className="s-box">
                      <strong>+{reEvalResult.newNodes?.length || 0}</strong>ENTITIES
                    </div>
                    <div className="s-box">
                      <strong>+{reEvalResult.newEdges?.length || 0}</strong>CONNECTIONS
                    </div>
                  </div>
                  <button className="btn-primary" style={{ marginTop: '12px' }} onClick={handleApplyReEval}>
                    INJECT INTO GRAPH
                  </button>
                </div>
              )}
              <button className="btn-outline mt-4" onClick={() => { setReEvalResult(null); handleReEvaluate(); }}>
                RE-EVALUATE AGAIN (DEEPER)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
