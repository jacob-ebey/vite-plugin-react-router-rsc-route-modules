import * as fsp from "node:fs/promises";
import rsc from "@vitejs/plugin-rsc";
import { defineConfig, type Plugin } from "vite-plus";
import devtoolsJson from "vite-plugin-devtools-json";

import { knownRouteModules, routeModuleDirective } from "../src/index";

const SINGLE_PAGE_APP = !!process.env.SPA;

export default defineConfig({
  define: {
    SINGLE_PAGE_APP: JSON.stringify(SINGLE_PAGE_APP),
  },
  plugins: [
    SINGLE_PAGE_APP && spaPlugin(),
    knownRouteModules({
      isKnownRouteModule: (id) => id.endsWith("/root.tsx"),
    }),
    routeModuleDirective(),
    rsc(),
    devtoolsJson(),
  ],
  environments: {
    client: {
      build: {
        rolldownOptions: {
          input: { index: SINGLE_PAGE_APP ? "./index.html" : "./src/client.tsx" },
        },
      },
    },
    ssr: {
      build: {
        rolldownOptions: {
          input: { index: "./src/ssr.tsx" },
        },
      },
    },
    rsc: {
      build: {
        rolldownOptions: {
          input: { index: "./src/server.ts" },
        },
      },
    },
  },
  build: {
    rolldownOptions: {
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
});

function spaPlugin(): Plugin[] {
  // serve index.html before rsc server
  return [
    {
      name: "serve-spa",
      configureServer(server) {
        return () => {
          server.middlewares.use(async (req, res, next) => {
            try {
              if (req.headers.accept?.includes("text/html")) {
                const html = await fsp.readFile("index.html", "utf-8");
                const transformed = await server.transformIndexHtml("/", html);
                res.setHeader("Content-type", "text/html");
                res.setHeader("Vary", "accept");
                res.end(transformed);
                return;
              }
            } catch (error) {
              next(error);
              return;
            }
            next();
          });
        };
      },
      configurePreviewServer(server) {
        return () => {
          server.middlewares.use(async (req, res, next) => {
            try {
              if (req.headers.accept?.includes("text/html")) {
                const html = await fsp.readFile("dist/client/index.html", "utf-8");
                res.end(html);
                return;
              }
            } catch (error) {
              next(error);
              return;
            }
            next();
          });
        };
      },
    },
  ];
}
