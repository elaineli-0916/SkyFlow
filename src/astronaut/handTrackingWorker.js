// Loaded only by the explicit camera toggle. Inference stays off the render thread.
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { HAND_CONTROL } from "./handGestures.js";

let detector;
self.onmessage = async ({data}) => {
  try {
    if (data.type === "init") {
      // Module workers need the ES-module WASM loader, which exports ModuleFactory
      // on globalThis. The classic loader's top-level var would stay module-local.
      const files = await FilesetResolver.forVisionTasks(data.wasmUrl,true);
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: {modelAssetPath:data.modelUrl,delegate:"CPU"},
        runningMode:"VIDEO", numHands:2,
        minHandDetectionConfidence:HAND_CONTROL.detectionConfidence,
        minHandPresenceConfidence:HAND_CONTROL.presenceConfidence,
        minTrackingConfidence:HAND_CONTROL.trackingConfidence,
      });
      self.postMessage({type:"ready"});
    } else if (data.type === "frame") {
      try {
        const result = detector.detectForVideo(data.bitmap,data.timestamp);
        self.postMessage({type:"result",result});
      } finally { data.bitmap.close(); }
    }
  } catch (error) {
    detector?.close();detector=null;
    self.postMessage({type:"error",message:error.message});
  }
};
