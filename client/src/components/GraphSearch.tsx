import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { GraphPayload, NodeData } from "../types";
import { getColor } from "../types";

interface Props {
  graphData: GraphPayload | null;
  onSelectNode: (node: NodeData) => void;
}

export default function GraphSearch({ graphData, onSelectNode }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!graphData || !query.trim()) return [];
    const q = query.toLowerCase();
    return graphData.nodes
      .filter((n) => (n.label || n.id).toLowerCase().includes(q))
      .slice(0, 8);
  }, [graphData, query]);

  const handleSelect = useCallback(
    (node: NodeData) => {
      onSelectNode(node);
      setQuery("");
      setOpen(false);
    },
    [onSelectNode]
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!graphData) return null;

  return (
    <div className="graph-search">
      <div className="gs-input-wrap">
        <span className="gs-icon">🔍</span>
        <input
          ref={inputRef}
          className="gs-input"
          placeholder="Search nodes... (NVIDIA, Iran, Oil)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {query && (
          <button className="gs-clear" onClick={() => { setQuery(""); setOpen(false); }}>
            ✕
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="gs-dropdown">
          {results.map((node) => (
            <div
              key={node.id}
              className="gs-result"
              onClick={() => handleSelect(node)}
            >
              <div className="gs-dot" style={{ background: getColor(node.type) }} />
              <span className="gs-name">{node.label || node.id}</span>
              <span className="gs-type" style={{ color: getColor(node.type) }}>
                {(node.type || "entity").toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
