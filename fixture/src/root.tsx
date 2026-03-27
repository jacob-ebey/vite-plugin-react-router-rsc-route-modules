import { Link, Outlet, useNavigation, useRouteError } from "react-router";

declare const SINGLE_PAGE_APP: boolean;

function Shell({ children }: { children?: React.ReactNode }) {
  return SINGLE_PAGE_APP ? (
    <>{children}</>
  ) : (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body></body>
    </html>
  );
}

export function Layout({ children }: { children?: React.ReactNode }) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <Shell>
      <nav>
        <Link to="/">Home</Link> | <Link to="/about">About</Link>
      </nav>
      {children}
      <footer>{busy ? "Busy.." : "Ready."}</footer>
    </Shell>
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
