# SkyFlow: An AI Native Earth Companion

![SkyFlow preview](./docs/images/skyflow-preview.png)

SkyFlow is an immersive real-time Earth companion.

It is not a conventional weather app, and it is not a chatbot placed beside a globe. It is an ambient observation interface where clouds, moonlight, daylight, weather, and personal sky memories become something you can look at, ask about, and return to.

SkyFlow is built around a simple feeling: the Earth should not be a background image. It should feel like the interface is alive enough to answer.

中文版本: [README.zh-CN.md](./README.zh-CN.md)

## Demo

- Live demo: [sky-flow-eosin.vercel.app](https://sky-flow-eosin.vercel.app/)
- Demo video: [Bilibili 3-minute demo](https://www.bilibili.com/video/BV1rNGJ69EU8/)
- Repository: [elaineli-0916/SkyFlow](https://github.com/elaineli-0916/SkyFlow)

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
- Sky memories: when the user explicitly asks to save an uploaded sky photo, SkyFlow reads capture time and GPS metadata. If either is missing, Ask continues the conversation and asks for the missing detail before placing the memory on the globe.

The first version stores sky memories in the current browser with localStorage. It does not require an account or cloud sync.

## Interaction Playbook

Use these prompts to test the interaction rules. The goal is not just whether SkyFlow answers, but whether it drives the Earth interface in the right way.

### 1. Ask leads into Observe

Try:

```text
Where is the moon now?
```

Expected behavior:

- Ask responds first with a short handoff line.
- The Earth moves toward your local observation context.
- Observe opens and highlights the moon path or moon altitude.

Also try:

```text
When is sunset?
```

```text
Show me the cloud cover above me.
```

### 2. Move the Earth without switching modes

Try:

```text
show me the night side
```

Expected behavior:

- SkyFlow stays in Ask.
- The globe turns toward the night side.
- The conversation timeline records a `show_night_side` action.

Also try:

```text
show me the sunlight edge
```

SkyFlow should move the camera toward the daylight boundary instead of replying with a long explanation.

### 3. Inspect an uploaded cloud photo

Upload a cloud photo and ask:

```text
what kind of cloud is this?
```

Expected behavior:

- SkyFlow stays in Ask.
- It answers about the image content.
- It does not jump to Observe.
- If it hints at the cloud layer, that should be a light visual pulse, not a mode switch.

This tests the distinction between a cloud in a photo and the live sky above the user.

### 4. Save a sky photo as a memory

Upload a sky photo and ask:

```text
save this sky memory
```

Expected behavior:

- If the image has GPS and capture time, SkyFlow saves it immediately.
- If GPS is missing, Ask asks where the photo was taken.
- If capture time is missing, Ask asks for the time.
- After saving, the Earth moves to the location and a new sky memory marker appears.
- After refresh, the local marker is still there.

### 5. Watch realtime Companion narration

Return to Companion and wait for about 30 seconds.

Expected behavior:

- The line still changes every 10 seconds.
- The text reflects current cloud cover, sun altitude, moon altitude, moon phase, and local time.
- It does not use personal-interest memory yet; it stays grounded in realtime sky state.

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
- exifr

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
- exifr reads photo capture time and GPS metadata in the browser.

If a provider is unavailable, SkyFlow falls back to local estimates instead of breaking the experience.

## Privacy And API Keys

Provider API keys are never stored in the browser.

The frontend calls same-origin routes such as `/api/earth/chat` and `/api/asr/transcribe`. Those routes run on the server side and read secrets from environment variables.

Do not store secrets with a `VITE_` prefix. Vite exposes `VITE_*` variables to the client bundle.

Uploaded images are interpreted for the current request. A thumbnail and sky memory metadata are saved locally only when the user explicitly asks SkyFlow to remember the photo.

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
