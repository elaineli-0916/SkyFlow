# SkyFlow

**An interactive Earth for journeys, cities, and personal memory.**

[中文](./README.zh-CN.md) · [Live demo](https://sky-flow-eosin.vercel.app/) · [Original Earth Companion](https://sky-flow-eosin.vercel.app/?view=classic)

SkyFlow turns a personal journey into a spatial experience. It begins in orbit, follows a path across cities, descends into satellite views and a handcrafted 3D model of Hong Kong, and reveals photographs at the places where they were taken.

The globe is the interface. Music, camera movement, city geometry, weather, moonlight, and photographs carry the story.

> This person keeps moving, and keeps observing the world.

## The experience

### Observe from orbit

The opening places you inside an astronaut's point of view. Earth rotates independently while the observer can look around, orbit, hover, move closer, or pull away. A cursor-directed light cone gives the scene a physical point of attention.

Camera control is opt-in. When enabled, MediaPipe Hand Landmarker runs locally in a Web Worker and draws the detected hand skeleton in the preview:

| Gesture | Camera response |
| --- | --- |
| Move one hand sideways | Orbit continuously; a wider, faster motion produces a faster orbit |
| Open one hand | Move closer to Earth |
| Make a fist | Move away from Earth |

Mouse, wheel, and keyboard controls remain available at all times.

### Follow a journey

Selecting **沿着轨迹出发** starts the music and follows this route:

**Beijing → Shanghai → New York → Maryland → Beijing → Hong Kong → Shanghai → Beijing**

Each stop is a real camera journey: the globe pulls back, crosses the route, descends toward the city, and settles into a view where local photographs can appear as spatial memories. The viewer can interrupt the sequence and explore freely.

### Enter the city

Beijing and New York open as close satellite views. Hong Kong transitions into a stylized 3D atlas built from geographic data:

- independent land, water, terrain, buildings, trees, and landmark geometry;
- recognizable coastlines and the spatial relationship between Hong Kong Island and Kowloon;
- detailed landmark facades, including HKU, IFC, ICC, Bank of China Tower, and Victoria Peak;
- sunset and night modes, with illuminated windows and readable silhouettes;
- photo pins placed at their supplied coordinates.

### Keep the sky connected

SkyFlow retains the original weather and astronomy layer: current weather, cloud cover, sunset time, moon phase, local sky calculations, and the earlier Companion / Ask / Observe experience are still available through **Original Earth Companion**.

## Product architecture

SkyFlow is a React + Vite prototype with two connected rendering layers:

- **CesiumJS** renders the globe, satellite city approaches, route arcs, camera flights, and spatial photo markers.
- **Three.js / React Three Fiber** renders the stylized Hong Kong model.
- **MediaPipe Tasks Vision** performs local hand tracking off the main render thread.
- **Open-Meteo and local astronomy helpers** provide weather and sky context.
- **A server-side map proxy** keeps the Google Maps API key out of the browser.

The frontend also exposes an allow-listed AI Director action plan:

```text
fly_to · show_overlay · show_photo · show_moon_path · narrate
```

These actions are executed in sequence, so a future language model can direct the camera and scene without controlling the interface directly.

## Run locally

```bash
npm install
cp .env.example .env
```

Add server-side keys to `.env` as needed:

```bash
GOOGLE_MAPS_API_KEY=
DASHSCOPE_API_KEY=
QWEN_MODEL=qwen3.5-omni-plus
DASHSCOPE_ASR_MODEL=paraformer-v2
SERVER_PORT=8787
```

Start the API and frontend in two terminals:

```bash
npm run server
```

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Camera hand tracking requires browser permission and works best on localhost or HTTPS.

Build the production bundle:

```bash
npm run build
```

## Project status

This is a working MVP. Hong Kong is the first fully modeled city; Beijing and New York currently use close satellite views. The AI Director contract is in place for later natural-language direction.

The earlier Earth Companion README is preserved in [docs/legacy/README-v1.md](./docs/legacy/README-v1.md). Deployment notes remain in [docs/vercel-deployment.md](./docs/vercel-deployment.md).
