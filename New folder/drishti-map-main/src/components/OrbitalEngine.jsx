import { useState, useEffect } from 'react';
import { parseTLEs } from '../utils/tleParser';

const CORS_PROXY = "https://api.allorigins.win/raw?url=";
const PROXY = "https://corsproxy.io/?";
const CELESTRAK_STATIONS = `${PROXY}${encodeURIComponent("https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle")}`;
const CELESTRAK_ACTIVE = `${PROXY}${encodeURIComponent("https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle")}`;
const CELESTRAK_MILITARY = `${PROXY}${encodeURIComponent("https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=tle")}`;

export function useOrbitalEngine() {
  const [satellites, setSatellites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    async function loadData() {
      setLoading(true);
      try {
        // Fetch feeds in parallel directly from Celestrak (they support CORS)
        const [stationsRes, militaryRes, activeRes] = await Promise.all([
          fetch(CELESTRAK_STATIONS).then(r => r.text()),
          fetch(CELESTRAK_MILITARY).then(r => r.text()),
          fetch(CELESTRAK_ACTIVE).then(r => r.text())
        ]);

        if (!mounted) return;

        const stations = parseTLEs(stationsRes, 'HIGH_VALUE');
        const military = parseTLEs(militaryRes, 'MILITARY');
        const active = parseTLEs(activeRes, 'CIVILIAN');

        // Deduplicate by ID
        const allSatsMap = new Map();
        [...stations, ...military, ...active].forEach(sat => {
          if (!allSatsMap.has(sat.id)) {
            allSatsMap.set(sat.id, sat);
          }
        });

        const combined = Array.from(allSatsMap.values());
        
        const highValue = combined.filter(s => s.type === 'HIGH_VALUE');
        const mils = combined.filter(s => s.type === 'MILITARY');
        const civs = combined.filter(s => s.type === 'CIVILIAN');

        let selected = [];
        // Prioritize ALL High-Value and ALL Military assets first
        selected = selected.concat(highValue);
        selected = selected.concat(mils);
        // User requested ALL important/live satellites: Append every single civilian asset available
        selected = selected.concat(civs);
        
        setSatellites(selected);
      } catch (err) {
        console.error("Failed to load TLE data", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  return { satellites, loading };
}
