import { useEffect, useRef, useMemo, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import ForceGraph2D from "react-force-graph-2d";
import * as d3 from "d3";
import type { GraphPayload, NodeData, WikiInfo } from "../types";
import { getColor } from "../types";

interface Props {
  data: GraphPayload;
  onNodeClick: (node: NodeData) => void;
}

let animFrame = 0;
setInterval(() => { animFrame++; }, 50);

// Stable function references — avoids re-render reinitialization
const NODE_MODE = () => "replace" as const;

// Safe rounded rect (polyfill for older browsers)
function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const GraphCanvas = forwardRef(function GraphCanvas({ data, onNodeClick }: Props, ref: any) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: NodeData | null }>({ x: 0, y: 0, node: null });
  const [wikiCache, setWikiCache] = useState<Record<string, WikiInfo>>({});
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hlNodes, setHlNodes] = useState<Set<string>>(new Set());
  const [hlLinks, setHlLinks] = useState<Set<any>>(new Set());

  // Stable refs for canvas callbacks (avoids stale closures)
  const hlNodesRef = useRef(hlNodes);
  const hlLinksRef = useRef(hlLinks);
  const hoverNodeRef = useRef(hoverNode);
  hlNodesRef.current = hlNodes;
  hlLinksRef.current = hlLinks;
  hoverNodeRef.current = hoverNode;

  // Expose methods to parent for search
  useImperativeHandle(ref, () => ({
    highlightNode: (id: string) => {
      const node = data.nodes.find((n) => n.id === id);
      if (node && fgRef.current) {
        const newHl = new Set<string>();
        newHl.add(id);
        setHlNodes(newHl);
        setTimeout(() => {
          const fgNode = fgRef.current?.graphData().nodes.find((n: any) => n.id === id);
          if (fgNode && fgNode.x !== undefined && fgNode.y !== undefined) {
            fgRef.current?.centerAt(fgNode.x, fgNode.y, 800);
            fgRef.current?.zoom(2.5, 800);
          }
        }, 100);
      }
    },
  }), [data.nodes]);

  // ═══ GRAPH DATA — strict validation + stable references ═══
  const graphData = useMemo(() => {
    const nodeById: Record<string, NodeData> = {};

    data.nodes.forEach((n) => {
      const id = (n.id || "").toLowerCase().trim();
      if (!id) return;
      nodeById[id] = { ...n, id };
    });

    const validIds = new Set(Object.keys(nodeById));
    const nodes = Object.values(nodeById);

    const links = data.edges
      .map((e) => ({
        source: (e.source || "").toLowerCase().trim(),
        target: (e.target || "").toLowerCase().trim(),
        label: e.relationship,
        weight: e.weight || 0.5,
        description: e.description || "",
      }))
      .filter((l) => validIds.has(l.source) && validIds.has(l.target) && l.source !== l.target);

    // Debug
    const linkedIds = new Set<string>();
    links.forEach((l) => { linkedIds.add(l.source); linkedIds.add(l.target); });
    const orphans = nodes.filter((n) => !linkedIds.has(n.id));
    console.log(`[Graph] ${nodes.length} nodes, ${links.length} links, ${orphans.length} orphans`);

    return { nodes, links, nodeById };
  }, [data]);

  // Adjacency maps
  const adj = useMemo(() => {
    const a: Record<string, Set<string>> = {};
    const al: Record<string, Set<any>> = {};
    graphData.links.forEach((l: any) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (!a[s]) a[s] = new Set(); a[s].add(t);
      if (!a[t]) a[t] = new Set(); a[t].add(s);
      if (!al[s]) al[s] = new Set(); al[s].add(l);
      if (!al[t]) al[t] = new Set(); al[t].add(l);
    });
    return { nodes: a, links: al };
  }, [graphData]);

  // Resize
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Forces
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const numNodes = graphData.nodes.length;
    const chargeStrength = Math.min(-400, -300 - (numNodes * 8));
    const linkDist = Math.max(160, 100 + (numNodes * 3));
    
    fg.d3Force('charge').strength(chargeStrength);
    fg.d3Force('link').distance(linkDist).strength(0.3);
    fg.d3Force('collision', d3.forceCollide(45));
    fg.d3Force('center').strength(0.03);
  }, [graphData]);

  // Wiki fetch
  const fetchWiki = useCallback((name: string) => {
    if (wikiCache[name]) return;
    fetch(`/graph/entity/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((wiki: WikiInfo) => {
        setWikiCache((prev) => ({ ...prev, [name]: wiki }));
      })
      .catch(() => {});
  }, [wikiCache]);

  // ═══ NODE RENDERING ═══
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, gs: number) => {
    const x = node.x;
    const y = node.y;
    if (x === undefined || y === undefined) return;

    const hl = hlNodesRef.current.has(node.id);
    const hv = hoverNodeRef.current === node.id;
    const col = getColor(node.type);
    const R = 26;
    const r = hv ? R * 1.2 : hl ? R * 1.08 : R;
    const dim = hlNodesRef.current.size > 0 && !hl && !hv;
    const pulse = Math.sin(animFrame * 0.05 + (x || 0) * 0.02) * 0.15;

    ctx.save();
    ctx.globalAlpha = dim ? 0.18 : 1;

    // Glow aura
    const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3);
    glow.addColorStop(0, col + '45');
    glow.addColorStop(0.5, col + '1a');
    glow.addColorStop(1, col + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing dashed orbit
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5 + pulse * 15, 0, Math.PI * 2);
    ctx.strokeStyle = col + '55';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dark interior
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6,10,24,0.95)';
    ctx.fill();

    // Sub-surface grid/dot pattern
    const ptSize = Math.max(1, r/8);
    ctx.fillStyle = col + '33';
    for(let i=-1; i<=1; i++) {
      for(let j=-1; j<=1; j++) {
         if(i===0 && j===0) continue;
         ctx.beginPath();
         ctx.arc(x + i*(r/2.5), y + j*(r/2.5), ptSize, 0, Math.PI*2);
         ctx.fill();
      }
    }

    // Prominent colored ring
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = col;
    ctx.lineWidth = hv ? 4 : hl ? 3.5 : 2.8;
    ctx.shadowColor = col;
    ctx.shadowBlur = hv ? 35 : hl ? 22 : 12 + pulse * 30;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner ring
    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = col + '44';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rotating propeller triangles
    ctx.save();
    ctx.translate(x, y);
    const rotSpeed = animFrame * 0.015;
    [0, Math.PI * 0.667, Math.PI * 1.333].forEach((baseAngle) => {
      ctx.save();
      ctx.rotate(baseAngle + rotSpeed);
      ctx.beginPath();
      const ts = r * 0.45;
      const tw = ts * 0.38;
      ctx.moveTo(0, -ts);
      ctx.lineTo(-tw, ts * 0.15);
      ctx.lineTo(tw, ts * 0.15);
      ctx.closePath();
      ctx.fillStyle = col + (hv ? 'aa' : '70');
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    // Label
    const label = node.label || node.id;
    const maxLen = 16;
    const displayLabel = label.length > maxLen ? label.substring(0, maxLen - 2) + '..' : label;
    const fs = Math.max(12 / gs, 4);
    ctx.font = `${hv ? '800' : '700'} ${fs}px Inter,system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = hv ? '#ffffff' : col;
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(displayLabel, x, y + r + 8);
    ctx.shadowBlur = 0;

    // Type subtitle
    const tfs = Math.max(9 / gs, 2.8);
    ctx.font = `500 ${tfs}px Inter,system-ui,sans-serif`;
    ctx.fillStyle = col + '88';
    ctx.fillText((node.type || 'entity').toUpperCase(), x, y + r + 8 + fs + 4);

    ctx.restore();
  }, []);

  // ═══ HITBOX — large invisible circle for EVERY node ═══
  const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const x = node.x;
    const y = node.y;
    if (x === undefined || y === undefined) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, 2 * Math.PI, false);
    ctx.fill();
  }, []);

  // ═══ LINK RENDERING — uses safe roundedRect polyfill ═══
  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, gs: number) => {
    try {
      const s = link.source;
      const t = link.target;
      if (!s || !t || s.x == null || t.x == null || s.y == null || t.y == null) return;
      const sn = graphData.nodeById[s.id] || {};
      const tn = graphData.nodeById[t.id] || {};
      const hl = hlLinksRef.current.has(link);
      const dim = hlNodesRef.current.size > 0 && !hl;
      const sc = getColor((sn as any).type);
      const tc = getColor((tn as any).type);

      ctx.save();
      ctx.globalAlpha = dim ? 0.08 : hl ? 1 : 0.7;

      // Edge line with gradient
      const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
      grad.addColorStop(0, hl ? '#a78bfa' : sc);
      grad.addColorStop(1, hl ? '#c4b5fd' : tc);

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = hl ? 2.5 / gs : 1.5 / gs;
      ctx.shadowColor = sc;
      ctx.shadowBlur = hl ? 8 : 3;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Arrow
      const dx = t.x - s.x, dy = t.y - s.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) { ctx.restore(); return; }
      const ux = dx / len, uy = dy / len;
      const al = Math.min(10 / gs, len * 0.15);
      const apx = t.x - ux * 30, apy = t.y - uy * 30;
      ctx.beginPath();
      ctx.moveTo(apx + ux * al, apy + uy * al);
      ctx.lineTo(apx - ux * al * 0.3 + uy * al * 0.5, apy - uy * al * 0.3 - ux * al * 0.5);
      ctx.lineTo(apx - ux * al * 0.3 - uy * al * 0.5, apy - uy * al * 0.3 + ux * al * 0.5);
      ctx.closePath();
      ctx.fillStyle = hl ? '#a78bfa' : sc;
      ctx.fill();

      // Relationship label — uses SAFE polyfill, no ctx.roundRect
      if (link.label) {
        const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
        const lfs = Math.max(8.5 / gs, 2.5);
        const angle = Math.atan2(dy, dx);
        const flipAngle = (angle > Math.PI / 2 || angle < -Math.PI / 2) ? angle + Math.PI : angle;

        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(flipAngle);

        const text = link.label.toUpperCase().replace(/_/g, ' ');
        ctx.font = `600 ${lfs}px Inter,system-ui,sans-serif`;
        const tw = ctx.measureText(text).width;
        const ph = lfs + 4;
        const pw = tw + 10;

        // Safe rounded rect polyfill instead of ctx.roundRect
        ctx.fillStyle = 'rgba(6,10,24,0.75)';
        drawRoundedRect(ctx, -pw / 2, -ph / 2 - 1, pw, ph, 3);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = hl ? '#c4b5fd' : dim ? sc + '44' : sc + 'cc';
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    } catch (e) {
      // Silently catch any canvas errors to prevent breaking interactivity
    }
  }, [graphData.nodeById]);

  // ═══ EVENT HANDLERS ═══
  const handleNodeHover = useCallback((node: any) => {
    if (!node) {
      setHoverNode(null);
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
      setTooltip((prev) => ({ ...prev, node: null }));
      return;
    }
    setHoverNode(node.id);
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    const name = node.label || node.id;
    setTooltip((prev) => ({ ...prev, node }));
    hoverTimeout.current = setTimeout(() => { fetchWiki(name); }, 400);
  }, [fetchWiki]);

  const handleNodeClick = useCallback((node: any) => {
    const newHl = new Set<string>();
    const newHlL = new Set<any>();
    newHl.add(node.id);
    adj.nodes[node.id]?.forEach((id) => newHl.add(id));
    adj.links[node.id]?.forEach((l) => newHlL.add(l));
    setHlNodes(newHl);
    setHlLinks(newHlL);
    onNodeClick(node as NodeData);
  }, [adj, onNodeClick]);

  const handleBgClick = useCallback(() => {
    setHlNodes(new Set());
    setHlLinks(new Set());
  }, []);

  // Tooltip mouse tracking
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setTooltip((prev) => ({ ...prev, x: e.clientX + 16, y: e.clientY - 16 }));
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const tooltipNode = tooltip.node;
  const tooltipWiki = tooltipNode ? wikiCache[tooltipNode.label || tooltipNode.id] : null;

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dims.w}
        height={dims.h}
        backgroundColor="rgba(0,0,0,0)"
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        cooldownTicks={150}
        warmupTicks={50}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={NODE_MODE}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkCanvasObject={linkCanvasObject}
        linkDirectionalArrowLength={0}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBgClick}
      />

      {/* Tooltip */}
      {tooltipNode && (
        <div
          className="graph-tooltip"
          style={{ left: tooltip.x, top: tooltip.y, opacity: 1 }}
        >
          <div className="tt-label">{tooltipNode.label || tooltipNode.id}</div>
          <div
            className="tt-type"
            style={{
              background: getColor(tooltipNode.type) + "22",
              color: getColor(tooltipNode.type),
            }}
          >
            {(tooltipNode.type || "entity").toUpperCase()}
          </div>
          <div className="tt-desc">
            {tooltipWiki?.summary ||
              tooltipNode.properties?.description ||
              "Intelligence entity"}
          </div>
        </div>
      )}
    </div>
  );
});

export default GraphCanvas;
