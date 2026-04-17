import * as THREE from 'three';

// Shared globe constant across swarms
export const GLOBE_RADIUS = 2;

/**
 * Projects Lat/Lon to exactly match Cartesian Plane Geometry or Spherical Geometry.
 * In 2D, maps to Plane(GLOBE_RADIUS * 2 * PI, GLOBE_RADIUS * PI).
 */
export function latLonToThree(lat, lon, altitude = 0, is2D = false) {
  const finalRadius = GLOBE_RADIUS + altitude;

  if (is2D) {
    // Equirectangular flat map projection (PlaneGeometry)
    // Longitude (-180 to 180) maps to X axis (-PI*R to +PI*R)
    // Latitude (-90 to 90) maps to Y axis (-PI/2*R to +PI/2*R)
    const x = (lon / 180) * (Math.PI * finalRadius);
    const y = (lat / 90) * ((Math.PI / 2) * finalRadius);
    // Keep Z identical to altitude so planes hover above the flat map!
    return new THREE.Vector3(x, y, 0.01 + altitude); 
  } else {
    // Standard Spherical projection
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    return new THREE.Vector3(
      -(finalRadius * Math.sin(phi) * Math.cos(theta)),
      finalRadius * Math.cos(phi),
      finalRadius * Math.sin(phi) * Math.sin(theta)
    );
  }
}

/**
 * For Space Satellites using Earth-Centered, Earth-Fixed (ECEF) coordinates
 */
export function ecfToThree(x, y, z, is2D = false) {
  const scale = GLOBE_RADIUS / 6371;
  
  if (!is2D) {
    // Highly efficient native Cartesian 90-degree spatial twist mapping ECEF(Z=UP) to WebGL(Y=UP).
    return new THREE.Vector3(x * scale, z * scale, -y * scale);
  }

  // If in 2D mode, we must brutally extract lat/lon to project onto the flat plane
  const r = Math.sqrt(x*x + y*y + z*z);
  // Clamp z/r to [-1, 1] to prevent massive NaN geometry crashes at poles due to JS float precision
  const lat = Math.asin(Math.max(-1, Math.min(1, z / r))) * (180 / Math.PI);
  const lon = Math.atan2(y, x) * (180 / Math.PI);
  
  const altitudeScale = (r * scale) - GLOBE_RADIUS;
  return latLonToThree(lat, lon, altitudeScale, true);
}

/**
 * Utility to calculate orientation given a specific True Heading from North
 * In 2D, vehicles rotate freely on the Z-axis (XY flat plane).
 * In 3D, vehicles ride on the tangent of the sphere looking towards heading.
 */
export function calculateOrientation(pos, headingDeg, is2D) {
  const dummyObj = new THREE.Object3D();
  
  if (is2D) {
    // Flat 2D plane: Up is Y, North is Y.
    dummyObj.position.copy(pos);
    dummyObj.rotation.set(0, 0, -headingDeg * (Math.PI / 180));
    dummyObj.updateMatrix();
    return dummyObj.matrix;
  } else {
    dummyObj.position.copy(pos);
    // Orient "up" to point exactly away from the core
    dummyObj.lookAt(0, 0, 0); 
    dummyObj.rotateX(-Math.PI / 2);
    // Apply true heading azimuth correctly on tangent plane
    dummyObj.rotateY(-headingDeg * (Math.PI / 180));
    dummyObj.updateMatrix();
    return dummyObj.matrix;
  }
}
