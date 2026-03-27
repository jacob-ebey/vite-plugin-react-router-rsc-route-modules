"use route";

import { Link, Outlet, useRouteError } from "react-router";

export function Layout({ children }: { children?: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Vite React Router RSC Route Modules Fixture</title>
      </head>
      <body>
        <nav>
          <Link to="/">Home</Link> | <Link to="/about">About</Link>
        </nav>
        {children}
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
  return <h1>Something went wrong</h1>;
}
