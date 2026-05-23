# SkyFlow Interaction Rules

## Goal

SkyFlow should feel like an ambient Earth companion, not a conventional chatbot. Ask mode can use a multimodal LLM, but every answer should remain tied to the globe, local sky, photo memories, or a clear interface action.

## Routing

Ask mode uses this route order:

1. Try `POST /api/earth/chat`.
2. If the backend and model API are reachable, use the model response.
3. If the backend is unavailable, the API key is missing, or the provider request fails, use local fallback rules.
4. Always show the route in the conversation timeline:
   - `checking api`
   - `qwen api`
   - `local rules`
   - `local fallback`

## User Inputs

Supported first-pass inputs:

- Text command
- Image attachment
- Microphone voice command

The frontend sends image attachments as data URLs to the local backend. Provider API keys must stay server-side and must never be exposed to the browser.

## Voice Input

Microphone input is not treated as an audio attachment in the conversation UI. The browser records a short 16 kHz mono PCM command, sends it to `POST /api/asr/transcribe`, and uses the returned transcript as the user message. The LLM still receives text, images, and Earth context through `POST /api/earth/chat`.

`DASHSCOPE_ASR_MODEL=paraformer-v2` is accepted in local config. For live microphone input, SkyFlow maps it to DashScope's real-time Paraformer WebSocket model because the recorded-file REST API requires a public file URL.

## Model Response Contract

The backend asks the model to return compact JSON:

```json
{
  "text": "A short natural answer.",
  "actions": [
    { "type": "open_look_up" }
  ],
  "memoriesToSave": []
}
```

If the model returns plain text or malformed JSON, the backend falls back to a safe text-only answer.

## Allowed UI Actions

The model may suggest only these actions:

- `open_look_up`
- `focus_moon`
- `focus_sun`
- `focus_photo_marker`
- `show_night_side`
- `show_sunlight`
- `set_mode`

The frontend executes only allowlisted actions. The model should not directly manipulate UI state.

## Local Fallback Rules

When the model is unavailable, local keyword rules handle:

- Moon questions
- Sun questions
- Sky condition questions
- Sunset questions
- Night side requests
- Sunlight / terminator requests
- Photo memory questions
- Mode switching between Companion, Ask, and Observe
- Simple continuation prompts such as "continue", "more", or "再说"

Fallback answers should explicitly remain calm and useful. They should not pretend to be the LLM.

## Conversation Timeline

Ask mode displays the full interaction process:

- User input
- Attachment names
- Route used
- Assistant answer
- UI actions triggered

This is intentionally visible while the product is still early. Later, the route details can become a developer/debug toggle.

## Memory Rules

First-pass memory is conservative.

Save only stable, user-relevant facts:

- Preferred language or tone
- Recurring sky interests
- Meaningful photo/location associations
- Stable location assumptions if the user confirms them

Do not save:

- Sensitive information
- One-off commands
- Unconfirmed identity facts
- Raw uploaded media

The first implementation stores memory in `server/storage/memories.json`. Later upgrades can move to SQLite plus vector retrieval.

## Tone

Responses should be concise, grounded, and atmospheric. Good SkyFlow answers feel like a calm interface speaking from orbit: practical enough to act, poetic enough to belong to the product.
