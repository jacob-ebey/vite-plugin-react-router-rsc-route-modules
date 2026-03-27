import * as vite from "vite";
import { describe, expect, test } from "vite-plus/test";

import { routeModuleDirective } from "../src/index.ts";

const mockViteThisContext = {
  error(message: string) {
    throw new Error(message);
  },
  parse(code: string) {
    const ast = vite.parseSync("/test.ts", code);

    if (ast.errors.length > 0) {
      throw new Error(`Failed to parse code: ${ast.errors.map((e) => e.message).join(", ")}`);
    }

    return ast.program;
  },
} as any;

const directivePlugin = routeModuleDirective();

const directiveTransformServer = directivePlugin.transform.handler.bind({
  ...mockViteThisContext,
  environment: {
    name: "rsc",
  },
});

const directiveTransformClient = directivePlugin.transform.handler.bind({
  ...mockViteThisContext,
  environment: {
    name: "ssr",
  },
});

describe("route module", () => {
  test("throws if directive is used in non-server environment", async () => {
    const input = ["'use route';", "export default function Component() {}"];
    await expect(directiveTransformClient(input.join("\n"), "/test.ts")).rejects.toThrow(
      /"use route" directive is only allowed in server environments/,
    );
  });

  test("throws if directive is used with 'use client' directive", async () => {
    const input = ['"use client";', "'use route';", "export default function Component() {}"];
    await expect(directiveTransformClient(input.join("\n"), "/test.ts")).rejects.toThrow(
      /"use client" directive is not allowed in route modules/,
    );
  });

  test("throws if directive is used with 'use server' directive", async () => {
    const input = ['"use server";', "'use route';", "export default function Component() {}"];
    await expect(directiveTransformClient(input.join("\n"), "/test.ts")).rejects.toThrow(
      /"use server" directive is not allowed in route modules/,
    );
  });

  test("skips transform if directive is not present", async () => {
    const input = ['"use something else";', "export default function Component() {}"];
    const result = await directiveTransformServer(input.join("\n"), "/test.ts");
    expect(result).toBeUndefined();
  });

  test("skips transform if directive is in comment or string", async () => {
    const input = [
      "// 'use route';",
      `const str = '"use route"';`,
      "export default function Component() {}",
    ];
    const result = await directiveTransformServer(input.join("\n"), "/test.ts");
    expect(result).toBeUndefined();
  });

  test("removes directive", async () => {
    const input = ["'use route';", "console.log('test');"];
    const result = await directiveTransformServer(input.join("\n"), "/test.ts");
    expect(result?.code).toBe("");
  });

  test("throws error for invalid exports", async () => {
    const input = ["'use route';", "export const foo = 123;"];
    await expect(directiveTransformServer(input.join("\n"), "/test.ts")).rejects.toThrow(
      /Exported name "foo" is not allowed in route modules\. Allowed exports are:/,
    );
  });

  test("re-exports shared exports", async () => {
    const input = ["'use route';", "export function meta() {}", "export function links() {}"];
    const result = await directiveTransformServer(input.join("\n"), "/test.ts");
    expect(result?.code).toBe(
      [
        'export { meta } from "/test.ts?shared-route-module=";',
        'export { links } from "/test.ts?shared-route-module=";\n',
      ].join("\n"),
    );
  });

  test("re-exports client exports", async () => {
    const input = [
      "'use route';",
      "export const handle = () => {};",
      "export const clientMiddleware = [];",
      "export function clientAction() {}",
      "export function clientLoader() {}",
      "export default function Component() {}",
      "export function Layout() {}",
      "export function ErrorBoundary() {}",
      "export function HydrateFallback() {}",
    ];
    const result = await directiveTransformServer(input.join("\n"), "/test.ts");
    expect(result?.code).toBe(
      [
        'export { handle } from "/test.ts?client-route-module=";',
        'export { clientMiddleware } from "/test.ts?client-route-module=";',
        'export { clientAction } from "/test.ts?client-route-module=";',
        'export { clientLoader } from "/test.ts?client-route-module=";',
        'export { default } from "/test.ts?client-route-module=";',
        'export { Layout } from "/test.ts?client-route-module=";',
        'export { ErrorBoundary } from "/test.ts?client-route-module=";',
        'export { HydrateFallback } from "/test.ts?client-route-module=";\n',
      ].join("\n"),
    );
  });

  test("re-exports server exports", async () => {
    const input = [
      "'use route';",
      "export function action() {}",
      "export function loader() {}",
      "export function headers() {}",
      "export function ServerComponent() {}",
      "export function ServerLayout() {}",
      "export function ServerErrorBoundary() {}",
      "export function ServerHydrateFallback() {}",
    ];
    const result = await directiveTransformServer(input.join("\n"), "/test.ts");
    expect(result?.code).toBe(
      [
        'export { action } from "/test.ts?server-route-module=";',
        'export { loader } from "/test.ts?server-route-module=";',
        'export { headers } from "/test.ts?server-route-module=";',
        'export { ServerComponent } from "/test.ts?server-route-module=";',
        'export { ServerLayout } from "/test.ts?server-route-module=";',
        'export { ServerErrorBoundary } from "/test.ts?server-route-module=";',
        'export { ServerHydrateFallback } from "/test.ts?server-route-module=";\n',
      ].join("\n"),
    );
  });

  test("re-exports mixed exports", async () => {
    const input = [
      "'use route';",
      "export function meta() {}",
      "export function clientAction() {}",
      "export function loader() {}",
      "export function ServerComponent() {}",
      "export function Layout() {}",
    ];
    const result = await directiveTransformServer(input.join("\n"), "/test.ts");
    expect(result?.code).toBe(
      [
        'export { meta } from "/test.ts?shared-route-module=";',
        'export { clientAction } from "/test.ts?client-route-module=";',
        'export { loader } from "/test.ts?server-route-module=";',
        'export { ServerComponent } from "/test.ts?server-route-module=";',
        'export { Layout } from "/test.ts?client-route-module=";\n',
      ].join("\n"),
    );
  });
});

describe("server route module", () => {
  test("re-exports shared exports", async () => {
    const input = [
      "'use route';",
      'import "example.css";',
      "export function meta() {}",
      "export function links() {}",
    ];
    const result = await directiveTransformClient(input.join("\n"), "/test.ts?server-route-module");
    expect(result?.code).toBe(
      [
        'import "example.css";',
        'export { meta } from "/test.ts?shared-route-module=";',
        'export { links } from "/test.ts?shared-route-module=";\n',
      ].join("\n"),
    );
  });

  test("re-exports server function exports", async () => {
    const input = [
      "'use route';",
      'import "example.css";',
      "export function action() {}",
      "export function loader() {}",
      "export function headers() {}",
    ];
    const result = await directiveTransformClient(input.join("\n"), "/test.ts?server-route-module");
    expect(result?.code).toBe(
      [
        'import "example.css";',
        'export { action } from "/test.ts?server-route-module=implementation";',
        'export { loader } from "/test.ts?server-route-module=implementation";',
        'export { headers } from "/test.ts?server-route-module=implementation";\n',
      ].join("\n"),
    );
  });

  test("transforms server component exports", async () => {
    const input = [
      "'use route';",
      'import "example.css";',
      "export function ServerComponent() {}",
      "export function ServerLayout() {}",
      "export function ServerErrorBoundary() {}",
      "export function ServerHydrateFallback() {}",
    ];
    const result = await directiveTransformClient(input.join("\n"), "/test.ts?server-route-module");
    expect(result?.code).toBe(
      [
        'import "example.css";',
        'import * as React from "react";',
        'import { ServerComponent as ServerComponentWithoutCSS } from "/test.ts?server-route-module=implementation";',
        "export function ServerComponent(props) {",
        "\treturn React.createElement(React.Fragment, null, import.meta.viteRsc.loadCss(), React.createElement(ServerComponentWithoutCSS, props));",
        "}",
        'import { ServerLayout as ServerLayoutWithoutCSS } from "/test.ts?server-route-module=implementation";',
        "export function ServerLayout(props) {",
        "\treturn React.createElement(React.Fragment, null, import.meta.viteRsc.loadCss(), React.createElement(ServerLayoutWithoutCSS, props));",
        "}",
        'import { ServerErrorBoundary as ServerErrorBoundaryWithoutCSS } from "/test.ts?server-route-module=implementation";',
        "export function ServerErrorBoundary(props) {",
        "\treturn React.createElement(React.Fragment, null, import.meta.viteRsc.loadCss(), React.createElement(ServerErrorBoundaryWithoutCSS, props));",
        "}",
        'import { ServerHydrateFallback as ServerHydrateFallbackWithoutCSS } from "/test.ts?server-route-module=implementation";',
        "export function ServerHydrateFallback(props) {",
        "\treturn React.createElement(React.Fragment, null, import.meta.viteRsc.loadCss(), React.createElement(ServerHydrateFallbackWithoutCSS, props));",
        "}\n",
      ].join("\n"),
    );
  });
});

describe("client route module", () => {
  test("transforms default function export", async () => {
    const input = ["'use route';", "export default function Component() {}"];
    const result = await directiveTransformClient(input.join("\n"), "/test.ts?client-route-module");
    expect(result?.code).toBe(
      [
        '"use client";',
        'import * as __rr_React from "react";',
        'export default __rr_React.lazy(() => import("/test.ts?client-route-module=default"));\n',
      ].join("\n"),
    );
  });

  test("transforms default arrow export", async () => {
    const input = ["'use route';", "export default () => {}"];
    const result = await directiveTransformClient(input.join("\n"), "/test.ts?client-route-module");
    expect(result?.code).toBe(
      [
        '"use client";',
        'import * as __rr_React from "react";',
        'export default __rr_React.lazy(() => import("/test.ts?client-route-module=default"));\n',
      ].join("\n"),
    );
  });

  test("transforms default re-export", async () => {
    const input = ["'use route';", "export { default } from './Component';"];
    const result = await directiveTransformClient(input.join("\n"), "/test.ts?client-route-module");
    expect(result?.code).toBe(
      [
        '"use client";',
        'import * as __rr_React from "react";',
        'export default __rr_React.lazy(() => import("/test.ts?client-route-module=default"));\n',
      ].join("\n"),
    );
  });

  test("transforms default re-export as", async () => {
    const input = ["'use route';", "export { Component as default } from './Layout';"];
    const result = await directiveTransformClient(input.join("\n"), "/test.ts?client-route-module");
    expect(result?.code).toBe(
      [
        '"use client";',
        'import * as __rr_React from "react";',
        'export default __rr_React.lazy(() => import("/test.ts?client-route-module=default"));\n',
      ].join("\n"),
    );
  });

  test("transforms client component exports", async () => {
    const input = [
      "'use route';",
      "export default function Component() {}",
      "export function Layout() {}",
      "export function ErrorBoundary() {}",
    ];
    const result = await directiveTransformClient(input.join("\n"), "/test.ts?client-route-module");
    expect(result?.code).toBe(
      [
        '"use client";',
        'import * as __rr_React from "react";',
        'export default __rr_React.lazy(() => import("/test.ts?client-route-module=default"));',
        'export const Layout = __rr_React.lazy(() => import("/test.ts?client-route-module=Layout"));',
        'export const ErrorBoundary = __rr_React.lazy(() => import("/test.ts?client-route-module=ErrorBoundary"));\n',
      ].join("\n"),
    );
  });

  test("keeps handle and shared exports", async () => {
    const input = [
      "'use route';",
      'import v from "./mod";',
      "const t = v;",
      "export const handle = { foo: 'bar' };",
      "export function meta() { return t; }",
      "export function links() { return t; }",
    ];
    const result = await directiveTransformClient(input.join("\n"), "/test.ts?client-route-module");
    expect(result?.code).toBe(
      [
        '"use client";',
        'export { handle } from "/test.ts?client-route-module=handle";',
        'export { meta } from "/test.ts?shared-route-module=";',
        'export { links } from "/test.ts?shared-route-module=";\n',
      ].join("\n"),
    );
  });

  test("transforms client function exports", async () => {
    const input = [
      "'use route';",
      'import v from "./mod";',
      "const t = v;",
      "export function clientAction() { return t; }",
      "export function clientLoader() { return t; }",
    ];
    const result = await directiveTransformClient(input.join("\n"), "/test.ts?client-route-module");
    expect(result?.code).toBe(
      [
        '"use client";',
        'export const clientAction = (...args) => import("/test.ts?client-route-module=clientAction").then((mod) => mod.clientAction(...args));',
        'export const clientLoader = (...args) => import("/test.ts?client-route-module=clientLoader").then((mod) => mod.clientLoader(...args));\n',
      ].join("\n"),
    );
  });

  test("builds mixed exports", async () => {
    const input = [
      "'use route';",
      "export function meta() {}",
      "export function clientAction() {}",
      "export function loader() {}",
      "export function ServerComponent() {}",
      "export function Layout() {}",
    ];
    const result = await directiveTransformClient(input.join("\n"), "/test.ts?client-route-module");
    expect(result?.code).toBe(
      [
        '"use client";',
        'import * as __rr_React from "react";',
        'export { meta } from "/test.ts?shared-route-module=";',
        'export const clientAction = (...args) => import("/test.ts?client-route-module=clientAction").then((mod) => mod.clientAction(...args));',
        'export const Layout = __rr_React.lazy(() => import("/test.ts?client-route-module=Layout"));\n',
      ].join("\n"),
    );
  });
});

describe("client route module chunk", () => {
  test("exports original implementation for client exports", async () => {
    const input = [
      "'use route';",
      'import "example.css";',
      'import discard from "./discard";',
      'import keep from "./keep";',
      "export function clientAction() { return keep; }",
      "export function clientLoader() { return discard; }",
    ];
    const result = await directiveTransformClient(
      input.join("\n"),
      "/test.ts?client-route-module=clientAction",
    );
    expect(result?.code).toBe(
      [
        'import "example.css";\n\n',
        'import keep from "./keep";',
        "export function clientAction() {\n\treturn keep;\n}\n",
      ].join("\n"),
    );
  });
});

describe("server route module chunk", () => {
  test("exports original implementation for server exports", async () => {
    const input = [
      "'use route';",
      'import "example.css";',
      'import discard from "./discard";',
      'import keep from "./keep";',
      "export function loader() { return keep; }",
      "export default function Component() { return discard; }",
    ];
    const result = await directiveTransformClient(
      input.join("\n"),
      "/test.ts?server-route-module=implementation",
    );
    expect(result?.code).toBe(
      [
        'import "example.css";\n\n',
        'import keep from "./keep";',
        "export function loader() {\n\treturn keep;\n}\n",
      ].join("\n"),
    );
  });
});
