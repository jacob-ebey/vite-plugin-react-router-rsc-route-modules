import { Outlet } from "react-router";

export default function Post() {
  return (
    <div>
      <Outlet />
      <footer>post layout</footer>
    </div>
  );
}
