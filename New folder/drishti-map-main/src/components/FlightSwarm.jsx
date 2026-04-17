import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const EARTH_RADIUS_KM = 6371;
const GLOBE_RADIUS = 2;
const SCALE = GLOBE_RADIUS / EARTH_RADIUS_KM;

import { latLonToThree, calculateOrientation } from '../utils/coordinateMapper';

const COLOR_MAP = {
  HIGH_VALUE: new THREE.Color('#00f0ff'),
  MILITARY: new THREE.Color('#ff2040'),
  CIVILIAN: new THREE.Color('#00fa9a'),
};

export function FlightSwarm({ flights, onSelect, selectedFlightData, is2D }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const jetGeometry = useMemo(() => {
    // Basic delta wing shape
    const fuselage = new THREE.CylinderGeometry(0.003, 0.003, 0.03, 4);
    fuselage.rotateX(Math.PI / 2);
    
    const wing = new THREE.BoxGeometry(0.02, 0.001, 0.015);
    wing.translate(0, 0, 0.005);
    
    const tail = new THREE.BoxGeometry(0.002, 0.008, 0.005);
    tail.translate(0, 0.004, 0.012);

    const geom = BufferGeometryUtils.mergeGeometries([fuselage, wing, tail]);
    geom.computeBoundingSphere();
    return geom;
  }, []);

  useEffect(() => {
    if (meshRef.current && flights.length > 0) {
      flights.forEach((flight, i) => {
        meshRef.current.setColorAt(i, COLOR_MAP[flight.type] || COLOR_MAP.CIVILIAN);
      });
      meshRef.current.instanceColor.needsUpdate = true;
      
      if (!meshRef.current.geometry.boundingSphere) {
        meshRef.current.geometry.computeBoundingSphere();
      }
      meshRef.current.geometry.boundingSphere.radius = 20; 
    }
  }, [flights]);

  useFrame(() => {
    if (!meshRef.current || flights.length === 0) return;

    flights.forEach((flight, i) => {
      // Pass the scale reduction of altitude so it displays visually
      const altScale = Math.max(0, flight.altitude / 1000) * SCALE;
      const posThree = latLonToThree(flight.latitude, flight.longitude, altScale, is2D);
      const matrix = calculateOrientation(posThree, flight.heading, is2D);
      meshRef.current.setMatrixAt(i, matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;

    if (selectedFlightData && window.updateHUDTelemetry) {
      const flight = flights.find(f => f.id === selectedFlightData.id);
      if (flight) {
        window.updateHUDTelemetry({
          velocity: flight.velocity?.toFixed(2) || "0",
          altitude: (flight.altitude * 3.28084).toFixed(0), // ft
          heading: flight.heading?.toFixed(1) || "0",
          latitude: flight.latitude?.toFixed(4),
          longitude: flight.longitude?.toFixed(4)
        });
      }
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      const flight = flights[e.instanceId];
      if (!flight) return;
      onSelect({
        id: flight.id,
        name: flight.name,
        type: flight.type,
        velocity: flight.velocity?.toFixed(2) || "0",
        altitude: (flight.altitude * 3.28084).toFixed(0),
        heading: flight.heading?.toFixed(1) || "0",
        latitude: flight.latitude?.toFixed(4),
        longitude: flight.longitude?.toFixed(4)
      });
    } else {
       onSelect(null);
    }
  };

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[null, null, 5000]} // 5k planes max
        count={flights.length}
        onClick={handleClick}
        onPointerMissed={() => onSelect(null)}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        frustumCulled={false}
      >
        <primitive object={jetGeometry} attach="geometry" />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
