import * as path from "node:path";
import * as fsp from "node:fs/promises";
import { pathToFileURL } from "node:url";

import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { defineConfig, preview, type Plugin } from "vite-plus";
import devtoolsJson from "vite-plugin-devtools-json";

import { knownRouteModules, routeModuleDirective } from "../src/index";

const SINGLE_PAGE_APP = !!process.env.SPA;

export default defineConfig({
  define: {
    SINGLE_PAGE_APP: JSON.stringify(SINGLE_PAGE_APP),
  },
  plugins: [
    SINGLE_PAGE_APP && spaPlugin({ prerender: ["/", "/post/post-1"] }),
    knownRouteModules({
      isKnownRouteModule: (id) => id.endsWith("/root.tsx"),
    }),
    routeModuleDirective(),
    react(),
    rsc(),
    { enforce: "pre", ...mdx() },
    devtoolsJson(),
  ],
  environments: {
    client: {
      build: {
        rolldownOptions: {
          input: { index: SINGLE_PAGE_APP ? "./_spa-fallback.html" : "./src/client.tsx" },
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

function spaPlugin({ prerender }: { prerender?: string[] } = {}): Plugin[] {
  // serve fallback.html before rsc server
  return [
    {
      name: "serve-spa",
      configureServer(server) {
        return () => {
          server.middlewares.use(async (req, res, next) => {
            try {
              if (req.headers.accept?.includes("text/html")) {
                const html = await fsp.readFile("_spa-fallback.html", "utf-8");
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
                const url = new URL(req.url || "/", `http://localhost`);
                const specificPath = `dist/client${url.pathname.replace(/\/$/, "")}/index.html`;
                const filePath = (await fsp
                  .stat(specificPath)
                  .then((r) => r.isFile())
                  .catch(() => false))
                  ? specificPath
                  : "dist/client/_spa-fallback.html";
                const html = await fsp.readFile(filePath, "utf-8");
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
      buildApp: {
        order: "post",
        async handler(builder) {
          if (!prerender?.length) return;
          const previewServer = await preview();

          const ssrBuildPath = pathToFileURL(path.resolve(process.cwd(), "dist/ssr/index.js")).href;
          const ssrModule = (await import(ssrBuildPath)) as typeof import("./src/ssr.tsx");

          try {
            const address = previewServer.httpServer.address();
            let port: number;
            if (typeof address === "string") {
              port = parseInt(address.split(":").pop()!);
            } else if (address && typeof address === "object") {
              port = address.port;
            } else {
              throw new Error("Failed to determine preview server port");
            }

            process.env.PRERENDER = "1";

            for (const prerenderPath of prerender) {
              const url = new URL(prerenderPath, `http://localhost:${port}`);

              const request = new Request(url.href, {
                headers: {
                  Accept: "text/x-component",
                },
              });

              const serverResponse = await fetch(request);
              const rscResponse = serverResponse.clone();
              const htmlResponse = await ssrModule.generateHTML(request, serverResponse);

              const htmlFilePath = `dist/client${url.pathname.replace(/\/$/, "")}/index.html`;
              let rscFilePath: string;
              if (url.pathname === "/") {
                rscFilePath = "dist/client/_.rsc";
              } else {
                rscFilePath = `dist/client${url.pathname.replace(/\/$/, "")}.rsc`;
              }

              await fsp.mkdir(path.dirname(htmlFilePath), { recursive: true });

              await Promise.all([
                fsp.writeFile(htmlFilePath, await htmlResponse.text()),
                fsp.writeFile(rscFilePath, Buffer.from(await rscResponse.arrayBuffer())),
              ]);
            }
          } finally {
            await previewServer.close();
          }
        },
      },
    },
  ];
}
