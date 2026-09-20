# Hand tracking

`hand_landmarker.task` is the official MediaPipe Hand Landmarker (float16, model version 1):

https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

The model and the version-matched WASM runtime from `@mediapipe/tasks-vision` are
served by SkyFlow itself. They are loaded only after the visitor enables hand
tracking. Video frames stay in the browser and are neither recorded nor uploaded.

Upstream documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
