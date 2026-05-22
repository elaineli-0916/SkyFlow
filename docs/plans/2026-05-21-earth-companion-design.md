# Earth Companion MVP Design

## Direction

Build a hybrid MVP for an AI-native ambient Earth interface. The first priority is a cinematic, living globe that feels real within 10 seconds. Real-time services are introduced through a small replaceable data layer, with graceful local fallbacks when geolocation or public APIs are unavailable.

## Experience

The first screen is the product: a full-bleed orbital observation window with a slowly rotating Earth, animated cloud bands, atmospheric glow, stars, and live day/night lighting driven by time. UI stays sparse: location/time hints, a quiet companion line, and a few environmental readouts that feel like spacecraft glass rather than a dashboard.

## Architecture

- React + Vite for the app shell.
- React Three Fiber + Three.js for the WebGL globe.
- TailwindCSS for the minimal overlay system.
- `earthDataService` owns geolocation, weather, sunrise/sunset, moon phase, and narrative context.
- Procedural shaders and generated canvas textures avoid blocking the MVP on external assets.

## Data Flow

On load, the app requests approximate browser location. It then fetches Open-Meteo weather and sunrise/sunset when possible. The render loop continuously derives sun direction, terminator position, cloud movement, and narration timing from the latest environment snapshot. If a request fails, the app keeps running with local time, approximate coordinates, and generated ambient observations.

## Testing

Verify by installing dependencies, running the Vite dev server, and opening the local app. Check desktop and mobile viewport framing, globe visibility, controls, fallback behavior, and that the companion layer remains quiet rather than becoming a chatbot.
