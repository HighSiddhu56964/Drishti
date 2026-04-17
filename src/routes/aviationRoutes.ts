/**
 * Aviation Routes — OpenSky Network real-time flight data
 * GET /api/aviation/flights — fetches live flights from OpenSky API
 */

import { Router, type Request, type Response } from "express";

const router = Router();

let flightCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60_000; // 60 seconds cache to avoid hammering API

router.get("/flights", async (_req: Request, res: Response): Promise<void> => {
  try {
    // Return cached data if fresh enough
    if (flightCache && Date.now() - flightCache.timestamp < CACHE_TTL) {
      console.log(`[Aviation] Returning cached data (${flightCache.data.flights?.length || 0} flights)`);
      res.json(flightCache.data);
      return;
    }

    console.log("[Aviation] Fetching live flights from OpenSky Network...");

    const url = `https://opensky-network.org/api/states/all`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429 && flightCache) {
        console.log("[Aviation] OpenSky rate-limited (429). Falling back to stale cache.");
        res.json(flightCache.data);
        return;
      }
      throw new Error(`OpenSky API returned ${response.status}`);
    }

    const raw = await response.json();

    // OpenSky data format: raw.states is an array of arrays
    // [0, icao24], [1, callsign], [2, origin_country], [3, time_position], [4, last_contact],
    // [5, longitude], [6, latitude], [7, baro_altitude], [8, on_ground], [9, velocity],
    // [10, true_track], [11, vertical_rate], [12, sensors], [13, geo_altitude], [14, squawk],
    // [15, spi], [16, position_source]
    
    // Filter to aircraft that are not on ground and have valid lat/lon
    // Then map to standard frontend contract
    let liveFlights: any[] = [];
    if (raw.states && Array.isArray(raw.states)) {
        liveFlights = raw.states
          .filter((state: any[]) => state[8] === false && state[6] !== null && state[5] !== null)
          .map((state: any[]) => {
              const callsign = typeof state[1] === 'string' ? state[1].trim() : String(state[1] || 'Unknown');
              // Basic check for military flights based on common military callsign prefixes or empty strings (sometimes mil flights hide callsigns)
              const type = (callsign.startsWith('RCH') || callsign.startsWith('MIL') || state[2] === 'Military') ? 'MILITARY' : 'CIVILIAN';
              
              return {
                  id: state[0], // icao24
                  name: callsign,
                  longitude: state[5],
                  latitude: state[6],
                  altitude: state[13] || state[7] || 0, // favor geo_altitude over baro_altitude
                  velocity: state[9] || 0,
                  heading: state[10] || 0,
                  type: type,
                  source: "opensky",
                  departure: state[2], // reusing origin_country as departure for display
                  arrival: "Unknown"
              };
          });
    }

    // Since OpenSky returns ~10,000+ flights globally which can be heavy, let's limit it similar to the previous API or cap to 1000 for safety, let's keep it max 2000
    if (liveFlights.length > 2000) {
        liveFlights = liveFlights.slice(0, 2000);
    }

    const result = {
      flights: liveFlights,
      total: liveFlights.length,
      source: "opensky",
      timestamp: new Date().toISOString(),
    };

    // Cache the result
    flightCache = { data: result, timestamp: Date.now() };

    console.log(`[Aviation] Acquired ${liveFlights.length} live flights`);
    res.json(result);
  } catch (err) {
    console.error("[Aviation] Error fetching flights:", err);
    res.status(500).json({
      error: "Failed to fetch flight data",
      message: err instanceof Error ? err.message : "Unknown error",
      flights: [],
    });
  }
});

export default router;
