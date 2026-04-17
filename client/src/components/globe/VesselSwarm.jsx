import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { latLonToThree, calculateOrientation } from './utils/coordinateMapper';

const GLOBE_RADIUS = 2; // Exact sea level radius
const COLOR_MAP = {
  HIGH_VALUE: new THREE.Color('#00f0ff'),
  MILITARY: new THREE.Color('#ff2040'),
  CIVILIAN: new THREE.Color('#00fa9a'),
  CARGO: new THREE.Color('#ffae42'),
  PASSENGER: new THREE.Color('#00f0ff'),
  UNKNOWN: new THREE.Color('#888888')
};

export function VesselSwarm({ vessels, onSelect, selectedVesselData, is2D }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const shipGeometry = useMemo(() => {
    // Basic naval hull shape
    const hull = new THREE.BoxGeometry(0.008, 0.004, 0.04);
    const bridge = new THREE.BoxGeometry(0.006, 0.004, 0.01);
    bridge.translate(0, 0.004, 0.005); // Move bridge slightly back and up
    
    // Merge hull and bridge
    const geom = BufferGeometryUtils.mergeGeometries([hull, bridge]);
    geom.computeBoundingSphere();
    return geom;
  }, []);

  useEffect(() => {
    if (meshRef.current && vessels.length > 0) {
      vessels.forEach((vessel, i) => {
        meshRef.current.setColorAt(i, COLOR_MAP[vessel.type] || COLOR_MAP.UNKNOWN);
      });
      meshRef.current.instanceColor.needsUpdate = true;
      
      if (!meshRef.current.geometry.boundingSphere) {
        meshRef.current.geometry.computeBoundingSphere();
      }
      meshRef.current.geometry.boundingSphere.radius = 20; 
    }
  }, [vessels]);

  useFrame(() => {
    if (!meshRef.current || vessels.length === 0) return;

    vessels.forEach((vessel, i) => {
      const posThree = latLonToThree(vessel.latitude, vessel.longitude, 0, is2D);
      const matrix = calculateOrientation(posThree, vessel.heading, is2D);
      meshRef.current.setMatrixAt(i, matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;

    if (selectedVesselData && window.updateHUDTelemetry) {
      const vessel = vessels.find(v => v.id === selectedVesselData.id);
      if (vessel) {
        window.updateHUDTelemetry({
          velocity: vessel.velocity?.toFixed(2) || "0", // Currently in m/s, HUD will format
          altitude: "SEA DRAFT",
          heading: vessel.heading ? vessel.heading.toFixed(1) : "0",
          latitude: vessel.latitude?.toFixed(4),
          longitude: vessel.longitude?.toFixed(4)
        });
      }
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      const vessel = vessels[e.instanceId];
      if (!vessel) return;
      onSelect({
        id: vessel.id,
        name: vessel.name,
        type: vessel.type,
        velocity: vessel.velocity?.toFixed(2) || "0",
        altitude: "SEA LEVEL",
        heading: vessel.heading ? vessel.heading.toFixed(1) : "0",
        latitude: vessel.latitude?.toFixed(4),
        longitude: vessel.longitude?.toFixed(4)
      });
    } else {
       onSelect(null);
    }
  };

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[null, null, 2000]} // Support up to 2k ships
        count={vessels.length}
        onClick={handleClick}
        onPointerMissed={() => onSelect(null)}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        frustumCulled={false}
      >
        <primitive object={shipGeometry} attach="geometry" />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
