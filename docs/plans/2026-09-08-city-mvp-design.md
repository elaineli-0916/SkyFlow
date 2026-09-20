# SkyFlow city narrative MVP

Scope follows the requested five first-phase modules. Keep the existing React/Vite application and API server. Keep the Cesium first-phase city experience as the default entry; replace only the Hong Kong zoom-in content layer with a low-poly R3F sandbox. Preserve the original Earth experience at `?view=classic` without changing its components or local storage.

## Implementation

1. Proxy Google Photorealistic 3D Tiles through the existing Node API and Vercel functions. Read `GOOGLE_MAPS_API_KEY` only on the server, rewrite nested resource URLs to the proxy, retain attribution, and sanitize failures. Validate using HTTP tests before building the viewer.
2. Keep Cesium and its locally served workers/assets for the globe, three city presets, markers, camera flights, and Google 3D Tiles fallback. Do not claim that a textured globe is photorealistic city coverage.
3. Add a Hong Kong-only R3F zoom-in layer: extruded island contour, low-poly hills, flat-shaded building footprints, trees, water, and one highlighted harbor marker. Beijing and New York retain the existing Cesium zoom-in behavior in this phase. Editorial photo overlays and existing weather/astronomy data continue to work for all three cities.
4. A versioned action plan and sequential, cancellable runner handle camera completion, overlays, photos and narration. A small deterministic bilingual city parser is the MVP director; a future AI response uses the same validated schema. Reserve `show_moon_path` without implying a finished moon-path feature.
5. Verify each module, then production build, browser interactions, mobile layout, cancellation, API failures, and original experience navigation.

## Choices and constraints

Replacing the large existing EarthCanvas would risk its current features and uncommitted edits. A separate city layer adds only a conditional R3F canvas and a small telemetry extension. Browser-side Google keys would violate the requested secrecy, so the extra proxy is necessary. No new state manager, router, authentication system, or AI vendor is needed.

Google 3D buildings have location-dependent coverage. No Google key was configured at inspection time. Live three-city mesh coverage and billing/quota behavior remain relevant to the Cesium fallback; the low-poly Hong Kong study itself does not depend on a Google key. Keep Google and per-tile attribution visible. The proxy is for an interactive demo, with no persistent tile caching.

References: https://developers.google.com/maps/documentation/tile/3d-tiles and https://developers.google.com/maps/documentation/tile/policies and https://developers.google.com/maps/documentation/javascript/3d/coverage
