import rsc from "@vitejs/plugin-rsc";
import { defineConfig } from "vite-plus";
import devtoolsJson from "vite-plugin-devtools-json";

import { knownRouteModules, routeModuleDirective } from "../src/index";

export default defineConfig({
  plugins: [
    knownRouteModules({
      isKnownRouteModule: (id) => id.endsWith("/root.tsx"),
    }),
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
