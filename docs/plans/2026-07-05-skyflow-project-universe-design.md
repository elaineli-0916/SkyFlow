# SkyFlow Project Universe Design

## Direction

Turn SkyFlow into a personal interactive homepage without losing its current identity as an Earth companion. The homepage should feel like a small personal universe: the live Earth remains the emotional center, and six project objects orbit around it as explorable entry points.

The first version should borrow the strongest idea from Room Portfolio: click an object, zoom into it, and reveal a project surface. It should not copy the room directly. SkyFlow should stay celestial, memory-driven, and product-focused.

## First Version Scope

Build a homepage mode with six project objects:

- SkyFlow Earth core
- AI Coding / Workflow console
- Interview Agent studio
- RAG / document knowledge block
- Photo Memory film star
- About Me profile capsule

Each object needs a visible 3D presence, hover affordance, keyboard-reachable focus, and a project card that opens when selected. The first pass can use lightweight Three.js geometry, icons, labels, and material treatments instead of custom GLB models. Custom models can replace the placeholders after the interaction system feels right.

## Experience

The page opens in a full-bleed universe view. The Earth still rotates slowly, clouds and light still move, and the existing SkyFlow atmosphere remains recognizable. Around the Earth, six objects sit on stable orbital positions.

Users can:

- Drag and scroll as they do today.
- Use WASD or arrow keys to drift the camera around the project universe.
- Click or press Enter on a focused object to zoom in.
- Read a project card attached to the selected 3D object.
- Press Escape, click empty space, or use a back control to zoom out.

The project card should be a compact in-world surface, not a large marketing overlay. It should show what the project is, what the user can inspect, and one or two direct actions such as viewing the project details or returning to orbit.

## Architecture

Keep the current app shell and render stack:

- `src/App.jsx` remains the top-level state owner.
- `src/components/EarthCanvas.jsx` remains the full-screen R3F canvas.
- Add a `homepage` mode alongside `companion`, `ask`, and `observe`.
- Add a `ProjectUniverse` scene component inside `EarthCanvas`.
- Add a small project data module for the six objects and card content.

The implementation should extend the existing command/camera pattern instead of introducing a separate routing system. The current `visualCommand` flow already supports camera travel and focused poses; the homepage can add project-specific command types such as `project-focus` and `project-reset`.

## Interaction Model

The state model should stay small:

- `selectedProjectId`: which project is zoomed in, or `null`.
- `focusedProjectId`: keyboard or hover focus.
- `homepageTravel`: transient camera target state, driven through `visualCommand`.

Object selection should trigger a camera pose, pause idle orbit, and open the card only when the camera is close enough or the project state is committed. Zoom-out clears `selectedProjectId` and returns to the default universe pose.

Keyboard movement should be gentle camera drift, not full first-person physics. The first version should avoid collision detection, character controllers, and room-scale navigation. It only needs to make the universe feel explorable.

## Visual Design

Use six distinct silhouettes and colors so the objects are scannable without reading labels. Avoid making the screen dominated by one color family. The Earth can stay blue and luminous, but project objects should introduce varied accents: amber, green, white, coral, violet, and cyan.

Cards should be compact and readable at desktop and mobile sizes. Text must not overlap the canvas controls, and card content should wrap cleanly. Labels should appear near objects but not clutter the whole scene.

## Data Flow

Project metadata should be static in the first version:

- id
- title
- short label
- role or category
- summary
- object position
- accent color
- card actions

Later versions can connect the project cards to richer pages, demos, GitHub links, or Ask-mode context. The MVP should not depend on accounts, databases, external APIs, or new backend services.

## Error Handling

If WebGL assets or optional icons fail, the six project objects should still render as simple geometric placeholders. If keyboard focus is unavailable or a device is touch-only, pointer and tap interactions should fully work.

The app should not block on external model downloads. All first-version assets should be local and small.

## Testing

Verify the design through these checks:

- `npm run build` succeeds.
- Desktop viewport shows the Earth and all six project objects without overlap.
- Mobile viewport keeps the primary object and selected card readable.
- WASD and arrow keys move the camera in homepage mode.
- Clicking each of the six objects opens the correct project card.
- Escape or back returns from each card to the universe view.
- Companion, Ask, and Observe still work after homepage mode is added.

## Open Decisions

- Whether homepage becomes the default first screen or sits behind a mode switch.
- Whether Ask should answer questions about the six projects in the first implementation.
- Whether project cards should link to external pages immediately or stay as local summaries for MVP.
