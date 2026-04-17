import { useState, useEffect } from 'react';

interface StatusBarProps {
  activeView: 'globe' | 'graph';
  graphStats: { nodes: number; edges: number } | null;
}

export default function StatusBar({ activeView, graphStats }: StatusBarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const utcStr = time.toISOString().split('.')[0] + 'Z';

  return (
    <div className="status-bar">
      <div className="sb-left">
        <span className="sb-brand">
          <span className="sb-pulse" />
          DRISHTI
        </span>
        <span className="sb-sep">|</span>
        <span className="sb-label">INTELLIGENCE PLATFORM</span>
      </div>
      <div className="sb-center">
        <span className={`sb-chip ${activeView === 'globe' ? 'active' : ''}`}>
          GLOBE {activeView === 'globe' ? '●' : '○'}
        </span>
        <span className={`sb-chip ${activeView === 'graph' ? 'active' : ''}`}>
          GRAPH {activeView === 'graph' ? '●' : '○'}
        </span>
        {graphStats && (
          <>
            <span className="sb-sep">|</span>
            <span className="sb-metric">{graphStats.nodes} nodes</span>
            <span className="sb-metric">{graphStats.edges} edges</span>
          </>
        )}
      </div>
      <div className="sb-right">
        <span className="sb-time">{utcStr}</span>
        <span className="sb-indicator online">SYSTEMS ONLINE</span>
      </div>
    </div>
  );
}
