import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "@parikshaa/brand/markdown";

const html = (source: string) => render(<Markdown source={source} />).container.innerHTML;

describe("statement Markdown", () => {
  it("renders what problem statements use", () => {
    const out = html(
      [
        "Given an array `nums`, return **two** indices.",
        "",
        "### Constraints",
        "- `2 <= nums.length <= 10^4`",
        "- `-10^9 <= nums[i] <= 10^9`",
        "",
        "```",
        "for i in range(n): pass",
        "```",
      ].join("\n"),
    );
    expect(out).toContain("<code>nums</code>");
    expect(out).toContain("<strong>two</strong>");
    expect(out).toContain("<h5>Constraints</h5>");
    // A power inside code is still a power: that is how constraints are written.
    expect(out).toContain("<li><code>2 &lt;= nums.length &lt;= 10<sup>4</sup></code></li>");
    expect(out).toContain("<code>-10<sup>9</sup> &lt;= nums[i] &lt;= 10<sup>9</sup></code>");
    expect(out).toContain('<pre class="md-code"><code>for i in range(n): pass</code></pre>');
  });

  it("writes powers outside code as superscripts", () => {
    expect(html("At most 10^5 items, each below 2^31.")).toContain("10<sup>5</sup> items, each below 2<sup>31</sup>");
    expect(html("Answers within 10^(-6).")).toContain("10<sup>-6</sup>");
  });

  it("never lets a statement carry HTML or script", () => {
    const out = html('<img src=x onerror="alert(1)"> and [click](javascript:alert(1)) and <script>alert(2)</script>');
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<script");
    expect(out).not.toContain('href="javascript');
    expect(out).toContain("&lt;img");
  });

  it("links only to web addresses, in a new tab", () => {
    expect(html("See [the docs](https://example.com/a).")).toContain(
      '<a href="https://example.com/a" target="_blank" rel="noopener noreferrer">the docs</a>',
    );
  });
});
