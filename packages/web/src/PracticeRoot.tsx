import { Suspense, lazy } from "react";

/**
 * A practice site (ROADMAP §15) lives at /practice/<site>. It is loaded only
 * there: a candidate sitting an exam never downloads it. With the flag
 * `learn_v2` on (learn/flag.ts) the site shows Learn v2's shell instead, from
 * a chunk of its own with its own styles, so neither the exam pages nor
 * today's practice pages carry any of it.
 */
const PracticeApp = lazy(() => import("./practice/PracticeApp.tsx").then((m) => ({ default: m.PracticeApp })));
const LearnApp = lazy(() => import("./learn/LearnApp.tsx").then((m) => ({ default: m.LearnApp })));

export function PracticeRoot({ site, learnV2 }: { readonly site: string; readonly learnV2: boolean }) {
  return <Suspense fallback={null}>{learnV2 ? <LearnApp site={site} /> : <PracticeApp site={site} />}</Suspense>;
}
