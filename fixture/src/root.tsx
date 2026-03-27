import { Link, Outlet, useMatch, useMatches, useNavigation, useRouteError } from "react-router";

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
      <body>{children}</body>
    </html>
  );
}

export function Layout({ children }: { children?: React.ReactNode }) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const handle = useMatches().find((match) => match.id === "root")?.handle as
    | undefined
    | { posts: string[] };

  return (
    <Shell>
      <nav>
        <Link to="/">Home</Link> | <Link to="/about">About</Link> |{" "}
        {handle?.posts.map((id) => (
          <span key={id}>
            <Link to={`/post/${id}`}>{id}</Link> |{" "}
          </span>
        ))}
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
