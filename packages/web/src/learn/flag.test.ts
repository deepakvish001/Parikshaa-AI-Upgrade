import { describe, expect, it } from "vitest";
import { LEARN_V2_KEY, learnV2On, type FlagStore } from "./flag.ts";

/** A device's storage, in memory. */
function store(initial: Record<string, string> = {}): FlagStore & { readonly data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
}

const refusing: FlagStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("the learn_v2 flag", () => {
  it("is off unless something turns it on", () => {
    expect(learnV2On("", undefined, store())).toBe(false);
    expect(learnV2On("?verify=abc", undefined, store())).toBe(false);
    expect(learnV2On("", "off", store())).toBe(false);
    expect(learnV2On("", "", null)).toBe(false);
  });

  it("turns on from the address, and the device keeps it on for the next page", () => {
    const device = store();
    expect(learnV2On("?learn_v2=1", undefined, device)).toBe(true);
    expect(device.data[LEARN_V2_KEY]).toBe("1");
    expect(learnV2On("", undefined, device)).toBe(true);
  });

  it("turns off from the address, even where the build turned it on", () => {
    const device = store({ [LEARN_V2_KEY]: "1" });
    expect(learnV2On("?learn_v2=0", "on", device)).toBe(false);
    expect(device.data[LEARN_V2_KEY]).toBe("0");
    expect(learnV2On("", "on", device)).toBe(false);
  });

  it("follows the build's default where this device chose nothing", () => {
    expect(learnV2On("", "on", store())).toBe(true);
    expect(learnV2On("?learn_v2=yes", "on", store())).toBe(true);
    expect(learnV2On("?learn_v2=yes", undefined, store())).toBe(false);
  });

  it("still answers where storage is refused (private mode): for this page only", () => {
    expect(learnV2On("?learn_v2=1", undefined, refusing)).toBe(true);
    expect(learnV2On("", undefined, refusing)).toBe(false);
    expect(learnV2On("", "on", refusing)).toBe(true);
  });
});
