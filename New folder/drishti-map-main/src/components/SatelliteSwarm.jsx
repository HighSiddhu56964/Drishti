import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as satellite from 'satellite.js';

const EARTH_RADIUS_KM = 6371;
const GLOBE_RADIUS = 2;
const SCALE = GLOBE_RADIUS / EARTH_RADIUS_KM;

import { ecfToThree, calculateOrientation, latLonToThree } from '../utils/coordinateMapper';

const COLOR_MAP = {
  HIGH_VALUE: new THREE.Color('#00f0ff'),
  MILITARY: new THREE.Color('#ff2040'),
  CIVILIAN: new THREE.Color('#00fa9a'),
};

export function SatelliteSwarm({ satellites, timeScale, onSelect, selectedSatData, is2D }) {
  const meshRef = useRef();
  const coverageRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [coverageAlpha, setCoverageAlpha] = useState(0);

  const satelliteGeometry = useMemo(() => {
    const body = new THREE.BoxGeometry(0.012, 0.012, 0.025); 
    const panels = new THREE.BoxGeometry(0.06, 0.001, 0.012); 
    
    // Create a realistic satellite by merging a main physical bus and extended solar array panels
    const geom = BufferGeometryUtils.mergeGeometries([body, panels]);
    geom.computeBoundingSphere();
    return geom;
  }, []);

  useEffect(() => {
    if (meshRef.current && satellites.length > 0) {
      satellites.forEach((sat, i) => {
        meshRef.current.setColorAt(i, COLOR_MAP[sat.type] || COLOR_MAP.CIVILIAN);
      });
      meshRef.current.instanceColor.needsUpdate = true;
      
      if (!meshRef.current.geometry.boundingSphere) {
        meshRef.current.geometry.computeBoundingSphere();
      }
      meshRef.current.geometry.boundingSphere.radius = 20; 
    }
  }, [satellites]);

  const selectedOrbitPoints = useMemo(() => {
    if (!selectedSatData) return null;
    const sat = satellites.find(s => s.id === selectedSatData.id);
    if (!sat) return null;

    const points = [];
    const now = new Date();
    const gmstNow = satellite.gstime(now);
    const period = (2 * Math.PI) / sat.satrec.no; 

    try {
      for (let i = 0; i <= 100; i++) { // Higher res path for the single selected orbit
        const t = new Date(now.getTime() + (i / 100) * period * 60000);
        const posEci = satellite.propagate(sat.satrec, t).position;
        if (posEci) {
          const posEcf = satellite.eciToEcf(posEci, gmstNow);
          points.push(ecfToThree(posEcf.x, posEcf.y, posEcf.z, is2D));
        }
      }
    } catch (e) {
      return null;
    }
    return points;
  }, [selectedSatData, satellites]);

  useFrame(({ clock }) => {
    if (!meshRef.current || satellites.length === 0) return;

    const offsetMs = clock.getElapsedTime() * 1000 * timeScale;
    const time = new Date(Date.now() + offsetMs);
    const gmst = satellite.gstime(time);

    satellites.forEach((sat, i) => {
      try {
        const { position } = satellite.propagate(sat.satrec, time);
        if (position) {
          const posEcf = satellite.eciToEcf(position, gmst);
          const posThree = ecfToThree(posEcf.x, posEcf.y, posEcf.z, is2D);
          const matrix = calculateOrientation(posThree, 0, is2D);
          meshRef.current.setMatrixAt(i, matrix);
        }
      } catch (e) {
      }
    });
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Live update the HUD telemetry if a satellite is selected
    if (selectedSatData && window.updateHUDTelemetry) {
      const sat = satellites.find(s => s.id === selectedSatData.id);
      if (sat) {
        const posVel = satellite.propagate(sat.satrec, time);
        if (posVel.position && posVel.velocity) {
          const gmstCur = satellite.gstime(time);
          const posGd = satellite.eciToGeodetic(posVel.position, gmstCur);
          
          if (coverageRef.current) {
             const posEcf = satellite.eciToEcf(posVel.position, gmstCur);
             const pt = ecfToThree(posEcf.x, posEcf.y, posEcf.z, is2D);
             coverageRef.current.position.set(0, 0, 0);
             // lookAt aligns +Z, but SphereGeometry's cap is around +Y. So we rotate X by -90deg inside a group, mapped automatically by wrapping it below
             coverageRef.current.lookAt(pt);
          }

          window.updateHUDTelemetry({
            velocity: Math.sqrt(Math.pow(posVel.velocity.x, 2) + Math.pow(posVel.velocity.y, 2) + Math.pow(posVel.velocity.z, 2)).toFixed(2),
            altitude: posGd.height.toFixed(2),
            inclination: (sat.satrec.inclo * (180 / Math.PI)).toFixed(2),
            latitude: (posGd.latitude * 180 / Math.PI).toFixed(4),
            longitude: (posGd.longitude * 180 / Math.PI).toFixed(4)
          });
        }
      }
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      const sat = satellites[e.instanceId];
      if (!sat) return;
      const now = new Date();
      try {
        const posVel = satellite.propagate(sat.satrec, now);
        if (posVel.position && posVel.velocity) {
           const gmst = satellite.gstime(now);
           const posGd = satellite.eciToGeodetic(posVel.position, gmst);
           
           let alpha = 0;
           const ratio = EARTH_RADIUS_KM / (EARTH_RADIUS_KM + posGd.height);
           if (!isNaN(ratio) && ratio <= 1 && ratio > 0) {
             alpha = Math.acos(ratio);
           }
           setCoverageAlpha(alpha || 0);

           onSelect({
             id: sat.id,
             name: sat.name,
             type: sat.type,
             velocity: Math.sqrt(Math.pow(posVel.velocity.x, 2) + Math.pow(posVel.velocity.y, 2) + Math.pow(posVel.velocity.z, 2)).toFixed(2),
             altitude: posGd.height.toFixed(2),
             inclination: (sat.satrec.inclo * (180 / Math.PI)).toFixed(2),
             latitude: (posGd.latitude * 180 / Math.PI).toFixed(4),
             longitude: (posGd.longitude * 180 / Math.PI).toFixed(4),
             period: ((2 * Math.PI) / sat.satrec.no).toFixed(2),
             launchYear: sat.satrec.epochyr < 50 ? 2000 + sat.satrec.epochyr : 1900 + sat.satrec.epochyr
           });
        }
      } catch (err) {
        console.error("Orbit click calculation error", err);
      }
    } else {
       // Clicking empty space deselects
       onSelect(null);
       setCoverageAlpha(0);
    }
  };

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[null, null, 10000]}
        count={satellites.length}
        onClick={handleClick}
        onPointerMissed={() => { onSelect(null); setCoverageAlpha(0); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { document.body.style.cursor = 'auto'; }}
        frustumCulled={false}
      >
        <primitive object={satelliteGeometry} attach="geometry" />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Coverage Envelope Overlay */}
      {selectedSatData && coverageAlpha > 0 && !is2D && (
        <group ref={coverageRef}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={null} onClick={undefined} onPointerDown={undefined}>
            <sphereGeometry args={[GLOBE_RADIUS + 0.005, 64, 16, 0, Math.PI * 2, 0, coverageAlpha]} />
            <meshBasicMaterial color={COLOR_MAP[selectedSatData.type] || COLOR_MAP.CIVILIAN} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={null} onClick={undefined} onPointerDown={undefined}>
            <sphereGeometry args={[GLOBE_RADIUS + 0.005, 64, 16, 0, Math.PI * 2, coverageAlpha, 0.005]} />
            <meshBasicMaterial color={COLOR_MAP[selectedSatData.type] || COLOR_MAP.CIVILIAN} transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* Render selected satellite precise orbit trajectory */}
      {selectedSatData && selectedOrbitPoints && (
         <line key={selectedSatData.id} raycast={null} onClick={undefined} onPointerDown={undefined}>
           <bufferGeometry>
             <bufferAttribute 
                attach="attributes-position"
                count={selectedOrbitPoints.length}
                array={new Float32Array(selectedOrbitPoints.flatMap(p => [p.x, p.y, p.z]))}
                itemSize={3}
             />
           </bufferGeometry>
           <lineBasicMaterial color={COLOR_MAP[selectedSatData.type] || COLOR_MAP.CIVILIAN} linewidth={2} transparent opacity={0.8} depthWrite={false} />
         </line>
      )}
    </group>
  );
}
