import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Suspense, forwardRef, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getSubsolarDirection } from "../utils/astro.js";

const EARTH_AXIAL_TILT = THREE.MathUtils.degToRad(23.44);

function EarthCanvas({ snapshot, now, showClouds, showGrid, resetViewSignal }) {
  const sunDirection = useMemo(() => getSubsolarDirection(now), [now]);
  const tiltedSunDirection = useMemo(
    () => sunDirection.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -EARTH_AXIAL_TILT).normalize(),
    [sunDirection]
  );

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.25, 4.15], fov: 42, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#02040a"]} />
        <fog attach="fog" args={["#02040a", 8, 18]} />
        <Suspense fallback={null}>
          <OrbitalLighting sunDirection={sunDirection} />
          <Stars radius={70} depth={42} count={3200} factor={3.4} saturation={0.35} fade speed={0.18} />
          <EarthGroup snapshot={snapshot} showClouds={showClouds} showGrid={showGrid} sunDirection={tiltedSunDirection} />
          <MoonMarker now={now} />
          <CameraControls snapshot={snapshot} resetViewSignal={resetViewSignal} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function OrbitalLighting({ sunDirection }) {
  return (
    <>
      <ambientLight intensity={0.36} color="#b2d0ff" />
      <directionalLight position={[sunDirection.x * 8, sunDirection.y * 8, sunDirection.z * 8]} intensity={4.8} color="#fff0cf" />
      <pointLight position={[-4.4, 2.2, 3]} intensity={0.86} color="#8fc4ff" />
    </>
  );
}

function EarthGroup({ snapshot, showClouds, showGrid, sunDirection }) {
  const groupRef = useRef();
  const earthRef = useRef();
  const cloudRef = useRef();
  const glowRef = useRef();
  const atmosphereRef = useRef();
  const markerRef = useRef();
  const markerHaloRef = useRef();
  const gridRef = useRef();
  const { camera } = useThree();
  const [dayTexture, nightTexture, cloudTexture] = useLoader(THREE.TextureLoader, [
    "/textures/earth-day.jpg",
    "/textures/earth-night.png",
    "/textures/earth-clouds.png"
  ]);

  const textures = useMemo(() => {
    for (const texture of [dayTexture, nightTexture, cloudTexture]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
    }

    return { earth: dayTexture, night: nightTexture, clouds: cloudTexture };
  }, [dayTexture, nightTexture, cloudTexture]);

  const earthMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          dayMap: { value: textures.earth },
          nightMap: { value: textures.night },
          sunDirection: { value: new THREE.Vector3(sunDirection.x, sunDirection.y, sunDirection.z) },
          oceanPulse: { value: 0 }
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormalW;
          varying vec3 vPositionW;

          void main() {
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vPositionW = worldPosition.xyz;
            vNormalW = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform sampler2D dayMap;
          uniform sampler2D nightMap;
          uniform vec3 sunDirection;
          uniform float oceanPulse;
          varying vec2 vUv;
          varying vec3 vNormalW;
          varying vec3 vPositionW;

          void main() {
            vec3 normal = normalize(vNormalW);
            float light = dot(normal, normalize(sunDirection));
            float day = smoothstep(-0.08, 0.26, light);
            float rim = pow(1.0 - max(dot(normal, normalize(cameraPosition - vPositionW)), 0.0), 2.5);
            float terminatorGlow = 1.0 - smoothstep(0.02, 0.22, abs(light));
            float terminatorLine = 1.0 - smoothstep(0.0, 0.035, abs(light));
            vec3 dayColor = texture2D(dayMap, vUv).rgb;
            vec3 nightColor = texture2D(nightMap, vUv).rgb;
            vec3 color = mix(nightColor * 1.18, dayColor * 1.82, day);
            color = pow(max(color, vec3(0.0)), vec3(0.74));
            color += vec3(0.16, 0.38, 0.64) * rim * 0.2;
            color += vec3(0.88, 0.58, 0.24) * terminatorGlow * 0.16;
            color += mix(vec3(0.35, 0.72, 1.0), vec3(1.0, 0.82, 0.42), day) * terminatorLine * 0.42;
            color += vec3(0.03, 0.09, 0.14) * oceanPulse * 0.08;
            gl_FragColor = vec4(color, 1.0);
          }
        `
      }),
    [textures.earth, textures.night]
  );

  const cloudsMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        alphaMap: textures.clouds,
        color: "#f2fbff",
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        roughness: 0.72,
        metalness: 0,
        emissive: new THREE.Color("#b9d7ff"),
        emissiveIntensity: 0.04
      }),
    [textures.clouds]
  );

  const glowMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
          pulse: { value: 0 }
        },
        vertexShader: `
          varying vec3 vNormalW;
          varying vec3 vPositionW;

          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vPositionW = worldPosition.xyz;
            vNormalW = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform float pulse;
          varying vec3 vNormalW;
          varying vec3 vPositionW;

          void main() {
            vec3 viewDirection = normalize(cameraPosition - vPositionW);
            float edge = pow(1.0 - abs(dot(normalize(vNormalW), viewDirection)), 2.2);
            vec3 glow = vec3(0.22, 0.58, 1.0) * edge * (0.72 + pulse * 0.16);
            gl_FragColor = vec4(glow, edge * 0.58);
          }
        `
      }),
    []
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    groupRef.current.rotation.set(0, 0, 0);
    earthRef.current.material.uniforms.sunDirection.value.set(sunDirection.x, sunDirection.y, sunDirection.z);
    earthRef.current.material.uniforms.oceanPulse.value = 0.5 + Math.sin(elapsed * 0.34) * 0.5;
    if (cloudRef.current) {
      cloudRef.current.rotation.y = elapsed * 0.012;
      cloudRef.current.rotation.z = Math.sin(elapsed * 0.06) * 0.015;
    }
    glowRef.current.material.uniforms.pulse.value = 0.5 + Math.sin(elapsed * 0.52) * 0.5;
    atmosphereRef.current.rotation.z = elapsed * 0.009;

    if (markerRef.current) {
      markerRef.current.lookAt(camera.position);
      markerRef.current.scale.setScalar(0.026 + Math.sin(elapsed * 1.2) * 0.003);
    }

    if (markerHaloRef.current) {
      markerHaloRef.current.lookAt(camera.position);
      markerHaloRef.current.scale.setScalar(0.046 + Math.sin(elapsed * 1.45) * 0.01);
    }

    if (gridRef.current) {
      gridRef.current.rotation.set(0, 0, 0);
    }
  });

  const markerPosition = useMemo(() => {
    return latLonToVector3(snapshot.latitude, snapshot.longitude, 1.045);
  }, [snapshot.latitude, snapshot.longitude]);

  return (
    <group ref={groupRef} rotation={[0, 0, EARTH_AXIAL_TILT]}>
      <mesh ref={earthRef} material={earthMaterial}>
        <sphereGeometry args={[1, 128, 128]} />
      </mesh>
      {showClouds && (
        <mesh ref={cloudRef} material={cloudsMaterial}>
          <sphereGeometry args={[1.014, 128, 128]} />
        </mesh>
      )}
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[1.022, 128, 128]} />
        <meshBasicMaterial color="#7ecbff" transparent opacity={0.065} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {showGrid && <GeoReferenceLines ref={gridRef} />}
      <AxisLine />
      <mesh ref={glowRef} material={glowMaterial}>
        <sphereGeometry args={[1.13, 96, 96]} />
      </mesh>
      <mesh ref={markerHaloRef} position={markerPosition}>
        <ringGeometry args={[1, 1.42, 64]} />
        <meshBasicMaterial color="#84ffd8" transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={markerRef} position={markerPosition}>
        <ringGeometry args={[1, 1.65, 48]} />
        <meshBasicMaterial color="#a8ffe6" transparent opacity={0.84} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={markerPosition}>
        <sphereGeometry args={[0.01, 16, 16]} />
        <meshBasicMaterial color="#f7ffee" />
      </mesh>
    </group>
  );
}

function CameraControls({ snapshot, resetViewSignal }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  useEffect(() => {
    if (!controlsRef.current || resetViewSignal === 0) return;
    const surfaceDirection = latLonToVector3(snapshot.latitude, snapshot.longitude, 1)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), EARTH_AXIAL_TILT)
      .normalize();
    const cameraPosition = surfaceDirection.multiplyScalar(4.15);
    camera.position.copy(cameraPosition);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, [camera, resetViewSignal, snapshot.latitude, snapshot.longitude]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableDamping
      dampingFactor={0.055}
      rotateSpeed={0.38}
      zoomSpeed={0.45}
      minDistance={2.35}
      maxDistance={6.4}
      autoRotate={!isUserInteracting}
      autoRotateSpeed={0.12}
      onStart={() => {
        setIsUserInteracting(true);
      }}
      onEnd={() => {
        setIsUserInteracting(false);
      }}
    />
  );
}

const GeoReferenceLines = forwardRef(function GeoReferenceLines(_, ref) {
  const geometry = useMemo(() => {
    const points = [];
    const radius = 1.026;

    for (let lon = -150; lon <= 180; lon += 30) {
      addLongitude(points, lon, radius);
    }

    addLatitude(points, 0, radius);
    addLatitude(points, 23.44, radius);
    addLatitude(points, -23.44, radius);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    return lineGeometry;
  }, []);

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#c8f5ff" transparent opacity={0.13} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
});

function AxisLine() {
  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.62, 0),
      new THREE.Vector3(0, 1.62, 0)
    ]);
  }, []);

  const coreGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.42, 0),
      new THREE.Vector3(0, 1.42, 0)
    ]);
  }, []);

  return (
    <group>
      <line geometry={geometry}>
        <lineBasicMaterial color="#c8f5ff" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
      <line geometry={coreGeometry}>
        <lineBasicMaterial color="#ecfeff" transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
    </group>
  );
}

function MoonMarker({ now }) {
  const moonRef = useRef();
  const phase = ((now.getDate() % 29.53) / 29.53) * Math.PI * 2;

  useFrame(({ clock }) => {
    if (!moonRef.current) return;
    const elapsed = clock.getElapsedTime();
    moonRef.current.position.x = Math.cos(phase + elapsed * 0.006) * 4.8;
    moonRef.current.position.y = 1.2 + Math.sin(phase * 0.7) * 0.55;
    moonRef.current.position.z = Math.sin(phase + elapsed * 0.006) * 4.8;
    moonRef.current.rotation.y += 0.001;
  });

  return (
    <mesh ref={moonRef} position={[4.2, 1.2, -2.4]}>
      <sphereGeometry args={[0.075, 32, 32]} />
      <meshStandardMaterial color="#d8d6cb" roughness={0.88} emissive="#726f67" emissiveIntensity={0.08} />
    </mesh>
  );
}

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function addLatitude(points, lat, radius) {
  for (let lon = -180; lon < 180; lon += 4) {
    points.push(latLonToVector3(lat, lon, radius));
    points.push(latLonToVector3(lat, lon + 4, radius));
  }
}

function addLongitude(points, lon, radius) {
  for (let lat = -80; lat < 80; lat += 4) {
    points.push(latLonToVector3(lat, lon, radius));
    points.push(latLonToVector3(lat + 4, lon, radius));
  }
}

export default EarthCanvas;
