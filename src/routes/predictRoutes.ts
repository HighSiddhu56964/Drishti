import { Router, type Request, type Response } from "express";
import OpenAI from "openai";

const router = Router();

// Cache: Map<nodeId, { data: any, timestamp: number }>
const predictionCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY; // Reusing API key structure

const openai = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const SYSTEM_PROMPT = `You are a quantitative geopolitical forecasting model trained on historical conflict data, economic indicators, and political science research. You produce structured probabilistic forecasts with real historical data as baselines. You never use vague language. Every prediction is expressed as a specific number, percentage, dollar amount, or date range. You never say 'may', 'could', or 'might' — you say '34% probability', '$40–80B impact', or '6–18 month window'.
Given an entity from a geopolitical knowledge graph, return a complete predictive intelligence briefing as a single JSON object. Use your knowledge of the entity to fill this with real historical data for past values and calibrated probabilistic forecasts for future values. Base your probability estimates on historical base rates — for example, nuclear standoffs historically de-escalate diplomatically 61% of the time, escalate to limited military exchange 28% of the time, and reach full war 11% of the time.
Return ONLY this JSON structure with no markdown, no explanation, no preamble:
{
  "entity": { "label": "string", "type": "string", "modelConfidence": 0 },
  "trajectory": {
    "timelineEvents": [
      { "year": 0, "label": "string", "type": "past"|"present"|"projected", "significance": "critical"|"major"|"minor" }
    ],
    "intensitySeries": [
      { "period": "string", "value": 0, "type": "verified"|"projected"|"high_risk", "notes": "string" }
    ],
    "metricComparison": [
      { "metric": "string", "unit": "string", "pastValue": "string", "pastYear": 0, "presentValue": "string", "projectedValue": "string", "projectedYear": 0, "pastTrend": "positive"|"negative"|"neutral", "futureTrend": "positive"|"negative"|"uncertain" }
    ]
  },
  "scenarios": [
    {
      "name": "string",
      "probability": 0,
      "type": "best"|"base"|"worst",
      "description": "string",
      "economicImpactGDPPercent": 0,
      "oilPriceImpact": "string",
      "timeHorizonMonths": 0,
      "affectedEntities": [{ "name": "string", "direction": "up"|"down"|"neutral", "magnitude": "high"|"medium"|"low" }],
      "keyConditions": ["string"]
    }
  ],
  "indicators": [
    {
      "name": "string",
      "currentValue": 0,
      "currentUnit": "string",
      "escalationThreshold": 0,
      "historicalBaseline": 0,
      "trend": "rising"|"falling"|"stable",
      "daysToThreshold": 0,
      "significance": "string"
    }
  ],
  "confidenceBands": [
    { "horizon": "string", "p10": 0, "p50": 0, "p90": 0, "rationale": "string" }
  ],
  "escalationTriggers": [
    { "event": "string", "probability90Days": 0, "severity": "critical"|"high"|"medium", "financialImpact": "string", "leadTime": "string" }
  ],
  "deescalationTriggers": [
    { "event": "string", "probability90Days": 0, "financialImpact": "string", "keyActors": ["string"] }
  ]
}
Calibration rules you must follow: scenario probabilities must sum to exactly 100. Indicator values must be real numbers on a 0–100 index scale normalized against historical maximums for that indicator. Confidence band P10 must be less than P50 which must be less than P90. Every financial impact must include a specific dollar amount or percentage range, not vague descriptors.`;

router.get("/:nodeId", async (req: Request, res: Response): Promise<void> => {
  const { nodeId } = req.params;
  const nodeLabel = req.query.nodeLabel as string;
  const nodeType = req.query.nodeType as string;

  if (!nodeId || !nodeLabel || !nodeType) {
    res.status(400).json({ error: "Missing required query parameters: nodeLabel, nodeType" });
    return;
  }

  // Check cache
  const cached = predictionCache.get(nodeId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Predict] Returning cached briefing for ${nodeId}`);
    res.json(cached.data);
    return;
  }

  console.log(`[Predict] Generating briefing via Groq for ${nodeId} (${nodeLabel})`);

  try {
    const userPrompt = `Generate a complete predictive intelligence briefing for: ${nodeLabel} (type: ${nodeType}). Use real historical data as past baselines. Apply historical base rates for your probability estimates. Be specific with every number.`;

    const response = await openai.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ]
    });

    const rawText = response.choices[0]?.message?.content || "";
    // Clean potential markdown code blocks
    const jsonStr = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let parsedData;
    try {
      parsedData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("[Predict] Parsing error. Groq output:", rawText);
      throw new Error("Failed to parse agentic JSON output");
    }

    // Set cache
    predictionCache.set(nodeId, { data: parsedData, timestamp: Date.now() });

    res.json(parsedData);
  } catch (err: any) {
    console.error("[Predict] Agentic error:", err);
    res.status(500).json({ error: "Failed to generate predictive briefing", message: err.message });
  }
});

export default router;
