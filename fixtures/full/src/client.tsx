import { startTransition, StrictMode } from "react";
import { createRoot, hydrateRoot, type ReactFormState } from "react-dom/client";
import {
  createFromFetch,
  createFromReadableStream,
  createTemporaryReferenceSet,
  encodeReply,
  setServerCallback,
} from "@vitejs/plugin-rsc/browser";
import {
  unstable_createCallServer as createCallServer,
  unstable_getRSCStream as getRSCStream,
  unstable_RSCHydratedRouter as RSCHydratedRouter,
  type unstable_RSCPayload as RSCPayload,
} from "react-router/dom";

declare const SINGLE_PAGE_APP: boolean;

setServerCallback(
  createCallServer({
    createFromReadableStream,
    createTemporaryReferenceSet,
    encodeReply,
  }),
);

function getPayload() {
  if (!self.__FLIGHT_DATA) {
    const url = new URL(window.location.href);
    if (url.pathname === "/") {
      url.pathname = "/_.rsc";
    } else {
      url.pathname += ".rsc";
    }
    return {
      prerendered: false,
      payload: createFromFetch<RSCPayload>(
        fetch(url.href, {
          headers: {
            Accept: "text/x-component",
          },
        }),
      ),
    };
  }

  return {
    prerendered: true,
    payload: createFromReadableStream<RSCPayload>(getRSCStream()),
  };
}

const { prerendered, payload } = getPayload();
Promise.resolve(payload).then(
  (payload) => {
    console.log({ prerendered });
    startTransition(async () => {
      if (SINGLE_PAGE_APP) {
        createRoot(document.body).render(
          <StrictMode>
            <RSCHydratedRouter
              createFromReadableStream={createFromReadableStream}
              payload={payload}
            />
          </StrictMode>,
        );
        return;
      }

      const formState =
        payload.type === "render" ? ((await payload.formState) as ReactFormState) : undefined;

      hydrateRoot(
        document,
        <StrictMode>
          <RSCHydratedRouter
            createFromReadableStream={createFromReadableStream}
            payload={payload}
          />
        </StrictMode>,
        {
          formState,
        },
      );
    });
  },
  (error) => {
    console.error("Error hydrating application:", error);
  },
);
