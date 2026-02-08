import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Tauri expects a fixed port for dev; override via VITE_PORT env var
  server: {
    port: parseInt(process.env.VITE_PORT || "5173"),
    strictPort: true,
  },
  // Prevent Vite from obscuring Rust errors
  clearScreen: false,
});
