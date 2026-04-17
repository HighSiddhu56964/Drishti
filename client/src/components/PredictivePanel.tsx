import { useState, useEffect } from 'react';
import type { NodeData } from '../types';
import { X, Loader2 } from 'lucide-react';

interface PredictivePanelProps {
  node: NodeData;
  onClose: () => void;
}

export default function PredictivePanel({ node, onClose }: PredictivePanelProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Trajectory' | 'Scenarios' | 'Indicators' | 'Triggers'>('Trajectory');
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchPrediction = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/graph/predict/${node.id}?nodeLabel=${encodeURIComponent(node.label)}&nodeType=${encodeURIComponent(node.type)}`);
        if (!res.ok) throw new Error("Failed to load prediction briefing");
        const json = await res.json();
        if (active) {
          setData(json);
          setTimeout(() => setAnimate(true), 50);
        }
      } catch (err: any) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchPrediction();
    return () => { active = false; };
  }, [node]);

  const tabs = ['Trajectory', 'Scenarios', 'Indicators', 'Triggers'];

  return (
    <div className="predictive-panel">
      <div className="pp-header">
        <div className="pp-title">
          <span>FORECAST MODULE: </span>
          <span className="pp-label">{node.label}</span>
          {!loading && data && (
             <span className="pp-confidence">CF {data.entity.modelConfidence}%</span>
          )}
        </div>
        <button className="pp-close" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="pp-tab-bar">
        {tabs.map(t => (
          <button 
            key={t} 
            className={`pp-tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => { setActiveTab(t as any); setAnimate(false); setTimeout(() => setAnimate(true), 10); }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pp-content">
        {loading ? (
          <PredictiveSkeleton />
        ) : error ? (
          <div className="pp-error">ERROR: {error}</div>
        ) : data ? (
          <>
            {activeTab === 'Trajectory' && <TabTrajectory data={data.trajectory} animate={animate} />}
            {activeTab === 'Scenarios' && <TabScenarios data={data.scenarios} animate={animate} />}
            {activeTab === 'Indicators' && <TabIndicators data={data} animate={animate} />}
            {activeTab === 'Triggers' && <TabTriggers escalations={data.escalationTriggers} deescalations={data.deescalationTriggers} animate={animate} />}
          </>
        ) : null}
      </div>
    </div>
  );
}

function formatVal(v: number | string): string {
  if (typeof v === 'string') return v;
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return v.toLocaleString();
}

function formatPct(v: number): string {
  return typeof v === 'number' ? `${v.toFixed(1)}%` : String(v);
}

// ======================= TAB 1: TRAJECTORY =======================
function TabTrajectory({ data, animate }: { data: any, animate: boolean }) {
  if (!data) return null;
  return (
    <div className="pp-tab-page">
      <div className="t1-section">
        <div className="sec-title">A. EVENT TIMELINE</div>
        <div className="timeline-track">
          <div className="tl-past"></div>
          <div className="tl-present-line"></div>
          <div className="tl-future"></div>
          {data.timelineEvents?.map((e: any, i: number) => {
            const isFuture = e.type === 'projected';
            return (
              <div key={i} className={`tl-event ${isFuture ? 'future' : 'past'}`}>
                <div className="tl-year">{e.year}</div>
                <div className="tl-ev-label">{e.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="t1-section">
        <div className="sec-title">B. INTENSITY SERIES</div>
        <div className="intensity-chart">
          {data.intensitySeries?.map((s: any, i: number) => {
            let color = '#38bdf8'; // verified
            let opacity = 1;
            if (s.type === 'projected') { color = '#818cf8'; opacity = 0.65; }
            if (s.type === 'high_risk') { color = '#ef4444'; opacity = 0.5; }
            return (
              <div key={i} className="ic-col">
                <div className="ic-bar-wrap">
                  <div className="ic-bar" style={{ height: animate ? `${Math.min(s.value, 100)}%` : '0%', background: color, opacity }} />
                </div>
                <div className="ic-label">{s.period}</div>
              </div>
            );
          })}
        </div>
        <div className="ic-legend">
          <span><div className="ic-dot verified"></div> Verified</span>
          <span><div className="ic-dot projected"></div> P50 Projected</span>
          <span><div className="ic-dot highrisk"></div> High Risk Path</span>
        </div>
      </div>

      <div className="t1-section">
        <div className="sec-title">C. METRIC COMPARISON</div>
        <div className="metric-grid">
          <div className="mg-header">METRIC</div>
          <div className="mg-header">PAST</div>
          <div className="mg-header">PRESENT</div>
          <div className="mg-header">PROJECTED</div>
          {data.metricComparison?.map((m: any, i: number) => (
            <div key={i} className="mg-row">
              <div className="mg-col name">{m.metric} <span className="mg-unit">({m.unit})</span></div>
              <div className={`mg-col val trend-${m.pastTrend}`}>{m.pastValue} <span className="mg-yr">[{m.pastYear}]</span></div>
              <div className="mg-col val">{m.presentValue}</div>
              <div className={`mg-col val trend-${m.futureTrend}`}>{m.projectedValue} <span className="mg-yr">[{m.projectedYear}]</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ======================= TAB 2: SCENARIOS =======================
function TabScenarios({ data, animate }: { data: any[], animate: boolean }) {
  if (!data) return null;
  return (
    <div className="pp-tab-page">
      <div className="sec-title">A. PROBABILISTIC SCENARIOS</div>
      <div className="scenarios-row">
        {data.map((sc, i) => {
          const t = sc.type;
          const cls = t === 'best' ? 'sc-best' : t === 'worst' ? 'sc-worst' : 'sc-base';
          return (
            <div key={i} className={`sc-card ${cls}`}>
              <div className="sc-top">
                <div className="sc-prob">{sc.probability}%</div>
                <div className="sc-name">{sc.name}</div>
              </div>
              <div className="sc-desc">{sc.description}</div>
              <div className="sc-bar-track">
                <div className="sc-bar-fill" style={{ width: animate ? `${sc.probability}%` : '0%' }}></div>
              </div>
              <div className="sc-conds">
                {sc.keyConditions?.map((c: string, j: number) => (
                  <span key={j} className="sc-chip">{c}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sec-title" style={{marginTop: '20px'}}>B. ECONOMIC IMPACT (% GDP)</div>
      <div className="ei-chart">
        {data.map((sc, i) => {
          const val = sc.economicImpactGDPPercent;
          const isPos = val > 0;
          const w = Math.min(Math.abs(val) * 10, 100); 
          return (
            <div key={i} className="ei-row">
              <div className="ei-label">{sc.name}</div>
              <div className="ei-track">
                <div className="ei-centerline"></div>
                <div className={`ei-bar ${isPos ? 'pos' : 'neg'}`} 
                     style={{ 
                       width: animate ? `${w}%` : '0%', 
                       left: isPos ? '50%' : `calc(50% - ${w}%)` 
                     }}>
                  <span className="ei-val">{val > 0 ? '+'+val : val}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sec-title" style={{marginTop: '20px'}}>C. AFFECTED ENTITIES</div>
      <div className="ae-grid">
        {data.map((sc, i) => (
          <div key={i} className="ae-col">
            <div className="ae-col-title">{sc.name}</div>
            {sc.affectedEntities?.map((ent: any, j: number) => (
              <div key={j} className="ae-ent">
                <span className="ae-ename">{ent.name}</span>
                <span className={`ae-dir dir-${ent.direction}`}>{ent.direction === 'up' ? '▲' : ent.direction === 'down' ? '▼' : '▬'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================= TAB 3: INDICATORS =======================
function TabIndicators({ data, animate }: { data: any, animate: boolean }) {
  if (!data) return null;
  return (
    <div className="pp-tab-page">
     <div className="sec-title">A. EARLY WARNING INDICATORS</div>
     <div className="ind-list">
       {data.indicators?.map((ind: any, i: number) => {
         const pct = Math.min((ind.currentValue / Math.max(100, ind.escalationThreshold * 1.5)) * 100, 100);
         const threshPct = Math.min((ind.escalationThreshold / Math.max(100, ind.escalationThreshold * 1.5)) * 100, 100);
         
         const isCritical = ind.currentValue >= ind.escalationThreshold;
         const isWarn = ind.currentValue >= ind.escalationThreshold * 0.85;
         const colorCls = isCritical ? 'ind-crit' : isWarn ? 'ind-warn' : 'ind-safe';

         return (
           <div key={i} className="ind-row">
             <div className="ind-name">{ind.name}</div>
             <div className="ind-track-wrap">
               <div className="ind-track">
                 <div className={`ind-bar ${colorCls}`} style={{ width: animate ? `${pct}%` : '0%' }}></div>
                 <div className="ind-thresh" style={{ left: `${threshPct}%` }}></div>
               </div>
               <div className="ind-nums">
                 <span className="ind-cur">{ind.currentValue} {ind.currentUnit}</span>
                 {ind.daysToThreshold && <span className="ind-days">{ind.daysToThreshold}d-THT</span>}
               </div>
             </div>
           </div>
         );
       })}
     </div>

     <div className="sec-title" style={{marginTop: '20px'}}>B. PROBABILITY BANDS</div>
     <div className="cb-list">
       {data.confidenceBands?.map((cb: any, i: number) => (
         <div key={i} className="cb-row">
           <div className="cb-horizon">{cb.horizon}</div>
           <div className="cb-track">
             <div className="cb-p10p90" style={{ left: `${cb.p10}%`, width: animate ? `${cb.p90 - cb.p10}%` : '0%' }}></div>
             <div className="cb-p50" style={{ left: animate ? `${cb.p50}%` : '0%' }}></div>
           </div>
           <div className="cb-range">P10: {cb.p10} — P90: {cb.p90}</div>
         </div>
       ))}
     </div>
     <div className="cb-note">* Shaded region represents P10–P90 uncertainty bounds. Dot indicates P50 median.</div>
    </div>
  );
}

// ======================= TAB 4: TRIGGERS =======================
function TabTriggers({ escalations, deescalations, animate }: { escalations: any[], deescalations: any[], animate: boolean }) {
  if (!escalations || !deescalations) return null;
  return (
    <div className="pp-tab-page">
      <div className="sec-title">ESCALATION TRIGGERS (90-DAY)</div>
      <div className="trig-list">
        {escalations.map((t, i) => {
          const cls = t.severity === 'critical' ? 'sc-worst' : t.severity === 'high' ? 'sc-warn' : 'sc-base';
          return (
            <div key={i} className={`trig-card ${cls}`}>
               <div className="trig-dot"></div>
               <div className="trig-center">
                 <div className="trig-ev">{t.event}</div>
                 <div className="trig-fin">Impact: {t.financialImpact}</div>
                 <div className="trig-lead">{t.leadTime} warning</div>
               </div>
               <div className="trig-prob">{t.probability90Days}%</div>
            </div>
          );
        })}
      </div>

      <div className="sec-title" style={{marginTop: '20px'}}>DE-ESCALATION TRIGGERS (90-DAY)</div>
      <div className="trig-list">
        {deescalations.map((t, i) => (
          <div key={i} className={`trig-card sc-best`}>
             <div className="trig-dot"></div>
             <div className="trig-center">
               <div className="trig-ev">{t.event}</div>
               <div className="trig-fin">Impact: {t.financialImpact}</div>
               <div className="trig-actors">
                 {t.keyActors?.map((a: string, j: number) => <span key={j} className="sc-chip">{a}</span>)}
               </div>
             </div>
             <div className="trig-prob">{t.probability90Days}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PredictiveSkeleton() {
  return (
    <div className="pp-skeleton">
      <div className="skl-title">INITIALIZING QUANTITATIVE AGENTS...</div>
      <Loader2 size={24} className="skl-spin" />
      <div className="skl-bars">
        <div className="skl-b w70"></div>
        <div className="skl-b w40"></div>
        <div className="skl-b w90"></div>
        <div className="skl-b w50"></div>
      </div>
    </div>
  );
}
