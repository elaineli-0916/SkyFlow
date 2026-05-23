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
    { "type": "set_mode", "mode": "observe" }
  ],
  "memoriesToSave": []
}
```

If the model returns plain text or malformed JSON, the backend falls back to a safe text-only answer.

## Allowed UI Actions

The model may suggest only these actions:

- `focus_photo_marker`
- `show_night_side`
- `show_sunlight`
- `set_mode`

The frontend executes only allowlisted actions. The model should not directly manipulate UI state.

## Ask to Observe Transition

Ask mode should not jump to Observe after every natural-language answer. Use `set_mode: observe` only when the answer is better shown through spatial telemetry, sky position, sunlight, clouds, or local observation data.

Do not jump to Observe for:

- Ordinary conversation, explanations, greetings, follow-ups, or fallback help.
- Image-inspection questions after an upload, such as "what is this", "what is in this image", "what kind of cloud is this", or "这是什么云".
- Questions about the content of a photo, the type of cloud in an image, or an observed phenomenon inside the uploaded image rather than the user's live local sky.
- Image-only submissions without an explicit request to observe the local sky.

When Ask does move into Observe, the transition should feel like the Earth is guiding the user to the answer, not like the app is switching tabs. Treat the handoff as a three-step interaction:

1. First, answer briefly inside Ask with an immediate handoff line, such as "Let me show you where the moon is relative to your sky." or "I will take you to the cloud field above your location."
2. Then transition into Observe with choreography: the Earth subtly zooms or rotates toward the relevant location, the requested data fades in, the top mode indicator slides from Ask to Observe, and the narration updates in sync.
3. Once Observe is visible, highlight the information that answered the question for 1-2 seconds. Moon questions should glow the Moon Path / Moon Altitude area, sun questions should glow Sun Path / sunlight data, and cloud or weather questions should glow Weather / cloud-density data.

The mode indicator should confirm the journey after it begins; it should not be the only visible sign of change. The user should feel "SkyFlow is taking me to see it," not "my chat response opened another page."

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
