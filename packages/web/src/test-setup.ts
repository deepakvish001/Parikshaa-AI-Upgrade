import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-registers cleanup when vitest runs with globals on.
// This suite does not, so it is registered explicitly — without it, each test
// renders on top of the previous one's DOM and queries match stale elements.
afterEach(cleanup);
