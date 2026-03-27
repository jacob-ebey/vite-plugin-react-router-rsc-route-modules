import rsc from "@vitejs/plugin-rsc";
import { defineConfig } from "vite-plus";
import devtoolsJson from "vite-plugin-devtools-json";

import { routeModuleDirective } from "../src/index";

export default defineConfig({
  plugins: [
    routeModuleDirective(),
    rsc({
      entries: {
        client: "./src/client.tsx",
        ssr: "./src/ssr.tsx",
        rsc: "./src/server.ts",
      },
    }),
    devtoolsJson(),
  ],
  build: {
    minify: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router/") ||
            id.includes("@vitejs/plugin-rsc/")
          ) {
            return "vendor";
          }
        },
      },
    },
  },
});
