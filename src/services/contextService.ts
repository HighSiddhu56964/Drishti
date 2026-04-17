/**
 * Data Context Layer
 *
 * Fetches real-time context from GDELT news API first.
 * Falls back to AI-generated context if GDELT fails or returns no results.
 */

import OpenAI from "openai";
import {
  fetchGdeltArticles,
  buildContextFromArticles,
} from "./gdeltService.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// ─── AI Fallback Prompt ──────────────────────────────────────────────────────

const FALLBACK_SYSTEM_PROMPT = `You are a world-class intelligence analyst and geopolitical researcher.
Given a user query, produce a DETAILED, multi-domain contextual briefing (600–1000 words) that covers:

1. **Geopolitical context** — relevant countries, alliances, conflicts, sanctions, treaties
2. **Economic impact** — GDP effects, market disruptions, inflation, currency impacts
3. **Trade relationships** — imports/exports, supply chains, trade routes, tariffs
4. **Organizations involved** — international bodies (UN, OPEC, NATO), companies, NGOs
5. **Key infrastructure** — pipelines, ports, shipping lanes, military bases
6. **Key persons** — political leaders, CEOs, diplomats involved
7. **Historical precedents** — past events that are analogous

Use REAL names of countries, companies, people, places, and organizations.
Be factual and specific. Include numbers and data where appropriate.
Write as a single cohesive briefing, not bullet points.`;

// ─── Main Context Function ──────────────────────────────────────────────────

export async function fetchContextData(query: string): Promise<{
  context: string;
  source: "gdelt" | "ai_fallback";
  articleCount: number;
}> {
  // ── Try GDELT first ───────────────────────────────────────────────────
  try {
    console.log("[Context] Attempting GDELT fetch...");
    const articles = await fetchGdeltArticles(query);

    if (articles.length > 0) {
      const context = buildContextFromArticles(articles, query);
      console.log(
        `[Context] GDELT success — ${articles.length} articles, ${context.length} chars`
      );
      return { context, source: "gdelt", articleCount: articles.length };
    }

    console.warn("[Context] GDELT returned 0 articles, falling back to AI");
  } catch (err) {
    console.error("[Context] GDELT failed, falling back to AI:", err);
  }

  // ── Fallback: AI-generated context ────────────────────────────────────
  console.log("[Context] Using AI fallback...");
  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.4,
    max_tokens: 1500,
    messages: [
      { role: "system", content: FALLBACK_SYSTEM_PROMPT },
      { role: "user", content: query },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Both GDELT and AI fallback returned empty responses.");
  }

  console.log(`[Context] AI fallback success — ${content.length} chars`);
  return { context: content, source: "ai_fallback", articleCount: 0 };
}
