import { Crosshair, Info, Radar } from 'lucide-react';
import { useEffect, useState } from 'react';

export function HUD({ selectedData: initialData, onAnalyze, onTimeScaleChange, timeScale, loading, activeFilter, setActiveFilter, satCount, activeDomain, setActiveDomain, maritimeStatus, globeMode, setGlobeMode, mapProjection, setMapProjection }) {
  const [liveData, setLiveData] = useState(initialData);

  useEffect(() => {
    setLiveData(initialData);

    const handler = (newData) => {
      setLiveData(prev => {
        if (!prev) return null;
        return { ...prev, ...newData };
      });
    };
    
    window.updateHUDTelemetry = handler;
    return () => {
      window.updateHUDTelemetry = null;
    };
  }, [initialData]);

  const selectedData = liveData;
  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6">
      <header className="flex justify-between items-start pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tactical-cyan opacity-75"></span>
            <div className="relative flex justify-center items-center rounded-full h-10 w-10 bg-tactical-dark border border-tactical-cyan">
               <Radar size={20} className="text-tactical-cyan" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-[0.2em] text-white uppercase drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]">
              ANVAY {activeDomain === 'ORBITAL' ? 'ORBITAL' : activeDomain === 'AIRSPACE' ? 'AIRSPACE' : 'MARITIME'}
            </h1>
            <p className="text-xs text-tactical-cyan font-mono tracking-widest">Intelligence Module // SGP4 Live</p>
          </div>
        </div>

        {/* DOMAIN SWITCHER */}
        <div className="flex border border-tactical-cyan/40 bg-tactical-panel/80 rounded backdrop-blur">
           {['ORBITAL', 'AIRSPACE', 'MARITIME'].map(domain => (
             <button 
                key={domain}
                onClick={() => { setActiveDomain(domain); setActiveFilter('ALL'); }}
                className={`px-4 py-2 font-bold text-xs tracking-widest uppercase transition-all ${
                  activeDomain === domain ? 'bg-tactical-cyan text-tactical-dark shadow-[0_0_10px_rgba(0,240,255,0.8)]' : 'text-tactical-cyan hover:bg-tactical-cyan/20'
                }`}
             >
                {domain}
             </button>
           ))}
        </div>

        <div className="flex flex-col items-end gap-2">
          {loading ? (
             <div className="text-tactical-cyan text-sm tracking-widest animate-pulse border border-tactical-cyan px-3 py-1 bg-tactical-cyan/10">
                ACQUIRING {activeDomain} TELEMETRY...
             </div>
          ) : (
             <div className="flex gap-2 bg-tactical-panel/80 p-2 border border-tactical-cyan/30 rounded backdrop-blur">
               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mr-2 self-center">Filter:</span>
               {['ALL', 'MILITARY', 'HIGH_VALUE', 'CIVILIAN', 'CARGO'].map(f => (
                 <button 
                   key={f}
                   onClick={() => setActiveFilter(f)}
                   className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider rounded border transition-all ${
                     activeFilter === f 
                       ? f === 'MILITARY' ? 'bg-tactical-red/20 text-tactical-red border-tactical-red shadow-[0_0_10px_rgba(255,32,64,0.5)]' 
                         : f === 'HIGH_VALUE' ? 'bg-tactical-cyan/20 text-tactical-cyan border-tactical-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)]' 
                         : f === 'CARGO' ? 'bg-orange-500/20 text-orange-400 border-orange-500 shadow-[0_0_10px_rgba(255,165,0,0.5)]'
                         : f === 'CIVILIAN' ? 'bg-tactical-green/20 text-tactical-green border-tactical-green shadow-[0_0_10px_rgba(0,250,154,0.5)]'
                         : 'bg-white/20 text-white border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                       : 'bg-transparent text-gray-500 border-gray-600 hover:text-white hover:border-gray-400'
                   }`}
                 >
                   {f} {activeFilter === f && `[${satCount}]`}
                 </button>
               ))}
             </div>
          )}
          {activeDomain === 'MARITIME' && maritimeStatus && maritimeStatus !== "LIVE" && (
             <div className="text-tactical-red text-xs tracking-widest animate-pulse border border-tactical-red px-2 py-1 bg-tactical-red/10 mt-1">
               AIS: {maritimeStatus}
             </div>
          )}
        </div>
      </header>

      {/* Target Panel */}
      <div className="absolute top-24 left-6 pointer-events-auto w-80">
        {selectedData ? (
          <div className="bg-tactical-panel border-l-4 border-tactical-cyan backdrop-blur-md p-5 rounded-r shadow-[0_0_15px_rgba(0,240,255,0.15)] flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-tactical-cyan/30 pb-2">
              <Crosshair size={18} className="text-tactical-cyan" />
              <h2 className="text-lg font-bold tracking-wide text-tactical-cyan truncate">{selectedData.name || 'UNKNOWN CALLSIGN'}</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-y-3 text-sm pr-2">
              <div className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Classification</div>
              <div className="text-right">
                <span className={`px-2 py-0.5 text-[9px] rounded border ${
                    selectedData.type === 'MILITARY' ? 'border-tactical-red text-tactical-red bg-tactical-red/10' : 
                    selectedData.type === 'HIGH_VALUE' ? 'border-tactical-cyan text-tactical-cyan bg-tactical-cyan/10' : 
                    selectedData.type === 'CARGO' ? 'border-orange-500 text-orange-400 bg-orange-500/10' : 
                    'border-tactical-green text-tactical-green bg-tactical-green/10'
                  }`}>
                  {selectedData.type}
                </span>
              </div>

              <div className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                {activeDomain === 'ORBITAL' ? 'NORAD ID' : activeDomain === 'AIRSPACE' ? 'ICAO24' : 'MMSI'}
              </div>
              <div className="text-right font-mono text-xs">{selectedData.id}</div>

              <div className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Coordinates</div>
              <div className="text-right font-mono text-[10px] text-tactical-cyan leading-tight">{selectedData.latitude}°,<br/>{selectedData.longitude}°</div>

              <div className="text-gray-400 font-bold uppercase text-[9px] tracking-wider mt-1">Velocity</div>
              <div className="text-right font-mono text-xs text-white mt-1">
                {selectedData.velocity} <span className="text-tactical-cyan text-[9px]">
                  {activeDomain === 'MARITIME' ? 'knots' : 'm/s'}
                </span>
              </div>

              <div className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Altitude</div>
              <div className="text-right font-mono text-xs text-white">
                {selectedData.altitude} <span className="text-tactical-cyan text-[9px]">
                  {activeDomain === 'AIRSPACE' ? 'ft' : activeDomain === 'ORBITAL' ? 'km' : ''}
                </span>
              </div>

              {activeDomain === 'ORBITAL' && (
                <>
                  <div className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Period</div>
                  <div className="text-right font-mono text-xs text-white">{selectedData.period} <span className="text-tactical-cyan text-[9px]">min</span></div>
                  <div className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Inclination</div>
                  <div className="text-right font-mono text-xs text-white">{parseFloat(selectedData.inclination).toFixed(2)}<span className="text-tactical-cyan text-[9px]">°</span></div>
                  <div className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Launch Year</div>
                  <div className="text-right font-mono text-xs text-white">{selectedData.launchYear || 'N/A'}</div>
                </>
              )}
              {activeDomain !== 'ORBITAL' && (
                <>
                  <div className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">True Heading</div>
                  <div className="text-right font-mono text-xs text-white">{selectedData.heading}<span className="text-tactical-cyan text-[9px]">°</span></div>
                </>
              )}
            </div>

            <button 
              onClick={() => onAnalyze(selectedData.id)}
              className="mt-2 w-full py-2 bg-tactical-cyan/10 hover:bg-tactical-cyan/20 border border-tactical-cyan text-tactical-cyan font-bold tracking-widest text-[10px] uppercase transition-all duration-300"
            >
              Initiate ANVAY Geopolitical Analysis
            </button>
          </div>
        ) : (
          <div className="bg-tactical-panel border-l-4 border-gray-600 backdrop-blur-md p-4 rounded-r flex items-center gap-3">
             <Info size={16} className="text-gray-400" />
             <span className="text-sm text-gray-400 tracking-wider">Select a target to view telemetry</span>
          </div>
        )}

        {/* GLOBE MODE TOGGLE */}
        <div className="mt-6 bg-tactical-panel/80 border border-tactical-cyan/30 backdrop-blur-md p-3 rounded flex flex-col gap-2">
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest border-b border-tactical-cyan/20 pb-1 flex justify-between">
            <span>Render Engine</span>
            <span>[ {mapProjection} ]</span>
          </div>
          <div className="flex gap-2">
             <button 
                onClick={() => setMapProjection(mapProjection === '3D' ? '2D' : '3D')}
                className={`py-1 px-3 text-[10px] font-bold tracking-widest transition-all border rounded ${
                  mapProjection === '2D' 
                    ? 'bg-tactical-green text-tactical-dark border-tactical-green shadow-[0_0_8px_rgba(0,250,154,0.6)]' 
                    : 'bg-transparent text-gray-400 border-gray-600 hover:text-tactical-green hover:border-tactical-green/50'
                }`}
             >
                {mapProjection === '2D' ? 'FLAT' : 'SPHERE'}
             </button>
             
            {['TACTICAL', 'REALISTIC', 'THERMAL'].map(mode => (
               <button 
                  key={mode}
                  onClick={() => setGlobeMode && setGlobeMode(mode)}
                  className={`flex-1 py-1 text-[8px] font-bold tracking-widest uppercase transition-all border rounded ${
                    globeMode === mode 
                      ? mode === 'THERMAL' ? 'bg-orange-600 text-white border-orange-600 shadow-[0_0_8px_rgba(255,100,0,0.6)]' : 'bg-tactical-cyan text-tactical-dark border-tactical-cyan shadow-[0_0_8px_rgba(0,240,255,0.6)]' 
                      : 'bg-transparent text-gray-400 border-gray-600 hover:text-tactical-cyan hover:border-tactical-cyan/50'
                  }`}
               >
                  {mode}
               </button>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 right-10 pointer-events-auto bg-tactical-panel backdrop-blur-md border border-tactical-cyan/30 p-4 rounded min-w-[250px]">
        <div className="flex justify-between text-xs tracking-wider mb-2">
          <span className="text-tactical-cyan font-bold">T-Scale: {timeScale}x</span>
          <span className="text-gray-400">Time Dial</span>
        </div>
        <input 
          type="range" 
          min="1" 
          max="5000" 
          value={timeScale} 
          onChange={(e) => onTimeScaleChange(parseInt(e.target.value))}
          className="w-full h-1 bg-gray-700 appearance-none rounded outline-none"
        />
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>REALTIME</span>
          <span>PREDICTIVE</span>
        </div>
      </div>
    </div>
  );
}
