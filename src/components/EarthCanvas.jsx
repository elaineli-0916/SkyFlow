import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import { Suspense, forwardRef, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getSubsolarDirection } from "../utils/astro.js";

const EARTH_AXIAL_TILT = THREE.MathUtils.degToRad(23.44);

function EarthCanvas({ snapshot, now, showClouds, showGrid, resetViewSignal, mode, visualCommand, photoMarkers = [], onPhotoPreviewChange }) {
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
          <EarthGroup
            snapshot={snapshot}
            showClouds={showClouds}
            showGrid={showGrid}
            sunDirection={tiltedSunDirection}
            visualCommand={visualCommand}
            photoMarkers={photoMarkers}
            onPhotoPreviewChange={onPhotoPreviewChange}
          />
          <MoonMarker now={now} />
          <CameraControls
            snapshot={snapshot}
            resetViewSignal={resetViewSignal}
            mode={mode}
            visualCommand={visualCommand}
            sunDirection={tiltedSunDirection}
          />
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

function EarthGroup({ snapshot, showClouds, showGrid, sunDirection, visualCommand, photoMarkers, onPhotoPreviewChange }) {
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
      markerRef.current.scale.setScalar((visualCommand?.type === "observe-guide" ? 0.036 : 0.026) + Math.sin(elapsed * 1.2) * 0.003);
      markerRef.current.material.opacity = visualCommand?.type === "observe-guide" ? 0.96 : 0.84;
    }

    if (markerHaloRef.current) {
      markerHaloRef.current.lookAt(camera.position);
      markerHaloRef.current.scale.setScalar((visualCommand?.type === "observe-guide" ? 0.072 : 0.046) + Math.sin(elapsed * 1.45) * 0.01);
      markerHaloRef.current.material.opacity = visualCommand?.type === "observe-guide" ? 0.58 : 0.34;
    }

    if (gridRef.current) {
      gridRef.current.rotation.set(0, 0, 0);
    }
  });

  const markerPosition = useMemo(() => {
    return latLonToVector3(snapshot.latitude, snapshot.longitude, 1.045);
  }, [snapshot.latitude, snapshot.longitude]);

  const isSunlightCommand = visualCommand?.type === "sunlight";

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
      {isSunlightCommand && <TerminatorEmphasis sunDirection={sunDirection} />}
      <mesh position={markerPosition}>
        <sphereGeometry args={[0.01, 16, 16]} />
        <meshBasicMaterial color="#f7ffee" />
      </mesh>
      <PhotoMemoryMarkers markers={photoMarkers} onPhotoPreviewChange={onPhotoPreviewChange} />
    </group>
  );
}

function PhotoMemoryMarkers({ markers, onPhotoPreviewChange }) {
  return (
    <group>
      {markers.map((marker) => (
        <PhotoMemoryMarker key={marker.id} marker={marker} onPhotoPreviewChange={onPhotoPreviewChange} />
      ))}
    </group>
  );
}

function PhotoMemoryMarker({ marker, onPhotoPreviewChange }) {
  const groupRef = useRef();
  const ringRef = useRef();
  const dotRef = useRef();
  const { camera, size } = useThree();
  const [isHovered, setIsHovered] = useState(false);
  const position = useMemo(() => latLonToVector3(marker.latitude, marker.longitude, 1.066), [marker.latitude, marker.longitude]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const scale = (isHovered ? 0.072 : 0.048) + Math.sin(elapsed * 1.7) * 0.006;

    if (ringRef.current) {
      ringRef.current.lookAt(camera.position);
      ringRef.current.scale.setScalar(scale);
    }

    if (dotRef.current) {
      dotRef.current.scale.setScalar(isHovered ? 1.5 : 1);
    }

    if (isHovered && groupRef.current && onPhotoPreviewChange) {
      onPhotoPreviewChange({
        marker,
        style: getPreviewStyle(groupRef.current, camera, size)
      });
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh
        ref={ringRef}
        onPointerOver={(event) => {
          event.stopPropagation();
          setIsHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setIsHovered(false);
          onPhotoPreviewChange?.(null);
          document.body.style.cursor = "";
        }}
      >
        <ringGeometry args={[1, 1.36, 40]} />
        <meshBasicMaterial color="#ffe9a6" transparent opacity={isHovered ? 0.76 : 0.42} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.013, 16, 16]} />
        <meshBasicMaterial color="#fff4c8" />
      </mesh>
      <Html
        center
        distanceFactor={5.4}
        position={[0, 0.075, 0]}
        style={{ pointerEvents: "auto" }}
      >
        <div
          className={`photo-memory-pin${isHovered ? " active" : ""}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            onPhotoPreviewChange?.(null);
          }}
        >
          <span>{marker.label}</span>
        </div>
      </Html>
    </group>
  );
}

function getPreviewStyle(object, camera, size) {
  const world = new THREE.Vector3();
  object.getWorldPosition(world);
  world.project(camera);

  const screenX = (world.x * 0.5 + 0.5) * size.width;
  const screenY = (-world.y * 0.5 + 0.5) * size.height;
  const width = Math.min(280, Math.max(218, size.width * 0.42));
  const height = width * 0.78;
  const margin = 14;
  const prefersLeft = screenX > size.width * 0.54;
  const left = prefersLeft
    ? clamp(screenX - width - 26, margin, size.width - width - margin)
    : clamp(screenX + 26, margin, size.width - width - margin);
  const top = clamp(screenY - height * 0.48, margin + 76, size.height - height - margin);

  return {
    "--preview-x": `${left}px`,
    "--preview-y": `${top}px`,
    "--preview-width": `${width}px`
  };
}

function CameraControls({ snapshot, resetViewSignal, mode, visualCommand, sunDirection }) {
  const controlsRef = useRef();
  const { camera, size } = useThree();
  const [autoRotatePaused, setAutoRotatePaused] = useState(false);
  const targetCameraRef = useRef(null);
  const targetLookAtRef = useRef(new THREE.Vector3(0, 0, 0));
  const resumeAutoRotateTimerRef = useRef(null);
  const handledVisualCommandRef = useRef(null);

  useEffect(() => {
    return () => {
      if (resumeAutoRotateTimerRef.current) {
        window.clearTimeout(resumeAutoRotateTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!controlsRef.current || resetViewSignal === 0) return;
    cancelProgrammaticMove();
    const surfaceDirection = latLonToVector3(snapshot.latitude, snapshot.longitude, 1)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), EARTH_AXIAL_TILT)
      .normalize();
    const cameraPosition = surfaceDirection.multiplyScalar(4.15);
    camera.position.copy(cameraPosition);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, [camera, resetViewSignal, snapshot.latitude, snapshot.longitude]);

  useEffect(() => {
    if (!controlsRef.current || mode !== "observe") return;

    const pose = getLocalObservationPose(snapshot, size.width);
    targetCameraRef.current = pose.cameraPosition;
    targetLookAtRef.current = pose.lookAt;
    pauseAutoRotate();
  }, [mode, size.width, snapshot.latitude, snapshot.longitude]);

  useEffect(() => {
    if (!controlsRef.current || !visualCommand) return;
    if (handledVisualCommandRef.current === visualCommand.createdAt) return;

    handledVisualCommandRef.current = visualCommand.createdAt;

    if (visualCommand.type === "observe-guide") {
      const pose = getLocalObservationPose(snapshot, size.width);
      targetCameraRef.current = pose.cameraPosition;
      targetLookAtRef.current = pose.lookAt;
      pauseAutoRotate();
    }

    if (visualCommand.type === "night-side") {
      targetCameraRef.current = sunDirection.clone().multiplyScalar(-4.25);
      targetLookAtRef.current = new THREE.Vector3(0, 0, 0);
      pauseAutoRotate();
    }

    if (visualCommand.type === "sunlight") {
      const edgeDirection = new THREE.Vector3(-sunDirection.z, 0.18, sunDirection.x).normalize();
      targetCameraRef.current = edgeDirection.multiplyScalar(3.72);
      targetLookAtRef.current = sunDirection.clone().multiplyScalar(0.15);
      pauseAutoRotate();
    }
  }, [snapshot.latitude, snapshot.longitude, size.width, sunDirection, visualCommand]);

  useFrame(() => {
    if (!controlsRef.current || !targetCameraRef.current) return;

    camera.position.lerp(targetCameraRef.current, 0.035);
    controlsRef.current.target.lerp(targetLookAtRef.current, 0.04);
    controlsRef.current.update();

    if (camera.position.distanceTo(targetCameraRef.current) < 0.025) {
      targetCameraRef.current = null;
      scheduleAutoRotateResume(900);
    }
  });

  function pauseAutoRotate() {
    if (resumeAutoRotateTimerRef.current) {
      window.clearTimeout(resumeAutoRotateTimerRef.current);
      resumeAutoRotateTimerRef.current = null;
    }
    setAutoRotatePaused(true);
  }

  function scheduleAutoRotateResume(delay = 2200) {
    if (resumeAutoRotateTimerRef.current) {
      window.clearTimeout(resumeAutoRotateTimerRef.current);
    }
    resumeAutoRotateTimerRef.current = window.setTimeout(() => {
      setAutoRotatePaused(false);
      resumeAutoRotateTimerRef.current = null;
    }, delay);
  }

  function cancelProgrammaticMove() {
    targetCameraRef.current = null;
    if (controlsRef.current) {
      targetLookAtRef.current = controlsRef.current.target.clone();
    }
  }

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
      autoRotate={!autoRotatePaused}
      autoRotateSpeed={0.08}
      onStart={() => {
        cancelProgrammaticMove();
        pauseAutoRotate();
      }}
      onEnd={() => {
        scheduleAutoRotateResume();
      }}
    />
  );
}

function getLocalObservationPose(snapshot, width) {
  const surfaceDirection = latLonToVector3(snapshot.latitude, snapshot.longitude, 1)
    .applyAxisAngle(new THREE.Vector3(0, 0, 1), EARTH_AXIAL_TILT)
    .normalize();
  const distance = width < 760 ? 5.92 : 3.68;
  const cameraPosition = surfaceDirection
    .clone()
    .multiplyScalar(distance)
    .add(new THREE.Vector3(0, width < 760 ? 0.24 : 0.12, 0));
  const lookAt = surfaceDirection.clone().multiplyScalar(0.1);

  return { cameraPosition, lookAt };
}

function TerminatorEmphasis({ sunDirection }) {
  const ringRef = useRef();

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const elapsed = clock.getElapsedTime();
    ringRef.current.material.opacity = 0.16 + Math.sin(elapsed * 1.6) * 0.045;
  });

  const quaternion = useMemo(() => {
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      sunDirection.clone().normalize()
    );
  }, [sunDirection]);

  return (
    <mesh ref={ringRef} quaternion={quaternion}>
      <torusGeometry args={[1.032, 0.0035, 12, 192]} />
      <meshBasicMaterial color="#ffd88a" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
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
  const orbitRadius = 3.35;

  useFrame(({ clock }) => {
    if (!moonRef.current) return;
    const elapsed = clock.getElapsedTime();
    moonRef.current.position.x = Math.cos(phase + elapsed * 0.006) * orbitRadius;
    moonRef.current.position.y = 1.2 + Math.sin(phase * 0.7) * 0.55;
    moonRef.current.position.z = Math.sin(phase + elapsed * 0.006) * orbitRadius;
    moonRef.current.rotation.y += 0.001;
  });

  return (
    <mesh ref={moonRef} position={[orbitRadius, 1.2, -1.7]}>
      <sphereGeometry args={[0.2, 40, 40]} />
      <meshStandardMaterial color="#d8d6cb" roughness={0.88} emissive="#8f8a7f" emissiveIntensity={0.16} />
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
