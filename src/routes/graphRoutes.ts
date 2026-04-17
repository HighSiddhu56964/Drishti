/**
 * Graph Routes
 *
 * POST /graph/query — accepts a query string, generates a knowledge graph.
 * GET  /graph/snapshot — returns the current Neo4j graph snapshot.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { fetchContextData } from "../services/contextService.js";
import { generateKnowledgeGraph } from "../services/graphExtractor.js";
import { saveGraphToNeo4j, getGraphSnapshot } from "../services/neo4jService.js";
import { fetchEntityInfo } from "../services/wikiService.js";
import { normalizeGraph } from "../utils/graphNormalizer.js";

const router = Router();

const QuerySchema = z.object({
  query: z
    .string()
    .min(3, "Query must be at least 3 characters")
    .max(1000, "Query must be under 1000 characters"),
});

router.post("/query", async (req: Request, res: Response): Promise<void> => {
  try {
    // ─── Validate request body ─────────────────────────────────────────
    const parsed = QuerySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { query } = parsed.data;
    console.log(`\n${"═".repeat(60)}`);
    console.log(`[Query] "${query}"`);
    console.log(`${"═".repeat(60)}`);

    // ─── Step 1: Fetch real-world context (GDELT → AI fallback) ──────
    console.log("[Step 1] Fetching context data...");
    const { context: contextText, source, articleCount } =
      await fetchContextData(query);
    console.log(
      `[Step 1] Context ready (${source}, ${contextText.length} chars, ${articleCount} articles)`
    );

    // ─── Step 2: Extract knowledge graph ───────────────────────────────
    console.log("[Step 2] Extracting knowledge graph...");
    const graph = await generateKnowledgeGraph(contextText);
    console.log(
      `[Step 2] Graph ready — ${graph.nodes.length} nodes, ${graph.edges.length} edges`
    );

    // ─── Step 3: Normalize graph data ─────────────────────────────────
    const cleanGraph = normalizeGraph(graph);
    console.log(`[Step 3] Normalized: ${cleanGraph.nodes.length} nodes, ${cleanGraph.edges.length} edges`);

    // ─── Step 4: Persist to Neo4j ─────────────────────────────────────
    console.log("[Step 4] Saving graph to Neo4j...");
    try {
      await saveGraphToNeo4j(cleanGraph);
      console.log("[Step 4] Neo4j save complete");
    } catch (neo4jErr) {
      console.error(
        "[Step 4] Neo4j save failed (non-fatal):",
        neo4jErr instanceof Error ? neo4jErr.message : neo4jErr
      );
    }

    // ─── Respond ───────────────────────────────────────────────────────
    res.json({
      query,
      nodes: cleanGraph.nodes,
      edges: cleanGraph.edges,
      meta: {
        nodeCount: cleanGraph.nodes.length,
        edgeCount: cleanGraph.edges.length,
        dataSource: source,
        articleCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[GraphRoute] Error:", err);
    res.status(500).json({
      error: "Failed to generate knowledge graph",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ─── GET /snapshot — return current Neo4j graph ───────────────────────────
router.get("/snapshot", async (_req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(_req.query.limit as string) || 50;
    const graph = await getGraphSnapshot(limit);

    res.json({
      nodes: graph.nodes,
      edges: graph.edges,
      meta: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[GraphRoute] Snapshot error:", err);
    res.status(500).json({
      error: "Failed to fetch graph snapshot",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ─── GET /entity/:label — fetch entity details from Wikipedia ─────────────
router.get("/entity/:label", async (req: Request, res: Response): Promise<void> => {
  try {
    const label = decodeURIComponent(req.params.label as string);
    console.log(`[Wiki] Fetching details for: "${label}"`);

    const info = await fetchEntityInfo(label);

    if (!info) {
      // Return a usable fallback instead of an error so IntelPanel always renders
      res.json({
        title: label,
        summary: "Entity in knowledge graph",
        description: "",
        thumbnail: null,
        url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(label)}`,
        extract: "No Wikipedia article found for this entity. Try searching manually.",
        categories: [],
        connections: [],
        type: "UNKNOWN",
      });
      return;
    }

    res.json(info);
  } catch (err) {
    // Graceful fallback — never return a 500 so IntelPanel always opens
    const label = String(req.params.label || "Unknown");
    console.error(`[Wiki] Entity fetch error for "${label}":`, err);
    res.json({
      title: label,
      label: label,
      summary: "Entity in knowledge graph",
      description: "",
      thumbnail: null,
      url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(label)}`,
      extract: "Could not fetch details at this time.",
      categories: [],
      connections: [],
      type: "UNKNOWN",
    });
  }
});

// ─── POST /expand — dynamically expand graph from a node ──────────────────
const ExpandSchema = z.object({
  nodeId: z.string(),
  label: z.string(),
});

router.post("/expand", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = ExpandSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { nodeId, label } = parsed.data;
    console.log(`\n${"─".repeat(60)}`);
    console.log(`[Expand] Expanding node: "${label}" (${nodeId})`);

    // Fetch context about this entity
    const { context: contextText, source, articleCount } = await fetchContextData(label);
    console.log(`[Expand] Context ready (${source}, ${contextText.length} chars)`);

    // Generate subgraph
    const graph = await generateKnowledgeGraph(contextText);

    // Normalize first, then limit to 15 nodes
    const normalized = normalizeGraph(graph);
    const limitedNodes = normalized.nodes.slice(0, 15);
    const limitedNodeIds = new Set(limitedNodes.map((n) => n.id));
    const limitedEdges = normalized.edges.filter(
      (e) => limitedNodeIds.has(e.source) && limitedNodeIds.has(e.target)
    );

    console.log(`[Expand] Result: ${limitedNodes.length} nodes, ${limitedEdges.length} edges`);

    res.json({
      nodes: limitedNodes,
      edges: limitedEdges,
      sourceNodeId: nodeId,
      meta: {
        nodeCount: limitedNodes.length,
        edgeCount: limitedEdges.length,
        dataSource: source,
        articleCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[GraphRoute] Expand error:", err);
    res.status(500).json({
      error: "Failed to expand node",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ─── POST /node-details — AI-generated deep intelligence for a node ───────
import OpenAI from "openai";

const DetailSchema = z.object({
  label: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
});

router.post("/node-details", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = DetailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const { label, type, description } = parsed.data;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const response = await openai.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an intelligence analyst. Given an entity, produce a detailed JSON analysis.
Return ONLY valid JSON with these keys:
{
  "fullDescription": "A detailed 200-500 word explanation of this entity, its significance, history, and current role in global affairs.",
  "globalImpact": {
    "economy": "How this entity affects global/regional economics (2-3 sentences)",
    "geopolitics": "Geopolitical significance (2-3 sentences)", 
    "trade": "Impact on trade and supply chains (2-3 sentences)"
  },
  "timeline": [
    { "year": "YYYY", "event": "Brief description of key event" }
  ],
  "insights": [
    "Strategic importance bullet point",
    "Risk factor bullet point",
    "Dependency or relationship bullet point"
  ]
}
Include 5-8 timeline events and 4-6 insight points. Be factual and specific.`,
        },
        {
          role: "user",
          content: `Entity: "${label}"\nType: ${type || "Unknown"}\nContext: ${description || "No additional context"}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Empty AI response");
    }

    let cleanRaw = raw.trim();
    if (cleanRaw.startsWith("```json")) {
      cleanRaw = cleanRaw.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const details = JSON.parse(cleanRaw);
    res.json(details);
  } catch (err) {
    console.error("[GraphRoute] Node details error:", err);
    // Graceful fallback
    res.json({
      fullDescription: `${req.body?.label || "This entity"} is a significant entity in the knowledge graph. Detailed AI analysis is temporarily unavailable.`,
      globalImpact: {
        economy: "Economic impact data is being processed.",
        geopolitics: "Geopolitical analysis is being generated.",
        trade: "Trade impact assessment is pending.",
      },
      timeline: [],
      insights: [
        "This entity plays a role in the current geopolitical landscape.",
        "Further analysis is recommended for comprehensive understanding.",
      ],
    });
  }
});

export default router;
