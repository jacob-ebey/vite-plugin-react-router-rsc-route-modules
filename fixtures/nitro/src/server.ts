import {
  createTemporaryReferenceSet,
  decodeAction,
  decodeFormState,
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from "@vitejs/plugin-rsc/rsc";
import {
  RouterContextProvider,
  unstable_matchRSCServerRequest as matchRSCServerRequest,
} from "react-router";

import { routes } from "./routes.ts";

export function fetchServer(request: Request) {
  return matchRSCServerRequest({
    basename: "/",
    // Provide the React Server touchpoints.
    createTemporaryReferenceSet,
    decodeAction,
    decodeFormState,
    decodeReply,
    loadServerAction,
    // The incoming request.
    request,
    // The app routes.
    routes,
    // Encode the match with the React Server implementation.
    generateResponse(match, options) {
      return new Response(renderToReadableStream(match.payload, options), {
        status: match.statusCode,
        headers: match.headers,
      });
    },
  });
}

export default {
  async fetch(request: Request, requestContext?: RouterContextProvider) {
    if (requestContext && !(requestContext instanceof RouterContextProvider)) {
      requestContext = undefined;
    }

    const rscResponse = await fetchServer(request);

    const ssr = await import.meta.viteRsc.loadModule<typeof import("./ssr.tsx")>("ssr", "index");

    return await ssr.generateHTML(request, rscResponse);
  },
};

if (import.meta.hot) {
  import.meta.hot.accept();
}
