import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-registers cleanup when vitest runs with globals on.
// This suite does not, so it is registered explicitly — without it, each test
// renders on top of the previous one's DOM and queries match stale elements.
afterEach(cleanup);

// jsdom does no layout, so Range has no geometry. CodeMirror measures text to
// place its cursor; an empty measurement is enough for it to run in tests.
if (typeof Range.prototype.getClientRects !== "function") {
  Range.prototype.getClientRects = function getClientRects() {
    return Object.assign([], { item: () => null }) as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return new DOMRect(0, 0, 0, 0);
  };
}
