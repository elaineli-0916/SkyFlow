# SkyFlow: An AI Native Earth Companion

![SkyFlow preview](./docs/images/skyflow-preview.png)

SkyFlow is an immersive real-time Earth companion.

It is not a conventional weather app, and it is not a chatbot placed beside a globe. It is an ambient observation interface where clouds, moonlight, daylight, weather, and personal sky memories become something you can look at, ask about, and return to.

SkyFlow is built around a simple feeling: the Earth should not be a background image. It should feel like the interface is alive enough to answer.

中文版本: [README.zh-CN.md](./README.zh-CN.md)

## Demo

- Live demo: add Vercel link here after deployment
- Demo video: add video link here
- Repository: current GitHub project

## What You See

SkyFlow opens with a cinematic 3D Earth. The globe shows a live day-night boundary, cloud texture, atmospheric glow, stars, and local sky context.

You can drag the Earth, pause on a view, and let the camera return to a very slow orbit. The interface stays quiet: a few readouts, a line of ambient narration, and the sense that light and weather are still moving even when you are not touching anything.

## Three Ways To Use SkyFlow

### Companion: Watch The Earth Quietly

Companion is the default mode.

It is designed for presence rather than task completion. Every few seconds, SkyFlow rotates through short atmospheric lines about the moon, clouds, sunrise, sunset, city lights, and the feeling of being connected to the real world.

In Companion, you can:

- Drag and orbit the Earth.
- Stay on the angle you choose after dragging.
- Watch local time, moon altitude, and the next light shift.
- Toggle clouds, reference grid, and soundscape.
- Reset the camera back to your location.

### Ask: Talk To The Earth

Ask is the natural language entry point.

You can type, upload an image, or use the microphone. SkyFlow answers with the current Earth context in mind, and when appropriate, it can move the interface instead of only replying with text.

Examples:

- `Where is the moon now?`
- `show me the night side`
- `what kind of cloud is this?`
- `describe this sky photo`

Image interpretation and ordinary answers stay inside Ask. SkyFlow should not switch views just because the user uploaded an image. It only moves into Observe when the question benefits from spatial sky data.

### Observe: Understand The Current Sky

Observe is the local sky and telemetry view.

It shows:

- Location and coordinates.
- Sun path, sunrise, sunset, and solar direction.
- Moon path, moonrise, moonset, meridian time, moon altitude, and moon phase.
- Weather summary, cloud cover, and the next light shift.
- Source labels for the data currently being used.

When Ask leads into Observe, SkyFlow highlights the relevant part of the interface. A moon question highlights moon path and altitude; a sun or sunset question highlights the sun path; a weather or cloud question highlights sky conditions.

## Sky Memories

SkyFlow treats photos as memories that can belong to places on Earth.

The current prototype includes sky memory markers such as Yueyang, College Park, Provideniya, and Los Angeles. The goal is not only to upload an image, but to place a moment of sky back onto the globe.

The app currently keeps two kinds of records:

- Conversation timeline: user input, attachments, response route, answer, and triggered UI actions.
- Memory candidates: stable preferences or meaningful long-term facts, such as language preference, recurring sky interests, or important place-photo associations.

SkyFlow does not save raw uploaded media as long-term memory.

## Tech Stack

Frontend:

- React
- Vite
- Tailwind CSS
- Three.js
- React Three Fiber
- Drei
- Lucide React

Backend and AI:

- Node.js
- Vercel Serverless Functions
- DashScope-compatible Qwen model
- DashScope Paraformer ASR
- Open-Meteo

Rendering:

- Local day, night, and cloud Earth textures
- Shader-based day-night blending
- Real-time subsolar direction approximation
- Camera-based globe interaction with slow idle orbit

## Data Sources

SkyFlow combines live data, local calculations, and static visual assets.

- Browser Geolocation provides the local observation point when available.
- Open-Meteo provides weather, cloud cover, wind speed, sunrise, and sunset.
- Local astronomy helpers estimate sun direction, sun altitude, moon direction, moon altitude, and moon phase.
- Timeanddate moon data can be requested through the backend for richer moon timing.
- DashScope Qwen powers open-ended Ask responses.
- DashScope Paraformer powers microphone transcription.

If a provider is unavailable, SkyFlow falls back to local estimates instead of breaking the experience.

## Privacy And API Keys

Provider API keys are never stored in the browser.

The frontend calls same-origin routes such as `/api/earth/chat` and `/api/asr/transcribe`. Those routes run on the server side and read secrets from environment variables.

Do not store secrets with a `VITE_` prefix. Vite exposes `VITE_*` variables to the client bundle.

## Local Development

Install dependencies:

```bash
npm install
```

Run the local API server:

```bash
npm run server
```

Run the Vite dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Deployment

SkyFlow is ready to deploy on Vercel.

Required environment variables:

```bash
DASHSCOPE_API_KEY=your_dashscope_key
QWEN_MODEL=qwen3.5-omni-plus
DASHSCOPE_ASR_MODEL=paraformer-v2
```

Vercel settings:

```text
Build command: npm run build
Output directory: dist
```

See [docs/vercel-deployment.md](./docs/vercel-deployment.md) for deployment details.
