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
