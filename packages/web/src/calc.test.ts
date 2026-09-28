import { describe, expect, it } from "vitest";
import { display, evaluate } from "./calc.ts";

/** ROADMAP Phase 1: the on-screen calculator, whose answers a candidate trusts. */

describe("the calculator", () => {
  it("follows the order of operations", () => {
    expect(evaluate("2+3×4")).toBe(14);
    expect(evaluate("(2+3)×4")).toBe(20);
    expect(evaluate("2^3^2")).toBe(512);
    expect(evaluate("−2^2")).toBe(-4);
    expect(evaluate("10÷4")).toBe(2.5);
  });

  it("reads what the keys type: functions, constants, implicit multiplication, percent and factorial", () => {
    expect(display(evaluate("sin(30)"))).toBe("0.5");
    expect(display(evaluate("sin(180)"))).toBe("0");
    expect(display(evaluate("cos(π)", "rad"))).toBe("-1");
    expect(evaluate("√(81)")).toBe(9);
    expect(evaluate("log(1000)")).toBe(3);
    expect(display(evaluate("2π"))).toBe("6.28318530718");
    expect(evaluate("3(4+1)")).toBe(15);
    expect(evaluate("5!")).toBe(120);
    expect(evaluate("50%×200")).toBe(100);
    expect(evaluate("Ans×2", "deg", 21)).toBe(42);
  });

  it("forgives a bracket left open at the end, as a hand calculator does", () => {
    expect(evaluate("√(16")).toBe(4);
    expect(evaluate("2×(3+4")).toBe(14);
  });

  it("refuses what has no value", () => {
    expect(() => evaluate("1÷0")).toThrow();
    expect(() => evaluate("2+")).toThrow();
    expect(() => evaluate("(−1)!")).toThrow();
    expect(() => evaluate("alert(1)")).toThrow();
  });

  it("shows results without float dust", () => {
    expect(display(0.1 + 0.2)).toBe("0.3");
    expect(display(1e15)).toBe("1e+15");
  });
});
