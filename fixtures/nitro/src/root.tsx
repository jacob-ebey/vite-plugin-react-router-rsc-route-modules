"use route";

import { Link, Outlet, useRouteError } from "react-router";
import { NavLinks, NavStatus } from "./root.client.tsx";

export function ServerLayout({ children }: { children?: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <nav>
          <Link to="/">Home</Link> | <Link to="/about">About</Link> | <NavLinks />
        </nav>
        {children}
        <NavStatus />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);
  return (
    <>
      <title>Oh no!</title>
      <h1>Something went wrong</h1>
    </>
  );
}

export function HydrateFallback() {
  return (
    <>
      <title>Loading...</title>
      <h1>Loading...</h1>
    </>
  );
}
