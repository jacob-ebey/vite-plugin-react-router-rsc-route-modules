import * as index from "./route-index.ts";

export const routes = {
  index,
};

for (const route of Object.keys(routes)) {
  for (const key of Object.keys(routes[route as keyof typeof routes])) {
    const value = (routes[route as keyof typeof routes] as any)[key];
    try {
      value();
      console.log(route, key, "server runtime");
    } catch (error) {
      if ((error as Error).message.includes("Unexpectedly client reference export")) {
        console.log(route, key, "client reference");
      } else {
        console.error(route, key, error);
      }
    }
  }
}
