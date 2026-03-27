import rsc from "@vitejs/plugin-rsc";
import inspect from "vite-plugin-inspect";
import { defineConfig } from "vite-plus";

import { routeModuleDirective } from "../src/index";

export default defineConfig({
  plugins: [
    routeModuleDirective(),
    rsc({
      entries: {
        rsc: "./src/server.ts",
      },
    }),
    inspect({
      build: true,
    }),
  ],
  build: {
    minify: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("@vitejs/plugin-rsc")) {
            return "vendor";
          }
        },
      },
    },
  },
});
