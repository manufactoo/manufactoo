import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      // Docker Desktop en Windows no siempre propaga eventos inotify para
      // cambios hechos desde el host a traves de un bind mount; sin polling
      // el dev server nunca se entera de los cambios de fichero.
      usePolling: true,
      interval: 300,
    },
  },
});
