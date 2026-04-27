import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

/**
 * The Identus Edge Agent SDK uses Rust/WASM for DIDComm and AnonCreds.
 * vite-plugin-wasm + vite-plugin-top-level-await are required to load these
 * WASM modules correctly in the browser.
 */
export default defineConfig({
  plugins: [wasm(), topLevelAwait(), react()],
  define: {
    global: "globalThis",
  },
  envDir: path.resolve(__dirname, "../.."),
  server: {
    port: 5174,
  },
  optimizeDeps: {
    include: ["@hyperledger/identus-edge-agent-sdk"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
  },
});
