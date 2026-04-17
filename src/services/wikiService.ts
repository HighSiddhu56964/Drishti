/**
 * Wikipedia Entity Service
 *
 * Fetches detailed information about an entity from the Wikipedia REST API.
 * Uses the free MediaWiki API — no API key required.
 */

export interface WikiEntityInfo {
  title: string;
  summary: string;
  description: string;
  thumbnail?: string;
  url: string;
  coordinates?: { lat: number; lon: number };
  extract: string;          // Full plain-text extract
  categories: string[];
}

const WIKI_API = "https://en.wikipedia.org/api/rest_v1";
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Fetch a rich summary for an entity from Wikipedia.
 */
export async function fetchEntityInfo(label: string): Promise<WikiEntityInfo | null> {
  const searchTerm = encodeURIComponent(label.trim());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // ── Step 1: Get the page summary ──────────────────────────────────
    const summaryRes = await fetch(
      `${WIKI_API}/page/summary/${searchTerm}`,
      {
        signal: controller.signal,
        headers: { "User-Agent": "DrishtiKG/1.0 (Knowledge Graph Engine)" },
      }
    );

    if (!summaryRes.ok) {
      // Try a search fallback if direct title fails
      return await searchAndFetch(label, controller.signal);
    }

    const data = await summaryRes.json() as any;

    if (data.type === "disambiguation") {
      // Try search fallback for disambiguation pages
      return await searchAndFetch(label, controller.signal);
    }

    return {
      title: data.title || label,
      summary: data.description || "",
      description: data.extract || "",
      thumbnail: data.thumbnail?.source || data.originalimage?.source || undefined,
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${searchTerm}`,
      coordinates: data.coordinates
        ? { lat: data.coordinates.lat, lon: data.coordinates.lon }
        : undefined,
      extract: data.extract || "",
      categories: [],
    };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.warn(`[Wiki] Timeout fetching "${label}"`);
    } else {
      console.warn(`[Wiki] Error fetching "${label}":`, err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Search Wikipedia for a term and fetch the top result's summary.
 */
async function searchAndFetch(
  query: string,
  signal: AbortSignal
): Promise<WikiEntityInfo | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`;
    const searchRes = await fetch(searchUrl, {
      signal,
      headers: { "User-Agent": "DrishtiKG/1.0 (Knowledge Graph Engine)" },
    });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json() as any[];
    const titles = searchData[1] as string[];
    if (!titles || titles.length === 0) return null;

    const bestTitle = encodeURIComponent(titles[0]);
    const summaryRes = await fetch(
      `${WIKI_API}/page/summary/${bestTitle}`,
      {
        signal,
        headers: { "User-Agent": "DrishtiKG/1.0 (Knowledge Graph Engine)" },
      }
    );

    if (!summaryRes.ok) return null;

    const data = await summaryRes.json() as any;

    return {
      title: data.title || titles[0],
      summary: data.description || "",
      description: data.extract || "",
      thumbnail: data.thumbnail?.source || undefined,
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${bestTitle}`,
      coordinates: data.coordinates
        ? { lat: data.coordinates.lat, lon: data.coordinates.lon }
        : undefined,
      extract: data.extract || "",
      categories: [],
    };
  } catch {
    return null;
  }
}
