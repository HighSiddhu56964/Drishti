import { useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
// @ts-ignore
import { GlobeRenderer } from './globe/GlobeRenderer';
// @ts-ignore
import { SatelliteSwarm } from './globe/SatelliteSwarm';
// @ts-ignore
import { FlightSwarm } from './globe/FlightSwarm';
// @ts-ignore
import { VesselSwarm } from './globe/VesselSwarm';
// @ts-ignore
import { useOrbitalEngine } from './globe/OrbitalEngine';
// @ts-ignore
import { useAirspaceEngine } from './globe/AirspaceEngine';
// @ts-ignore
import { useMaritimeEngine } from './globe/MaritimeEngine';

export default function GlobeView() {
  const [activeDomain, setActiveDomain] = useState('ALL');
  const [globeMode, setGlobeMode] = useState('REALISTIC');
  const [mapProjection, setMapProjection] = useState('3D');

  const { satellites, loading: orbitLoading } = useOrbitalEngine();
  const { flights, loading: flightsLoading } = useAirspaceEngine();
  const { vessels, loading: vesselsLoading } = useMaritimeEngine();

  // AviationStack flight data for Airspace
  const [aviationFlights, setAviationFlights] = useState<any[]>([]);
  const [aviationLoading, setAviationLoading] = useState(false);

  useEffect(() => {
    if (activeDomain === 'AIRSPACE' || activeDomain === 'ALL') {
      setAviationLoading(true);
      fetch('/api/aviation/flights')
        .then(r => r.json())
        .then(data => {
          if (data.flights) {
            setAviationFlights(data.flights);
          }
          setAviationLoading(false);
        })
        .catch(() => setAviationLoading(false));
    }
  }, [activeDomain]);

  const [timeScale, setTimeScale] = useState(1);
  const [selectedData, setSelectedData] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Merge aviation data with engine flights when in AIRSPACE/ALL
  const mergedFlights = useMemo(() => {
    const engineFlights = flights || [];
    // The backend now formats OpenSky data as flat objects that match the engine's structure
    const avFlights = aviationFlights.map((f: any) => ({
      id: f.id,
      name: f.name || 'Unknown',
      latitude: f.latitude || 0,
      longitude: f.longitude || 0,
      altitude: f.altitude !== undefined ? `${f.altitude}m` : 'N/A',
      velocity: f.velocity || 0,
      heading: f.heading || 0,
      // Default to the type the backend assigns or fallback
      type: f.type || 'CIVILIAN',
      source: f.source || 'opensky',
      departure: f.departure || 'Unknown',
      arrival: f.arrival || 'Unknown',
      // Store raw numerical altitude on root for 3D positioning mapping in FlightSwarm
      _rawAltitude: f.altitude || 0
    })).filter((f: any) => f.latitude && f.longitude);
    
    // We adjust the `altitude` property so `FlightSwarm`'s 3D positioning works correctly
    // FlightSwarm maps altitude directly via `flight.altitude` in its coordinate functions.
    // The string format '123m' breaks Three.js coordinate mapping, so we pass raw numerical values and format visually on Select
    return [...engineFlights, ...avFlights].map(f => {
       if (typeof f.altitude === 'string' && f._rawAltitude !== undefined) {
           f.altitudeStr = f.altitude; // Keep string for UI if needed
           f.altitude = f._rawAltitude; // Revert to numeric for ThreeJS projection
       }
       return f;
    });
  }, [flights, aviationFlights]);

  const activeDataset = useMemo(() => {
    if (activeDomain === 'ALL') {
      return [...(satellites || []), ...(mergedFlights || []), ...(vessels || [])];
    }
    if (activeDomain === 'ORBITAL') return satellites;
    if (activeDomain === 'AIRSPACE') return mergedFlights;
    if (activeDomain === 'MARITIME') return vessels;
    return [];
  }, [activeDomain, satellites, mergedFlights, vessels]);

  const filteredData = useMemo(() => {
    if (activeFilter === 'ALL') return activeDataset;
    return activeDataset.filter((d: any) => d.type === activeFilter);
  }, [activeDataset, activeFilter]);

  useEffect(() => { setSelectedData(null); }, [activeDomain]);

  const currentLoading = activeDomain === 'ALL'
    ? (orbitLoading || flightsLoading || vesselsLoading || aviationLoading)
    : activeDomain === 'ORBITAL' ? orbitLoading
    : activeDomain === 'AIRSPACE' ? (flightsLoading || aviationLoading)
    : vesselsLoading;

  return (
    <div className="globe-view">
      {/* Globe HUD Controls */}
      <div className="globe-hud">
        <div className="domain-switcher">
          {['ALL', 'ORBITAL', 'AIRSPACE', 'MARITIME'].map(domain => (
            <button
              key={domain}
              onClick={() => { setActiveDomain(domain); setActiveFilter('ALL'); }}
              className={`domain-btn ${activeDomain === domain ? 'active' : ''}`}
            >
              {domain === 'ALL' ? '◉ ALL' : domain}
            </button>
          ))}
        </div>
        <div className="filter-bar">
          {['ALL', 'MILITARY', 'HIGH_VALUE', 'CIVILIAN'].map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`filter-btn ${activeFilter === f ? `active ${f.toLowerCase()}` : ''}`}
            >
              {f} {activeFilter === f && `[${filteredData.length}]`}
            </button>
          ))}
        </div>
      </div>

      {/* Render Mode Switcher */}
      <div className="globe-controls">
        <div className="render-modes">
          <button
            onClick={() => setMapProjection(mapProjection === '3D' ? '2D' : '3D')}
            className={`mode-btn ${mapProjection === '2D' ? 'active-green' : ''}`}
          >
            {mapProjection === '2D' ? 'FLAT' : 'SPHERE'}
          </button>
          {['TACTICAL', 'REALISTIC', 'THERMAL'].map(mode => (
            <button
              key={mode}
              onClick={() => setGlobeMode(mode)}
              className={`mode-btn ${globeMode === mode ? (mode === 'THERMAL' ? 'active-orange' : 'active') : ''}`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="time-control">
          <span className="time-label">T-SCALE: {timeScale}x</span>
          <input
            type="range"
            min="1"
            max="5000"
            value={timeScale}
            onChange={(e) => setTimeScale(parseInt(e.target.value))}
          />
        </div>
      </div>

      {/* Target Info Panel */}
      {selectedData && (
        <div className="target-panel">
          <div className="target-header">
            <span className="target-icon">⊕</span>
            <span className="target-name">{selectedData.name || 'UNKNOWN'}</span>
            <span className={`target-type type-${(selectedData.type || '').toLowerCase()}`}>{selectedData.type}</span>
          </div>
          <div className="target-grid">
            <span className="tg-label">LAT</span><span className="tg-val">{selectedData.latitude}°</span>
            <span className="tg-label">LON</span><span className="tg-val">{selectedData.longitude}°</span>
            <span className="tg-label">VEL</span><span className="tg-val">{selectedData.velocity} m/s</span>
            <span className="tg-label">ALT</span><span className="tg-val">{selectedData.altitude}</span>
            {selectedData.departure && (
              <><span className="tg-label">DEP</span><span className="tg-val">{selectedData.departure}</span></>
            )}
            {selectedData.arrival && (
              <><span className="tg-label">ARR</span><span className="tg-val">{selectedData.arrival}</span></>
            )}
            {selectedData.source === 'aviationstack' && (
              <><span className="tg-label">SRC</span><span className="tg-val">AVIATIONSTACK</span></>
            )}
            {selectedData.source === 'opensky' && (
              <><span className="tg-label">SRC</span><span className="tg-val">OPENSKY</span></>
            )}
          </div>
        </div>
      )}

      {currentLoading && (
        <div className="globe-loading">
          <div className="spinner-sm" />
          <span>ACQUIRING {activeDomain} TELEMETRY...</span>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} className="globe-canvas">
        <color attach="background" args={['#000800']} />
        <GlobeRenderer mode={globeMode} is2D={mapProjection === '2D'} />

        {/* ORBITAL — show in ORBITAL or ALL */}
        {!orbitLoading && (activeDomain === 'ORBITAL' || activeDomain === 'ALL') && (
          <SatelliteSwarm
            satellites={activeDomain === 'ALL' ? satellites : filteredData}
            timeScale={timeScale}
            onSelect={setSelectedData}
            selectedSatData={selectedData}
            is2D={mapProjection === '2D'}
          />
        )}

        {/* AIRSPACE — show in AIRSPACE or ALL */}
        {!(flightsLoading && aviationLoading) && (activeDomain === 'AIRSPACE' || activeDomain === 'ALL') && (
          <FlightSwarm
            flights={activeDomain === 'ALL' ? mergedFlights : filteredData}
            onSelect={setSelectedData}
            selectedFlightData={selectedData}
            is2D={mapProjection === '2D'}
          />
        )}

        {/* MARITIME — show in MARITIME or ALL */}
        {!vesselsLoading && (activeDomain === 'MARITIME' || activeDomain === 'ALL') && (
          <VesselSwarm
            vessels={activeDomain === 'ALL' ? vessels : filteredData}
            onSelect={setSelectedData}
            selectedVesselData={selectedData}
            is2D={mapProjection === '2D'}
          />
        )}
      </Canvas>
    </div>
  );
}
