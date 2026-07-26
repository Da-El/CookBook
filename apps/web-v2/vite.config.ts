import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// V2 frontend — proxies /v2 and /healthz to V2 API (8081), never V1 (8080)
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    proxy: {
      "/v2": "http://127.0.0.1:8081",
      "/healthz": "http://127.0.0.1:8081",
    },
  },
});
