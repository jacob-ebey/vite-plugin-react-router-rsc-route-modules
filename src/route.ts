import type * as React from "react";
import type {
  ActionFunction,
  ClientActionFunction,
  ClientLoaderFunction,
  HeadersFunction,
  LinksFunction,
  LoaderFunction,
  MetaFunction,
  MiddlewareFunction,
  ShouldRevalidateFunction,
} from "react-router";

export type FrameworkModule = {
  default?: React.ComponentType<any>;
  ServerComponent?: React.ComponentType<any>;
  Layout?: React.ComponentType<any>;
  ServerLayout?: React.ComponentType<any>;
  ErrorBoundary?: React.ComponentType<any>;
  ServerErrorBoundary?: React.ComponentType<any>;
  HydrateFallback?: React.ComponentType<any>;
  ServerHydrateFallback?: React.ComponentType<any>;
  action?: ActionFunction;
  clientAction?: ClientActionFunction;
  clientLoader?: ClientLoaderFunction;
  clientMiddleware?: MiddlewareFunction[];
  handle?: any;
  headers?: HeadersFunction;
  links?: LinksFunction;
  loader?: LoaderFunction;
  meta?: MetaFunction;
  middleware?: MiddlewareFunction[];
  shouldRevalidate?: ShouldRevalidateFunction;
};

export function frameworkRoute(lazy: () => Promise<FrameworkModule>) {
  return async () => {
    const mod = await lazy();
    let Component: React.ComponentType<any> | undefined;
    let Layout: React.ComponentType<any> | undefined;
    let ErrorBoundary: React.ComponentType<any> | undefined;
    let HydrateFallback: React.ComponentType<any> | undefined;
    if ("default" in mod && mod.default) {
      if ("ServerComponent" in mod && mod.ServerComponent) {
        throw new Error("Module cannot have both a default export and a ServerComponent export");
      }
      Component = mod.default;
    } else if ("ServerComponent" in mod && mod.ServerComponent) {
      Component = mod.ServerComponent;
    }
    if ("Layout" in mod && mod.Layout) {
      if ("ServerLayout" in mod && mod.ServerLayout) {
        throw new Error("Module cannot have both a Layout export and a ServerLayout export");
      }
      Layout = mod.Layout;
    } else if ("ServerLayout" in mod && mod.ServerLayout) {
      Layout = mod.ServerLayout;
    }
    if ("ErrorBoundary" in mod && mod.ErrorBoundary) {
      if ("ServerErrorBoundary" in mod && mod.ServerErrorBoundary) {
        throw new Error(
          "Module cannot have both an ErrorBoundary export and a ServerErrorBoundary export",
        );
      }
      ErrorBoundary = mod.ErrorBoundary;
    } else if ("ServerErrorBoundary" in mod && mod.ServerErrorBoundary) {
      ErrorBoundary = mod.ServerErrorBoundary;
    }
    if ("HydrateFallback" in mod && mod.HydrateFallback) {
      if ("ServerHydrateFallback" in mod && mod.ServerHydrateFallback) {
        throw new Error(
          "Module cannot have both a HydrateFallback export and a ServerHydrateFallback export",
        );
      }
      HydrateFallback = mod.HydrateFallback;
    } else if ("ServerHydrateFallback" in mod && mod.ServerHydrateFallback) {
      HydrateFallback = mod.ServerHydrateFallback;
    }

    const {
      action,
      clientAction,
      clientLoader,
      clientMiddleware,
      handle,
      headers,
      links,
      loader,
      meta,
      middleware,
      shouldRevalidate,
    } = mod;

    return {
      Component,
      ErrorBoundary,
      HydrateFallback,
      Layout,
      action,
      clientAction,
      clientLoader,
      clientMiddleware,
      handle,
      headers,
      links,
      loader,
      meta,
      middleware,
      shouldRevalidate,
    };
  };
}
