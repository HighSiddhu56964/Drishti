import { useRef } from 'react';
import { Sphere, Plane, useTexture, OrbitControls, Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const GLOBE_RADIUS = 2;
// In 2D, we project the equirectangular map onto a plane
// x bounds: [-PI*R, PI*R]; y bounds: [-PI/2*R, PI/2*R]
const PLANE_WIDTH = GLOBE_RADIUS * 2 * Math.PI;
const PLANE_HEIGHT = GLOBE_RADIUS * Math.PI;

export function GlobeRenderer({ mode = 'TACTICAL', is2D = false }) {
  const earthRef = useRef();
  const sunRef = useRef(new THREE.Vector3(1, 0, 0));
  
  const [dayMap, nightMap, bumpMap, specularMap] = useTexture([
    'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    'https://unpkg.com/three-globe/example/img/earth-night.jpg',
    'https://unpkg.com/three-globe/example/img/earth-topology.png',
    'https://unpkg.com/three-globe/example/img/earth-water.png'
  ]);
  
  useFrame(({ clock }) => {
    // Slowly rotate the sun around the earth/plane to simulate time of day scanning
    const elapsedTime = clock.getElapsedTime();
    sunRef.current.set(Math.cos(elapsedTime * 0.1), 0, Math.sin(elapsedTime * 0.1));
  });

  const geometryArgs = is2D ? [PLANE_WIDTH, PLANE_HEIGHT, 128, 128] : [GLOBE_RADIUS, 128, 128];
  
  // Tactical Mode rendering
  const renderTactical = () => (
    <group>
      <ambientLight intensity={1.5} />
      {is2D ? (
        <Plane ref={earthRef} args={geometryArgs}>
           <meshPhongMaterial map={nightMap} bumpMap={bumpMap} bumpScale={0.015} specularMap={specularMap} specular={new THREE.Color('grey')} shininess={15} />
        </Plane>
      ) : (
        <Sphere ref={earthRef} args={geometryArgs} rotation={[0, -Math.PI / 2, 0]} onPointerDown={(e) => e.stopPropagation()}>
           <meshPhongMaterial map={nightMap} bumpMap={bumpMap} bumpScale={0.015} specularMap={specularMap} specular={new THREE.Color('grey')} shininess={15} />
        </Sphere>
      )}
      
      {!is2D && (
         <Sphere args={[GLOBE_RADIUS * 1.02, 64, 64]} raycast={() => null}>
           <meshBasicMaterial color="#0066ff" transparent={true} opacity={0.1} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
         </Sphere>
      )}
    </group>
  );

  // Realistic and Thermal Mode Rendering Pipeline
  const renderAdvanced = () => {
    // Common Shader uniforms
    const uniforms = {
      dayTex: { value: dayMap },
      nightTex: { value: nightMap },
      bumpTex: { value: bumpMap },
      sunDir: { value: sunRef.current },
      isThermal: { value: mode === 'THERMAL' }
    };

    const vertShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragShader = `
      uniform sampler2D dayTex;
      uniform sampler2D nightTex;
      uniform sampler2D bumpTex;
      uniform vec3 sunDir;
      uniform bool isThermal;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      
      // Pseudo color map for FLIR Thermal imagery
      vec3 getThermalColor(float t) {
          vec3 c1 = vec3(0.0, 0.0, 0.2); // Cold Ocean Deep
          vec3 c2 = vec3(0.3, 0.0, 0.4); // Cold Ground
          vec3 c3 = vec3(0.8, 0.1, 0.2); // Warm Ground
          vec3 c4 = vec3(0.9, 0.6, 0.0); // Hot Topo
          vec3 c5 = vec3(1.0, 1.0, 1.0); // Highest Point
          if (t < 0.25) return mix(c1, c2, t / 0.25);
          if (t < 0.5)  return mix(c2, c3, (t - 0.25) / 0.25);
          if (t < 0.75) return mix(c3, c4, (t - 0.5) / 0.25);
          return mix(c4, c5, (t - 0.75) / 0.25);
      }

      void main() {
        vec3 dayColor = texture2D(dayTex, vUv).rgb;
        vec3 nightColor = texture2D(nightTex, vUv).rgb;
        vec3 topo = texture2D(bumpTex, vUv).rgb;
        
        float intensity = dot(normalize(vNormal), normalize(sunDir));
        float mixVal = smoothstep(-0.2, 0.2, intensity);
        
        if (isThermal) {
           // Thermal ignores sunlight, derives energy primarily from elevation/nightlights
           float heat = topo.r * 0.8 + (nightColor.r + nightColor.g + nightColor.b) * 0.5;
           // Add scanning modulation
           float scan = intensity > 0.95 ? 0.3 : 0.0;
           gl_FragColor = vec4(getThermalColor(clamp(heat + scan, 0.0, 1.0)), 1.0);
        } else {
           vec3 finalColor = mix(nightColor, dayColor, mixVal);
           gl_FragColor = vec4(finalColor, 1.0);
        }
      }
    `;

    return (
      <group>
        {is2D ? (
           <Plane ref={earthRef} args={geometryArgs} onPointerDown={(e) => e.stopPropagation()}>
               <shaderMaterial uniforms={uniforms} vertexShader={vertShader} fragmentShader={fragShader} />
           </Plane>
        ) : (
           <Sphere ref={earthRef} args={geometryArgs} rotation={[0, -Math.PI / 2, 0]} onPointerDown={(e) => e.stopPropagation()}>
               <shaderMaterial uniforms={uniforms} vertexShader={vertShader} fragmentShader={fragShader} />
           </Sphere>
        )}
      </group>
    );
  };

  return (
    <group>
      {/* 2D Mode restricts OrbitControls so we don't accidentally flip the flat earth layout over */}
      <OrbitControls 
        enablePan={is2D} 
        minDistance={is2D ? 0.5 : 2.1} 
        maxDistance={10} 
        autoRotate={false} 
        zoomSpeed={0.8}
        maxPolarAngle={is2D ? Math.PI : Math.PI}
      />
      
      {/* Background Starfield */}
      {!is2D && mode === 'REALISTIC' && <Stars radius={100} depth={50} count={8000} factor={4} saturation={1} fade speed={1} />}
      {!is2D && mode !== 'REALISTIC' && <Stars radius={100} depth={50} count={3000} factor={2} saturation={0} fade speed={0.5} />}
      
      {mode === 'TACTICAL' ? renderTactical() : renderAdvanced()}
    </group>
  );
}
