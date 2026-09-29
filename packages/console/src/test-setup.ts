import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-registers cleanup when vitest runs with globals on.
// This suite does not, so it is registered explicitly — without it, each test
// renders on top of the previous one's DOM and queries match stale elements.
afterEach(cleanup);

// jsdom lacks Blob#text, which every browser the console supports has.
if (typeof Blob.prototype.text !== "function") {
  Blob.prototype.text = function text(this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// jsdom lacks object URLs' revocation; photos revoke theirs when they leave the page.
if (typeof URL.revokeObjectURL !== "function") URL.revokeObjectURL = () => undefined;
