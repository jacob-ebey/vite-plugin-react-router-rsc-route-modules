import type { unstable_RSCRouteConfig } from "react-router";
import { frameworkRoute } from "vite-plugin-react-router-rsc-route-modules/route";

export const routes = [
  {
    id: "root",
    path: "",
    lazy: frameworkRoute(() => import("./root.tsx")),
    children: [
      {
        id: "index",
        index: true,
        lazy: frameworkRoute(() => import("./routes/index.tsx")),
      },
      {
        id: "about",
        path: "about",
        lazy: frameworkRoute(() => import("./routes/about.tsx")),
      },
    ],
  },
] satisfies unstable_RSCRouteConfig;
