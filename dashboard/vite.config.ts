import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/dashboard/api": "http://localhost:8080",
      "/dashboard/ws": {
        target: "ws://localhost:8080",
        ws: true,
      },
    },
  },
});
