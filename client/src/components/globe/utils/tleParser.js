import * as satellite from 'satellite.js';

export function parseTLEs(text, typeGuess) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const sats = [];

  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 < lines.length) {
      const name = lines[i];
      const tleLine1 = lines[i + 1];
      const tleLine2 = lines[i + 2];
      
      try {
        const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
        const type = determineType(name, typeGuess);
        if (satrec && satrec.satnum && type !== 'IGNORED') {
          sats.push({
            name,
            satrec,
            id: satrec.satnum,
            tle1: tleLine1,
            tle2: tleLine2,
            type
          });
        }
      } catch (e) {
        // Skip invalid TLE
      }
    }
  }
  return sats;
}

function determineType(name, typeGuess) {
  const upperName = name.toUpperCase();
  
  // Filter out massive commercial tracking, debris, and unregistered assets
  if (
    upperName.includes('STARLINK') || 
    upperName.includes('ONEWEB') || 
    upperName.includes('IRIDIUM') || 
    upperName.includes('GLOBALSTAR') || 
    upperName.includes('DEB') || 
    upperName.includes('UNKNOWN') ||
    upperName.includes('FLOCK') || 
    upperName.includes('LEMUR') || 
    upperName.includes('SWARM')
  ) {
    return 'IGNORED';
  }

  if (upperName.includes('ISS') || upperName.includes('GPS') || upperName.includes('NAVSTAR') || upperName.includes('GALILEO') || upperName.includes('HUBBLE')) {
    return 'HIGH_VALUE';
  }
  
  // Heavily classify known constellations / military signatures
  if (
    upperName.includes('USA') || 
    upperName.includes('COSMOS') || 
    upperName.includes('SKYSAT') || 
    upperName.includes('YAOGAN') ||
    upperName.includes('FENG YUN') ||
    upperName.includes('BEIDOU')
  ) {
    return 'MILITARY';
  }

  // Fallback to the feed type if provided
  if (typeGuess) return typeGuess;
  
  return 'CIVILIAN';
}
