import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, "../.."),
  server: {
    port: 5173,
    proxy: {
      // Proxy /api calls to the issuer-api backend (avoids CORS in dev)
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
});
