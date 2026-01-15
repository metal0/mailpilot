import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: "../dist/dashboard",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:8085",
      "/ws": {
        target: "ws://localhost:8085",
        ws: true,
      },
    },
  },
});
