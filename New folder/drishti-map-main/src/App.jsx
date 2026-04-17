import { useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { HUD } from './components/HUD';
import { GlobeRenderer } from './components/GlobeRenderer';
import { SatelliteSwarm } from './components/SatelliteSwarm';
import { FlightSwarm } from './components/FlightSwarm';
import { VesselSwarm } from './components/VesselSwarm';
import { useOrbitalEngine } from './components/OrbitalEngine';
import { useAirspaceEngine } from './components/AirspaceEngine';
import { useMaritimeEngine } from './components/MaritimeEngine';

export default function App() {
  const [activeDomain, setActiveDomain] = useState('ORBITAL'); // ORBITAL, AIRSPACE, MARITIME
  const [globeMode, setGlobeMode] = useState('REALISTIC'); // REALISTIC, TACTICAL, THERMAL
  const [mapProjection, setMapProjection] = useState('3D'); // 3D, 2D
  
  const { satellites, loading: orbitLoading } = useOrbitalEngine();
  const { flights, loading: flightsLoading } = useAirspaceEngine();
  const { vessels, loading: vesselsLoading, status: maritimeStatus } = useMaritimeEngine();

  const [timeScale, setTimeScale] = useState(1);
  const [selectedData, setSelectedData] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Compute active dataset to filter
  const activeDataset = useMemo(() => {
    if (activeDomain === 'ORBITAL') return satellites;
    if (activeDomain === 'AIRSPACE') return flights;
    if (activeDomain === 'MARITIME') return vessels;
    return [];
  }, [activeDomain, satellites, flights, vessels]);

  const filteredData = useMemo(() => {
    if (activeFilter === 'ALL') return activeDataset;
    return activeDataset.filter(d => d.type === activeFilter);
  }, [activeDataset, activeFilter]);

  // Clear selection if filter causes it to disappear or domain changes
  useEffect(() => {
    setSelectedData(null);
  }, [activeDomain]);

  useEffect(() => {
    if (selectedData && activeFilter !== 'ALL' && selectedData.type !== activeFilter) {
      setSelectedData(null);
    }
  }, [activeFilter, selectedData]);

  const handleAnalyze = (id) => {
    alert(`[ANVAY GRAPH] Initiating multi-domain geopolitical analysis for ID: ${id} [${activeDomain}]`);
  };

  const currentLoading = activeDomain === 'ORBITAL' ? orbitLoading : activeDomain === 'AIRSPACE' ? flightsLoading : vesselsLoading;

  return (
    <div className="w-full h-full relative bg-background overflow-hidden">
      <HUD 
        selectedData={selectedData} 
        onAnalyze={handleAnalyze} 
        onTimeScaleChange={setTimeScale} 
        timeScale={timeScale} 
        loading={currentLoading}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        satCount={filteredData?.length || 0}
        activeDomain={activeDomain}
        setActiveDomain={setActiveDomain}
        maritimeStatus={maritimeStatus}
        globeMode={globeMode}
        setGlobeMode={setGlobeMode}
        mapProjection={mapProjection}
        setMapProjection={setMapProjection}
      />
      
      <div className="absolute inset-0 pointer-events-auto flex items-center justify-center">
        {/* The deeply cropped CRT Screen */}
        <div className="relative w-[90vw] h-[90vh] max-w-6xl max-h-[800px] lens-cutout overflow-hidden shadow-[0_0_150px_rgba(0,0,0,0.9)_inset]">
           <div className="crt-overlay"></div>
           <div className="crt-vignette"></div>
           <Canvas camera={{ position: [0, 0, 5], fov: 45 }} className="w-full h-full">
             <color attach="background" args={['#0a0f18']} />
          <GlobeRenderer mode={globeMode} is2D={mapProjection === '2D'} />
          {!currentLoading && activeDomain === 'ORBITAL' && (
            <SatelliteSwarm 
              satellites={filteredData} 
              timeScale={timeScale} 
              onSelect={setSelectedData}
              selectedSatData={selectedData}
              is2D={mapProjection === '2D'}
            />
          )}
          {!currentLoading && activeDomain === 'AIRSPACE' && (
            <FlightSwarm 
              flights={filteredData} 
              onSelect={setSelectedData}
              selectedFlightData={selectedData}
              is2D={mapProjection === '2D'}
            />
          )}
          {!currentLoading && activeDomain === 'MARITIME' && (
            <VesselSwarm 
              vessels={filteredData} 
              onSelect={setSelectedData}
              selectedVesselData={selectedData}
              is2D={mapProjection === '2D'}
            />
          )}
        </Canvas>
        </div> {/* closing lens-cutout */}
      </div>
    </div>
  );
}
