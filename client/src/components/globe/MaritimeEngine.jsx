import { useState, useEffect } from 'react';

const MARITIME_API = 'http://localhost:4000/api/maritime';

export function useMaritimeEngine() {
  const [ships, setShips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("CONNECTING");

  useEffect(() => {
    let intervalId;

    const fetchShips = async () => {
      try {
        const response = await fetch(MARITIME_API);
        if (!response.ok) {
          throw new Error(`Maritime Backend Error: ${response.status}`);
        }
        const data = await response.json();
        
        setStatus(data.status);
        
        // Data format: { status, count, data: [ { mmsi, lat, lon, sog, heading, name, path, type }, ... ] }
        const parsedShips = (data.data || []).map(ship => ({
            id: ship.mmsi,
            name: ship.name,
            latitude: ship.lat,
            longitude: ship.lon,
            altitude: 0, // Sea level
            velocity: ship.sog * 0.514444, // Convert knots to m/s
            heading: ship.heading,
            type: ship.type,
            path: ship.path // array of [lat, lon]
        }));
        
        setShips(parsedShips);
        setLoading(false);
      } catch (e) {
        console.error("Failed to fetch maritime data (is backend running?):", e);
        setStatus("OFFLINE");
      }
    };

    fetchShips();
    intervalId = setInterval(fetchShips, 3000); // Poll backend every 3 seconds

    return () => clearInterval(intervalId);
  }, []);

  return { vessels: ships, loading, status };
}
