"use client";

import { Link, useMatches, useNavigation } from "react-router";

export function NavLinks() {
  const handle = useMatches().find((match) => match.id === "root")?.handle as
    | undefined
    | { posts: string[] };

  return (
    handle?.posts.map((id) => (
      <span key={id}>
        <Link to={`/post/${id}`}>{id}</Link> |{" "}
      </span>
    )) || null
  );
}

export function NavStatus() {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return <footer>{busy ? "Busy.." : "Ready"}</footer>;
}
