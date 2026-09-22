import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { execute, normalise, type RunRequest, type SandboxOptions } from "./execute.js";

/**
 * These run real compilers and real hostile programs. The isolation cases need
 * root, to drop to a slot uid and enter fresh namespaces; CI runs this suite
 * under sudo for that reason. Without root they are reported as skipped, never
 * silently passed.
 */

const isRoot = process.getuid?.() === 0;
let options: SandboxOptions;

beforeAll(async () => {
  options = { workRoot: await mkdtemp(join(tmpdir(), "runner-test-")), slot: isRoot ? { uid: 61001, gid: 61001 } : null };
});

const sumTests = [
  { id: "t1", input: "2 3\n", expected: "5\n" },
  { id: "t2", input: "10 -4\n", expected: "6" },
];

const run = (language: RunRequest["language"], source: string, tests = sumTests, limits?: RunRequest["limits"]) =>
  execute({ language, source, tests, ...(limits === undefined ? {} : { limits }) }, options);

const statuses = (result: Awaited<ReturnType<typeof run>>) =>
  result.compiled ? result.tests.map((t) => t.status) : ["compile_error"];

describe("every language", () => {
  const solutions: Record<RunRequest["language"], string> = {
    python: "a, b = map(int, input().split())\nprint(a + b)\n",
    javascript: "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n",
    c: '#include <stdio.h>\nint main(void){long a,b;scanf("%ld %ld",&a,&b);printf("%ld\\n",a+b);return 0;}\n',
    cpp: "#include <iostream>\nint main(){long a,b;std::cin>>a>>b;std::cout<<a+b<<\"\\n\";}\n",
    java: "import java.util.*;\npublic class Main{public static void main(String[] x){Scanner s=new Scanner(System.in);System.out.println(s.nextLong()+s.nextLong());}}\n",
  };

  for (const [language, source] of Object.entries(solutions)) {
    it(`builds and runs ${language}`, async () => {
      expect(statuses(await run(language as RunRequest["language"], source))).toEqual(["passed", "passed"]);
    }, 30_000);
  }
});

describe("judging", () => {
  it("tells a wrong answer from a right one", async () => {
    expect(statuses(await run("python", "print(0)"))).toEqual(["wrong_answer", "wrong_answer"]);
  });

  it("forgives line endings and trailing space, not content", () => {
    expect(normalise("5 \r\n6\n\n")).toBe(normalise("5\n6"));
    expect(normalise("5 6")).not.toBe(normalise("56"));
  });

  it("reports a compile error with the compiler's own words", async () => {
    const result = await run("cpp", "int main( { return 0; }");
    expect(result.compiled).toBe(false);
    if (!result.compiled) expect(result.compileOutput).toMatch(/error/);
  }, 30_000);

  it("reports a crash as a runtime error, with its stderr", async () => {
    const result = await run("python", "raise ValueError('boom')", [{ id: "t", input: "", expected: "" }]);
    expect(statuses(result)).toEqual(["runtime_error"]);
    if (result.compiled) expect(result.tests[0]?.stderr).toMatch(/boom/);
  });
});

describe("hostile code", () => {
  const one = [{ id: "t", input: "", expected: "" }];

  it("stops an infinite loop at the time limit", async () => {
    const result = await run("python", "while True: pass", one, { timeMs: 500 });
    expect(statuses(result)).toEqual(["time_limit"]);
    if (result.compiled) expect(result.tests[0]!.timeMs).toBeLessThan(3000);
  });

  it("stops a program that floods its output", async () => {
    expect(statuses(await run("python", "while True: print('x' * 1000)", one, { timeMs: 5000 }))).toEqual(["output_limit"]);
  });

  it("refuses memory past the limit", async () => {
    const result = await run("python", "x = bytearray(512 * 1024 * 1024)\nprint('allocated')", one, { memoryMb: 64 });
    expect(statuses(result)).toEqual(["runtime_error"]);
    if (result.compiled) expect(result.tests[0]!.stdout).not.toMatch(/allocated/);
  });

  it("keeps nothing of the runner's environment", async () => {
    process.env["RUNNER_TOKEN"] = "secret-token";
    const result = await run("python", "import os\nprint(sorted(os.environ))", one);
    delete process.env["RUNNER_TOKEN"];
    if (!result.compiled) throw new Error("expected to run");
    expect(result.tests[0]!.stdout).not.toMatch(/RUNNER_TOKEN|secret-token/);
    expect(result.tests[0]!.stdout.trim()).toBe("['HOME', 'LANG', 'PATH', 'TMPDIR']");
  });

  it.skipIf(!isRoot)("runs as an unprivileged uid, not as root", async () => {
    const result = await run("python", "import os\nprint(os.getuid(), os.getgid(), os.getgroups())", one);
    if (!result.compiled) throw new Error("expected to run");
    expect(result.tests[0]!.stdout.trim()).toBe("61001 61001 []");
  });

  it.skipIf(!isRoot)("has no network", async () => {
    const source = [
      "import socket",
      "s = socket.socket(); s.settimeout(2)",
      "print(s.connect_ex(('1.1.1.1', 80)))",
      "try:",
      "    socket.getaddrinfo('example.com', 80); print('resolved')",
      "except OSError: print('no dns')",
    ].join("\n");
    const result = await run("python", source, one);
    if (!result.compiled) throw new Error("expected to run");
    const [code, dns] = result.tests[0]!.stdout.trim().split("\n");
    expect(Number(code)).not.toBe(0);
    expect(dns).toBe("no dns");
  });

  it.skipIf(!isRoot)("contains a fork bomb, and leaves no process behind", async () => {
    const source = "import os\nwhile True:\n    try: os.fork()\n    except OSError: pass\n";
    const result = await run("python", source, one, { timeMs: 1500 });
    expect(["time_limit", "runtime_error"]).toContain(statuses(result)[0]);

    const { spawnSync } = await import("node:child_process");
    const left = spawnSync("pgrep", ["-u", "61001"]).stdout.toString().trim();
    expect(left).toBe("");
  }, 20_000);

  it.skipIf(!isRoot)("cannot read the runner's working files or other runs'", async () => {
    const source = [
      "import os",
      "for p in ['/proc/1/environ', '/root']:",
      "    try: open(p).read() if not os.path.isdir(p) else os.listdir(p); print('read', p)",
      "    except OSError: print('denied', p)",
    ].join("\n");
    const result = await run("python", source, one);
    if (!result.compiled) throw new Error("expected to run");
    expect(result.tests[0]!.stdout).not.toMatch(/^read/m);
  });
});
