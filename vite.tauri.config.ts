import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { markdownWorkerPlugin } from "./build/markdown-worker-plugin";
import { micromarkLinearDataPlugin } from "./build/micromark-linear-data-plugin";

const projectRoot = __dirname;

export default defineConfig({
  root: path.join(projectRoot, "tauri-app"),
  publicDir: path.join(projectRoot, "public"),
  plugins: [micromarkLinearDataPlugin(), react()],
  worker: { plugins: () => [markdownWorkerPlugin(), micromarkLinearDataPlugin()] },
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: path.join(projectRoot, "dist-tauri"),
    emptyOutDir: true,
    target: "es2021",
  },
});
