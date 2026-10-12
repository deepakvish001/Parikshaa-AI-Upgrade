# Parikshaa's languages in Judge0 (G3). The API matches them by name
# (packages/runner/src/judge0.ts, NAMES), so a name must keep its form,
# "Language (version)"; the ids are ours and mean nothing to the API.
# The commands match the in-house runner's (packages/runner/src/languages.ts).
@languages ||= []
@languages +=
[
  {
    id: 1001,
    name: "Python (3.12.7)",
    is_archived: false,
    source_file: "script.py",
    run_cmd: "/usr/local/python-3.12.7/bin/python3 -I -B script.py"
  },
  {
    id: 1002,
    name: "JavaScript (Node.js 20.18.0)",
    is_archived: false,
    source_file: "script.js",
    run_cmd: "/usr/local/node-20.18.0/bin/node script.js"
  },
  {
    id: 1003,
    name: "C (GCC 13.3.0)",
    is_archived: false,
    source_file: "main.c",
    compile_cmd: "/usr/local/gcc-13.3.0/bin/gcc -O2 -std=c17 %s main.c -lm",
    run_cmd: "./a.out"
  },
  {
    id: 1004,
    name: "C++ (GCC 13.3.0)",
    is_archived: false,
    source_file: "main.cpp",
    compile_cmd: "/usr/local/gcc-13.3.0/bin/g++ -O2 -std=c++17 %s main.cpp",
    run_cmd: "LD_LIBRARY_PATH=/usr/local/gcc-13.3.0/lib64 ./a.out"
  },
  {
    id: 1005,
    name: "Java (JDK 21.0.5)",
    is_archived: false,
    source_file: "Main.java",
    compile_cmd: "/usr/local/java-21/bin/javac -J-Xmx512m -encoding UTF-8 %s Main.java",
    run_cmd: "/usr/local/java-21/bin/java -Xss64m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxRAMPercentage=75 -cp . Main"
  }
]
