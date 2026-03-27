import { describe, expect, test } from "vite-plus/test";

import { frameworkRoute } from "../src/route.ts";

const FakeComponent = () => null;
const FakeLayout = () => null;
const FakeErrorBoundary = () => null;
const FakeHydrateFallback = () => null;

describe("frameworkRoute", () => {
  test("returns an async function", () => {
    const result = frameworkRoute(async () => ({}));
    expect(typeof result).toBe("function");
  });

  test("resolves Component from default export", async () => {
    const route = frameworkRoute(async () => ({ default: FakeComponent }));
    const resolved = await route();
    expect(resolved.Component).toBe(FakeComponent);
  });

  test("resolves Component from ServerComponent export", async () => {
    const route = frameworkRoute(async () => ({ ServerComponent: FakeComponent }));
    const resolved = await route();
    expect(resolved.Component).toBe(FakeComponent);
  });

  test("throws when both default and ServerComponent are exported", async () => {
    const route = frameworkRoute(async () => ({
      default: FakeComponent,
      ServerComponent: FakeComponent,
    }));
    await expect(route()).rejects.toThrow(
      "Module cannot have both a default export and a ServerComponent export",
    );
  });

  test("resolves Layout from Layout export", async () => {
    const route = frameworkRoute(async () => ({ Layout: FakeLayout }));
    const resolved = await route();
    expect(resolved.Layout).toBe(FakeLayout);
  });

  test("resolves Layout from ServerLayout export", async () => {
    const route = frameworkRoute(async () => ({ ServerLayout: FakeLayout }));
    const resolved = await route();
    expect(resolved.Layout).toBe(FakeLayout);
  });

  test("throws when both Layout and ServerLayout are exported", async () => {
    const route = frameworkRoute(async () => ({
      Layout: FakeLayout,
      ServerLayout: FakeLayout,
    }));
    await expect(route()).rejects.toThrow(
      "Module cannot have both a Layout export and a ServerLayout export",
    );
  });

  test("resolves ErrorBoundary from ErrorBoundary export", async () => {
    const route = frameworkRoute(async () => ({ ErrorBoundary: FakeErrorBoundary }));
    const resolved = await route();
    expect(resolved.ErrorBoundary).toBe(FakeErrorBoundary);
  });

  test("resolves ErrorBoundary from ServerErrorBoundary export", async () => {
    const route = frameworkRoute(async () => ({ ServerErrorBoundary: FakeErrorBoundary }));
    const resolved = await route();
    expect(resolved.ErrorBoundary).toBe(FakeErrorBoundary);
  });

  test("throws when both ErrorBoundary and ServerErrorBoundary are exported", async () => {
    const route = frameworkRoute(async () => ({
      ErrorBoundary: FakeErrorBoundary,
      ServerErrorBoundary: FakeErrorBoundary,
    }));
    await expect(route()).rejects.toThrow(
      "Module cannot have both an ErrorBoundary export and a ServerErrorBoundary export",
    );
  });

  test("resolves HydrateFallback from HydrateFallback export", async () => {
    const route = frameworkRoute(async () => ({ HydrateFallback: FakeHydrateFallback }));
    const resolved = await route();
    expect(resolved.HydrateFallback).toBe(FakeHydrateFallback);
  });

  test("resolves HydrateFallback from ServerHydrateFallback export", async () => {
    const route = frameworkRoute(async () => ({ ServerHydrateFallback: FakeHydrateFallback }));
    const resolved = await route();
    expect(resolved.HydrateFallback).toBe(FakeHydrateFallback);
  });

  test("throws when both HydrateFallback and ServerHydrateFallback are exported", async () => {
    const route = frameworkRoute(async () => ({
      HydrateFallback: FakeHydrateFallback,
      ServerHydrateFallback: FakeHydrateFallback,
    }));
    await expect(route()).rejects.toThrow(
      "Module cannot have both a HydrateFallback export and a ServerHydrateFallback export",
    );
  });

  test("passes through loader, action, and other route exports", async () => {
    const loader = async () => ({ data: true });
    const action = async () => new Response();
    const clientLoader = async () => ({ data: true });
    const clientAction = async () => new Response();
    const handle = { scrollRestoration: true };
    const shouldRevalidate = () => true;

    const route = frameworkRoute(async () => ({
      loader,
      action,
      clientLoader,
      clientAction,
      handle,
      shouldRevalidate,
    }));

    const resolved = await route();
    expect(resolved.loader).toBe(loader);
    expect(resolved.action).toBe(action);
    expect(resolved.clientLoader).toBe(clientLoader);
    expect(resolved.clientAction).toBe(clientAction);
    expect(resolved.handle).toBe(handle);
    expect(resolved.shouldRevalidate).toBe(shouldRevalidate);
  });

  test("passes through middleware and clientMiddleware", async () => {
    const middleware = [async () => {}] as any;
    const clientMiddleware = [async () => {}] as any;

    const route = frameworkRoute(async () => ({ middleware, clientMiddleware }));
    const resolved = await route();
    expect(resolved.middleware).toBe(middleware);
    expect(resolved.clientMiddleware).toBe(clientMiddleware);
  });

  test("passes through headers, links, and meta", async () => {
    const headers = () => new Headers();
    const links = () => [];
    const meta = () => [];

    const route = frameworkRoute(async () => ({ headers, links, meta }));
    const resolved = await route();
    expect(resolved.headers).toBe(headers);
    expect(resolved.links).toBe(links);
    expect(resolved.meta).toBe(meta);
  });

  test("returns undefined for absent optional exports", async () => {
    const route = frameworkRoute(async () => ({}));
    const resolved = await route();
    expect(resolved.Component).toBeUndefined();
    expect(resolved.Layout).toBeUndefined();
    expect(resolved.ErrorBoundary).toBeUndefined();
    expect(resolved.HydrateFallback).toBeUndefined();
    expect(resolved.loader).toBeUndefined();
    expect(resolved.action).toBeUndefined();
  });

  test("default export takes precedence over ServerComponent when default is present", async () => {
    const Default = () => null;
    const Server = () => null;
    await expect(
      frameworkRoute(async () => ({ default: Default, ServerComponent: Server }))(),
    ).rejects.toThrow();
  });
});
