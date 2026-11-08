import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "");
if (apiBaseUrl) {
  const apiOrigin = new URL(apiBaseUrl);
  if (apiOrigin.protocol !== "https:" && apiOrigin.protocol !== "http:") {
    throw new Error("VITE_API_BASE_URL must use HTTP or HTTPS.");
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const requestUrl = input instanceof Request ? input.url : input.toString();
    const resolvedUrl = new URL(requestUrl, window.location.origin);
    if (
      resolvedUrl.origin !== window.location.origin ||
      !resolvedUrl.pathname.startsWith("/api/")
    ) {
      return nativeFetch(input, init);
    }

    const targetUrl = new URL(
      `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`,
      apiBaseUrl,
    );
    const apiRequest =
      input instanceof Request
        ? new Request(targetUrl, input)
        : new Request(targetUrl, init);
    return nativeFetch(new Request(apiRequest, { credentials: "include" }));
  };
}

createRoot(document.getElementById("root")!).render(<App />);
