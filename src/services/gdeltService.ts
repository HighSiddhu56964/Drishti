/**
 * GDELT Real-Time News Service
 *
 * Fetches live news articles from the GDELT Project API based on a search query.
 * Returns deduplicated, cleaned article data for downstream context building.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GdeltArticle {
  title: string;
  source: string;
  url: string;
  seendate: string;
  socialimage?: string;
  domain: string;
  language: string;
}

export interface GdeltResponse {
  articles: GdeltArticle[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const GDELT_BASE_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc";

const MAX_RECORDS = 10;
const REQUEST_TIMEOUT_MS = 12000;

// ─── Fetch Articles ──────────────────────────────────────────────────────────

export async function fetchGdeltArticles(
  query: string
): Promise<GdeltArticle[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `${GDELT_BASE_URL}?query=${encodedQuery}&mode=ArtList&maxrecords=${MAX_RECORDS}&format=json`;

  console.log(`[GDELT] Fetching: ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      throw new Error(`GDELT API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json() as GdeltResponse;

    if (!data.articles || !Array.isArray(data.articles)) {
      console.warn("[GDELT] No articles array in response");
      return [];
    }

    // Deduplicate by title (case-insensitive)
    const seen = new Set<string>();
    const unique: GdeltArticle[] = [];

    for (const article of data.articles) {
      const key = article.title?.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(article);
    }

    console.log(
      `[GDELT] Fetched ${data.articles.length} articles, ${unique.length} unique`
    );

    return unique;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("GDELT API request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Build Context Text ──────────────────────────────────────────────────────

/**
 * Converts GDELT articles into a structured context paragraph
 * suitable for the AI graph extraction engine.
 */
export function buildContextFromArticles(
  articles: GdeltArticle[],
  query: string
): string {
  if (articles.length === 0) {
    return "";
  }

  const lines: string[] = [
    `The following is a summary of ${articles.length} recent real-world news articles related to: "${query}".\n`,
  ];

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const date = a.seendate
      ? new Date(
          a.seendate.replace(
            /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,
            "$1-$2-$3T$4:$5:$6Z"
          )
        ).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "Recent";

    lines.push(
      `[${i + 1}] "${a.title}" — ${a.source || a.domain} (${date})`
    );
  }

  lines.push(
    `\nThese articles collectively cover geopolitical events, economic impacts, trade dynamics, and organizational responses related to the query. Extract all entities and relationships from the headlines and sources above.`
  );

  return lines.join("\n");
}
