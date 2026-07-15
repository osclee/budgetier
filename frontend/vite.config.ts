import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

// During local dev, proxy /api to the Azure Functions host (func start → :7071).
// This keeps the browser same-origin (localhost:5173), so the auth cookie flows.
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:7071",
        changeOrigin: true,
      },
    },
  },
});
