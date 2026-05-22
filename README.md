# SkyFlow Earth Companion

AI Native immersive real-time Earth companion interface.

中文版本: [README.zh-CN.md](./README.zh-CN.md)

## Product Direction

SkyFlow is not a traditional weather app or chatbot. It is an ambient Earth interface: a quiet orbital window that helps users feel connected to the real world, nature, light, weather, and time.

The MVP should make the Earth feel alive within 10 seconds:

- cinematic 3D Earth
- slow rotation and smooth camera inertia
- day/night lighting
- atmosphere glow
- cloud motion
- user-local environmental context
- low-frequency ambient narration

## Current State

Implemented:

- React + Vite + TailwindCSS
- React Three Fiber / Three.js globe scene
- real local Earth day, night, and cloud texture assets from `public/textures`
- procedural texture generator kept as a future fallback/reference path
- animated clouds
- cloud layer visibility toggle
- atmospheric glow
- presentation lighting with a visible day/night terminator
- physically driven terminator based on current UTC time and approximate solar declination
- star field
- drag / zoom / rotate controls
- browser geolocation fallback
- Open-Meteo weather fetch
- sunrise / sunset fetch fallback path
- ambient companion narration
- visible location coordinate strip
- local fallback model when browser/API data is unavailable
- unified `EarthTelemetry` data snapshot layer
- visible telemetry source labels
- local approximate sun and moon azimuth/altitude calculations

## Known Issues

### Earth Geography Texture Quality

Previous geography rendering used procedural landmass blocks, which made the globe look like large abstract continents without enough coastline or terrain detail.

Current fix:

- The globe now loads real local texture assets:
  - `public/textures/earth-day.jpg`
  - `public/textures/earth-night.png`
  - `public/textures/earth-clouds.png`
- The cloud layer uses the cloud texture as an alpha map so the real surface remains visible.

Remaining improvement areas:

- add separate roughness/bump/specular layers
- tune texture color grading under day/night shader lighting
- verify the asset license/provenance before production release
- consider higher-resolution day/night assets if close zoom becomes important
- eventually use NASA GIBS tiles for real cloud/surface data where appropriate

## Data Plan

### User Location

Use the browser native Geolocation API:

```js
navigator.geolocation.getCurrentPosition()
```

Required fields:

- `latitude`
- `longitude`

These coordinates drive local weather, light, moon, and narration.

### Real-Time Weather / Cloud Cover

Use Open-Meteo first because it is free, keyless, and suitable for demos.

Initial fields:

- `temperature_2m`
- `cloud_cover`
- `weather_code`
- `wind_speed_10m`

### Sun / Moon / Astronomy

Use Open-Meteo for stable sunrise/sunset data through the forecast endpoint.

Current implementation:

- `daily=sunrise,sunset` from Open-Meteo
- local approximate `sun_azimuth`
- local approximate `sun_altitude`
- local approximate `moon_azimuth`
- local approximate `moon_altitude`
- local moon phase calculation

Target fields for a later dedicated astronomy provider:

- `sunrise`
- `sunset`
- `moonrise`
- `moonset`
- `sun_azimuth`
- `moon_azimuth`
- `moon_altitude`

Backup option:

- ipgeolocation Astronomy API, if a key is acceptable later.

Important note:

Open-Meteo is the preferred MVP source for weather and sunrise/sunset because it is keyless and demo-friendly. Do not assume moonrise/moonset or sun/moon azimuth fields are available in the standard forecast endpoint unless verified before implementation.

### Real Cloud Imagery

Future phase: NASA GIBS.

NASA GIBS can provide near-real-time satellite imagery through WMTS/WMS/TMS/XYZ tiles. Many layers are available roughly 3-5 hours after observation.

Do not make NASA GIBS a hard dependency for the MVP. First use a semi-transparent animated cloud layer, then upgrade to real satellite cloud tiles when the base Earth experience is strong.

## Progress Log

### 2026-05-23

- Read through the app code and found that real Earth textures already existed in `public/textures`, but the globe was still using procedural canvas textures.
- Switched the Three.js globe to load local real day, night, and cloud textures through `TextureLoader`.
- Changed the cloud layer to use `earth-clouds.png` as an alpha map, keeping the real geography visible below it.
- Updated README progress rules and added this Chinese counterpart document requirement.
- Brightened the globe shader and scene lighting so continents and oceans remain readable.
- Added a small UI control to toggle the cloud layer on/off.
- Lowered default cloud opacity to reduce surface obstruction.
- Changed the render lighting to a presentation sun direction so the globe visibly shows one day side, one night side, and a stronger day/night terminator.
- Rechecked the app in the in-app browser and increased exposure again because the first pass still read too dark.
- Reduced cloud opacity again after visual review so the cloud layer does not dominate the surface texture when enabled.
- Reworked the terminator model from a fixed presentation light to a real-time subsolar point calculation.
- Stopped auto-rotating the Earth mesh so the day/night boundary moves at real Earth time instead of animation speed.
- Kept camera interaction for user-controlled observation while preserving the globe's physical coordinate frame.
- Added a right-side local time block showing approximate local time, location, UTC offset, solar altitude, and solar azimuth.
- Moved the local time/location block into the always-visible upper-right control stack so it appears even on narrower viewports.
- Removed the time card border and changed it to a more transparent ambient fill.
- Added a reset view button below the cloud toggle; it returns the camera to the current/fallback user location.
- Applied Earth's axial tilt at 23.44 degrees to the globe coordinate frame and adjusted the shader sun vector into the same tilted frame.
- Changed the time card to fully transparent text-only styling so it no longer blocks the globe.
- Added subtle globe reference lines: true axis line, 30-degree meridians, equator, Tropic of Cancer, and Tropic of Capricorn.
- Made the axis line longer and clearer than the atmosphere shell for a stronger sense of extension.
- Increased reference line visibility while keeping the style atmospheric.
- Added a grid toggle below reset view; it controls meridians, equator, and tropic lines while the axis line always remains visible.
- Restored slow idle motion using camera orbit controls instead of rotating the physical Earth mesh.
- Kept Earth's axis tilted 23.44 degrees relative to the ecliptic frame while preserving the real-time terminator calculation.

### 2026-05-22

- Confirmed that the current procedural geography is visually insufficient.
- Added this README as the single place for project progress, known issues, and data/API decisions.
- Agreed that future changes and progress notes should be recorded here.
- Added `src/services/earthTelemetry.js` as the unified data layer for location, weather, solar, lunar, and source metadata.
- Kept `src/services/earthDataService.js` as a compatibility wrapper for the current UI.
- Switched weather and sunrise/sunset fetching to a single Open-Meteo forecast request.
- Added local approximate solar and lunar position calculations while moonrise/moonset provider choice remains open.
- Added visible telemetry source chips for Open-Meteo/live and local-model states.

### 2026-05-21

- Created the initial Vite + React + Three.js project.
- Built the first immersive Earth companion scene.
- Added geolocation, Open-Meteo weather, fallback data behavior, and ambient narration.

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173/
```

Production build:

```bash
npm run build
```
