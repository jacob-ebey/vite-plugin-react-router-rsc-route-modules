import type { unstable_RSCRouteConfig } from "react-router";
import { frameworkRoute } from "vite-plugin-react-router-rsc-route-modules/route";

const postRoutes = import.meta.glob("./routes/**/*.mdx");

export const routes = [
  {
    id: "root",
    path: "",
    handle: {
      posts: Object.entries(postRoutes).map(([path]) => {
        const id = path.slice("./routes/posts/".length, -".mdx".length);
        return id;
      }),
    },
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
      {
        id: "post",
        path: "post",
        lazy: frameworkRoute(() => import("./routes/post.tsx")),
        children: Object.entries(postRoutes).map(([path, loader]) => {
          const id = path.slice("./routes/posts/".length, -".mdx".length);
          return {
            id,
            path: id,
            lazy: frameworkRoute(loader as () => Promise<{ default: React.ComponentType<any> }>),
          };
        }),
      },
    ],
  },
] satisfies unstable_RSCRouteConfig;
