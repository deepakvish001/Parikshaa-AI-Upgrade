# Judge0 for Parikshaa (G3)

Candidates' code can run on Judge0 instead of the in-house runner (`packages/runner`, gVisor). The plan is [F1-GO-LIVE-PLAN.md §5.1–5.3](../../docs/F1-GO-LIVE-PLAN.md).

Judge0 does one thing here: it runs a program on a given stdin within given limits. Parikshaa does the rest itself, exactly as the in-house runner does it, in `packages/runner/src/judge0.ts`:

- whether an output is right (`judge.ts`: exact, tokens, numbers, unordered, JSON);
- a question's own checker, run in Judge0 as a separate Python program;
- the result marker of a function question;
- what each failure is called (`time_limit`, `memory_limit`, `runtime_error`, `output_limit`).

So a verdict means the same on either backend, and the parity suite holds the two to that. Exams, practice, contests and classes do not change at all: the API picks the backend from its settings.

## The API's settings

| Setting | |
|---|---|
| `RUNNER_BACKEND=judge0` | Run code on Judge0. The default, `gvisor`, keeps the in-house runner. |
| `JUDGE0_URL` | Judge0 on its VM's private address, e.g. `http://10.0.2.15:2358`. |
| `JUDGE0_TOKEN` | The token `setup-judge0.sh` was given (`X-Auth-Token`). |
| `RUNNER_URL`, `RUNNER_TOKEN` | Keep these: when Judge0 cannot be reached, fails internally or is too slow, the API runs the code on the in-house runner instead, leaves Judge0 alone for 30 s, and logs "Judge0 unavailable". |
| `JUDGE0_TIMEOUT_MS` | How long one run may take on Judge0, queueing included, before it counts as unavailable. Default 120000. |

`scripts/setup-server.sh` keeps these in `/etc/parikshaa.env` like its other optional settings.

Languages are found by **name** in Judge0's `/languages` (for example "Python (3.12.7)"), read once, never by id. SQL runs as Python with the in-house runner's SQLite driver, so a test's tables and a query's rows mean the same on both.

## Security

Judge0 had three sandbox escapes before 1.13.1 (CVE-2024-28185, CVE-2024-28189, CVE-2024-29021). Hence:

- **Judge0 1.13.1 or later only**, in Parikshaa's own image (`compilers/Dockerfile`).
- **Its own VM.** Judge0 needs privileged containers, so it never runs beside the API, the database credentials or the model key. Nothing secret is on that VM except the token and Judge0's own queue passwords.
- **Nothing goes out** (`judge0.conf`): `ENABLE_NETWORK=false`, `ALLOW_ENABLE_NETWORK=false`, `ENABLE_CALLBACKS=false`; no extra files, command-line arguments or compiler options from a submission.
- **Only the API reaches it.** It listens on the VM's private address; the security group lets only the API VM's group reach port 2358; every request needs the token.
- **On AWS:** no public IP and no NAT once the image is pulled; the instance metadata service turned off (`http_endpoint = disabled`) so a program that escaped finds no credentials; SSH only through SSM.
- **Code does not stay.** An hourly purge deletes finished submissions from Judge0's own database. That database is Judge0's queue on the same VM, not Parikshaa's.

## Setting it up (owner, on staging first)

1. **Image.** Set the repository variable `PYTHON_SHA256` (the SHA-256 of `Python-3.12.7.tgz`, on python.org's release page), then run the **Judge0 image** workflow. It pushes `ghcr.io/deepakvish001/parikshaa-judge0:<commit>` and `:latest`. GCC is built from source: the first build takes about an hour. Make the package private and give the VM a read-only token, or make it public: it holds nothing secret.
2. **VM.** AWS Mumbai, `c7i.xlarge` (4 vCPU) for the pilot, Ubuntu 22.04, 30 GB, in the API's VPC, no public IP. Security group: in, port 2358 from the API VM's security group only; out, HTTPS until the image is pulled.
3. **Judge0.** Copy this folder to the VM, then:
   ```bash
   sudo JUDGE0_TOKEN="$(openssl rand -hex 32)" ./setup-judge0.sh
   ```
   (keep the token: the API needs the same one). On Ubuntu 22.04 the first run turns on cgroup v1 (`systemd.unified_cgroup_hierarchy=0`) and stops with exit 3: reboot, and run it again with the same token. It then starts Judge0, installs the purge and checks that `/languages` has Parikshaa's languages.
4. **API.** On the API VM, `RUNNER_BACKEND=judge0 JUDGE0_URL=http://<judge0 private IP>:2358 JUDGE0_TOKEN=<token>` in `/etc/parikshaa.env` (or through `setup-server.sh`), keeping `RUNNER_URL`, and restart.
5. **Parity.** From the API VM:
   ```bash
   RUNNER_URL=… RUNNER_TOKEN=… JUDGE0_URL=… JUDGE0_TOKEN=… npm run parity -w @parikshaa/api
   ```
   Every DSA and SQL reference, wrong programs (wrong answer, crash, never stops, eats memory), a compile error and each language's hello world, on both runners. Every case must come out the same (exit 0) before Judge0 takes real exams, and is run again after every image change.
6. **Fallback.** Stop Judge0 (`docker compose --project-directory /opt/judge0 stop`) during a practice run: code still runs (on the in-house runner) and the API logs "Judge0 unavailable".

## Upgrading

Build a new image, then `sudo JUDGE0_TOKEN=<same token> JUDGE0_IMAGE=ghcr.io/deepakvish001/parikshaa-judge0:<commit> ./setup-judge0.sh`. Passwords are kept. Run the parity suite again.

## Files

| | |
|---|---|
| `judge0.conf` | Judge0's settings, hardened. No secret. |
| `docker-compose.yml` | Judge0's server and workers on our image, with its own Postgres and Redis. |
| `compilers/Dockerfile`, `compilers/languages.rb` | Our image: Python 3.12, Node 20, GCC 13 (C, C++), Java 21 (Temurin), each checked against a published checksum. |
| `setup-judge0.sh` | The VM's setup; tested by `test/setup-judge0.test.sh` against fakes in CI. |

## Licence

Judge0 is GPL-3.0. Parikshaa uses it unchanged, as a network service, and does not link it into its own code. The image's Dockerfile is public here.

## Not yet

- The image has not been built and Judge0 has not run against the parity suite: both need the staging VM (cgroup v1 cannot run in CI).
- More languages (Go, Rust, Kotlin, C#, TypeScript) come with the LeetCode-style editor (G4); the runner's language list is shared, so they come to both backends together.
- A load test of 1,000 candidates (p95 verdict under 5 s), and queue length and p95 time in monitoring.
