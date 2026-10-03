# syntax=docker/dockerfile:1.7
#
# Parikshaa's Judge0 image (docs/F1-GO-LIVE-PLAN.md §5.1–5.2, G3): Judge0
# 1.13.1 with our own compilers in place of Judge0 CE's old ones, built the way
# judge0/compilers builds them: each into /usr/local/<name>-<version>, from the
# project's own release, checked against the checksum it publishes.
#
# The languages are the runner's (packages/runner/src/languages.ts): Python,
# JavaScript (Node), C and C++ (GCC), Java, and SQL through Python's SQLite.
# The API finds them by name in /languages (languages.rb), never by id.
#
# Built by .github/workflows/judge0-image.yml and pushed to GHCR. Judge0 is
# GPL-3.0: this file is public, and Judge0 runs as an unchanged network service.

ARG JUDGE0=judge0/judge0:1.13.1
FROM ${JUDGE0} AS base
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential ca-certificates curl xz-utils \
      libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev libffi-dev liblzma-dev libgmp-dev libmpfr-dev libmpc-dev \
 && rm -rf /var/lib/apt/lists/*

# --- Python (also runs SQL, and every question's checker) ----------------------------
# python.org publishes no checksum file: PYTHON_SHA256 is the SHA-256 shown for
# the .tgz on the release's download page, and the build stops without it.
FROM base AS python
ARG PYTHON=3.12.7
ARG PYTHON_SHA256
RUN test -n "${PYTHON_SHA256}" || { echo "Set --build-arg PYTHON_SHA256 (python.org release page)" >&2; exit 1; } \
 && curl -fsSLO "https://www.python.org/ftp/python/${PYTHON}/Python-${PYTHON}.tgz" \
 && echo "${PYTHON_SHA256}  Python-${PYTHON}.tgz" | sha256sum -c - \
 && tar xzf "Python-${PYTHON}.tgz" && cd "Python-${PYTHON}" \
 && ./configure --prefix="/usr/local/python-${PYTHON}" --without-ensurepip \
 && make -j"$(nproc)" && make install \
 && "/usr/local/python-${PYTHON}/bin/python3" -c "import sqlite3, json, runpy"

# --- Node.js -------------------------------------------------------------------------
FROM base AS node
ARG NODE=20.18.0
# From https://nodejs.org/dist/v20.18.0/SHASUMS256.txt
ARG NODE_SHA256=4543670b589593f8fa5f106111fd5139081da42bb165a9239f05195e405f240a
RUN curl -fsSLO "https://nodejs.org/dist/v${NODE}/node-v${NODE}-linux-x64.tar.xz" \
 && echo "${NODE_SHA256}  node-v${NODE}-linux-x64.tar.xz" | sha256sum -c - \
 && mkdir -p "/usr/local/node-${NODE}" && tar xJf "node-v${NODE}-linux-x64.tar.xz" -C "/usr/local/node-${NODE}" --strip-components=1

# --- GCC (C and C++) -------------------------------------------------------------------
FROM base AS gcc
ARG GCC=13.3.0
RUN curl -fsSLO "https://ftp.gnu.org/gnu/gcc/gcc-${GCC}/gcc-${GCC}.tar.xz" \
 && curl -fsSL "https://ftp.gnu.org/gnu/gcc/gcc-${GCC}/sha512.sum" | grep " gcc-${GCC}.tar.xz\$" | sha512sum -c - \
 && tar xJf "gcc-${GCC}.tar.xz" && mkdir build && cd build \
 && "../gcc-${GCC}/configure" --prefix="/usr/local/gcc-${GCC}" --enable-languages=c,c++ --disable-multilib --disable-bootstrap \
 && make -j"$(nproc)" && make install-strip

# --- Java (Eclipse Temurin) ---------------------------------------------------------------
FROM base AS java
ARG JAVA=21.0.5+11
# From the release's .sha256.txt
ARG JAVA_SHA256=3c654d98404c073b8a7e66bffb27f4ae3e7ede47d13284c132d40a83144bfd8c
RUN v="${JAVA/+/_}" && file="OpenJDK21U-jdk_x64_linux_hotspot_${v}.tar.gz" \
 && curl -fsSLO "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-${JAVA/+/%2B}/${file}" \
 && echo "${JAVA_SHA256}  ${file}" | sha256sum -c - \
 && mkdir -p /usr/local/java-21 && tar xzf "${file}" -C /usr/local/java-21 --strip-components=1

# --- the image ------------------------------------------------------------------------
FROM ${JUDGE0}
ARG PYTHON=3.12.7
ARG NODE=20.18.0
ARG GCC=13.3.0
COPY --from=python /usr/local/python-${PYTHON} /usr/local/python-${PYTHON}
COPY --from=node /usr/local/node-${NODE} /usr/local/node-${NODE}
COPY --from=gcc /usr/local/gcc-${GCC} /usr/local/gcc-${GCC}
COPY --from=java /usr/local/java-21 /usr/local/java-21
# Judge0 seeds /languages from these at start; ours replace Judge0 CE's.
COPY languages.rb /api/db/languages/active.rb
RUN printf '@languages ||= []\n' > /api/db/languages/archived.rb
LABEL org.opencontainers.image.source="https://github.com/deepakvish001/Parikshaa-AI-Upgrade" \
      org.opencontainers.image.description="Judge0 1.13.1 with Parikshaa's compilers" \
      org.opencontainers.image.licenses="GPL-3.0-only"
