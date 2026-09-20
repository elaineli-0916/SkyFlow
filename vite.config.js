import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [react(), viteStaticCopy({
    targets: [...["Workers", "ThirdParty", "Assets", "Widgets"].map((name) => ({
      src: `node_modules/cesium/Build/Cesium/${name}`,
      dest: "cesium"
    })), {src:"node_modules/@mediapipe/tasks-vision/wasm/*",dest:"mediapipe/wasm"}]
  })],
  worker: {format:"es"},
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787"
    }
  }
});
