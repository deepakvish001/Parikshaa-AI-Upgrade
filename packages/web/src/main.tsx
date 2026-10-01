import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.tsx";
import "./styles.css";

/**
 * A practice site (ROADMAP §15) lives at /practice/<site>. It is loaded only
 * there: a candidate sitting an exam never downloads it.
 */
const PracticeApp = lazy(() => import("./practice/PracticeApp.tsx").then((m) => ({ default: m.PracticeApp })));
const practiceSite = /^\/practice\/([a-z0-9][a-z0-9-]*)(?:\/|$)/.exec(window.location.pathname)?.[1] ?? null;

// A practice site installs as an app of its own (Prep §17): its manifest, and
// in a production build the service worker that keeps the day offline and
// shows the daily reminder. An exam page registers neither.
if (practiceSite !== null) {
  const head = (tag: string, attributes: Record<string, string>) => document.head.append(Object.assign(document.createElement(tag), attributes));
  head("link", { rel: "manifest", href: `/api/practice/${practiceSite}/manifest.webmanifest` });
  head("link", { rel: "apple-touch-icon", href: "/icons/icon-192.png" });
  head("meta", { name: "theme-color", content: "#4338ca" });
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js", { scope: `/practice/${practiceSite}/` }).catch(() => undefined);
  }
}

const root = document.getElementById("root");
if (root === null) throw new Error("No #root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {practiceSite === null ? (
        <App />
      ) : (
        <Suspense fallback={null}>
          <PracticeApp site={practiceSite} />
        </Suspense>
      )}
    </QueryClientProvider>
  </StrictMode>,
);
