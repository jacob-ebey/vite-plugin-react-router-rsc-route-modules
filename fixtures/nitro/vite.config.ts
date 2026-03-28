import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";
import devtoolsJson from "vite-plugin-devtools-json";

import { routeModuleDirective } from "vite-plugin-react-router-rsc-route-modules";

export default defineConfig(({ command }) => ({
  plugins: [
    // not sure why this doesn't work in dev
    command === "build" &&
      nitro({
        preset: "vercel",
      }),
    routeModuleDirective(),
    react(),
    rsc({
      entries: {
        ssr: "./src/ssr.tsx",
        rsc: "./src/server.ts",
      },
    }),
    { enforce: "pre", ...mdx() },
    devtoolsJson(),
  ],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: { index: "./src/client.tsx" },
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // optimize the build a bit by putting React and React Router in a separate chunk for a more stable and gzippable vendor chunk across builds
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
  optimizeDeps: {
    // optimize deps for a more stable first dev startup experience
    include: ["react", "react-dom", "react-router", "react-router/internal/react-server-client"],
  },
}));
