import { useState, useEffect } from 'react';

const OPENSKY_API = 'https://opensky-network.org/api/states/all';

const MILITARY_CALLSIGNS = ['RCH', 'QID', 'BART', 'TEST', 'NAVY', 'AF', 'HOUND', 'RRR', 'CV', 'CNV', 'PAT', 'SPAR'];
const HIGH_VALUE_CALLSIGNS = ['AF1', 'SAM', 'EXEC', 'C17', 'C130', 'B52'];

function determineAircraftType(callsign) {
  if (!callsign) return 'CIVILIAN';
  const callsignUpper = callsign.trim().toUpperCase();
  
  for (let hv of HIGH_VALUE_CALLSIGNS) {
    if (callsignUpper.includes(hv)) return 'HIGH_VALUE';
  }
  for (let mil of MILITARY_CALLSIGNS) {
    if (callsignUpper.startsWith(mil)) return 'MILITARY';
  }
  return 'CIVILIAN';
}

export function useAirspaceEngine() {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let intervalId;

    const fetchFlights = async () => {
      try {
        const response = await fetch(OPENSKY_API);
        if (!response.ok) {
          throw new Error(`OpenSky API Error: ${response.status}`);
        }
        const data = await response.json();
        
        // Parse OpenSky massive array
        const parsedFlights = [];
        const states = data.states || [];
        
        // We will process a random subset or up to 2000 flights to ensure high performance
        // and prioritize ones with valid coordinates
        let limit = 2000;
        for (let i = 0; i < states.length; i++) {
          const state = states[i];
          const icao24 = state[0];
          const callsign = state[1];
          const originCountry = state[2];
          const longitude = state[5];
          const latitude = state[6];
          const altitude = state[7] || state[13]; // baro or geo
          const onGround = state[8];
          const velocity = state[9];
          const trueTrack = state[10];
          
          if (longitude !== null && latitude !== null && !onGround && altitude > 0) {
             parsedFlights.push({
               id: icao24,
               name: callsign ? callsign.trim() : originCountry,
               latitude,
               longitude,
               altitude, // in meters
               velocity, // in m/s
               heading: trueTrack || 0,
               type: determineAircraftType(callsign),
               origin: originCountry
             });
             limit--;
             if (limit <= 0) break;
          }
        }
        
        setFlights(parsedFlights);
        setLoading(false);
      } catch (e) {
        console.error("Failed to fetch airspace data:", e);
      }
    };

    fetchFlights();
    // OpenSky limits to 10s for unauthenticated users, we'll poll every 15s to be safe
    intervalId = setInterval(fetchFlights, 15000);

    return () => clearInterval(intervalId);
  }, []);

  return { flights, loading };
}
