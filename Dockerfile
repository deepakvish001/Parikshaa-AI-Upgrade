# Multi-stage: the build needs the whole workspace and every dev dependency;
# the runtime image needs the compiled server, the client bundles, and nothing
# that could compile anything.

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json tsconfig.tests.json ./
COPY packages/core/package.json     packages/core/
COPY packages/viva/package.json     packages/viva/
COPY packages/store/package.json    packages/store/
COPY packages/api/package.json      packages/api/
COPY packages/web/package.json      packages/web/
COPY packages/console/package.json  packages/console/
RUN npm ci

COPY . .
RUN npm run build \
 && npm run build -w @parikshaa/web \
 && npm run build -w @parikshaa/console \
 && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S parikshaa && adduser -S parikshaa -G parikshaa

COPY --from=build /app/node_modules              ./node_modules
COPY --from=build /app/package.json              ./package.json
COPY --from=build /app/packages/core/dist        ./packages/core/dist
COPY --from=build /app/packages/core/package.json ./packages/core/package.json
COPY --from=build /app/packages/viva/dist        ./packages/viva/dist
COPY --from=build /app/packages/viva/package.json ./packages/viva/package.json
COPY --from=build /app/packages/store/dist       ./packages/store/dist
COPY --from=build /app/packages/store/package.json ./packages/store/package.json
COPY --from=build /app/packages/store/migrations ./packages/store/migrations
COPY --from=build /app/packages/api/dist         ./packages/api/dist
COPY --from=build /app/packages/api/package.json ./packages/api/package.json
COPY --from=build /app/packages/web/dist         ./packages/web/dist
COPY --from=build /app/packages/console/dist     ./packages/console/dist

USER parikshaa
EXPOSE 3000

# Migrations are deliberately NOT run on boot: several instances starting at
# once would race, and a schema change should be a deliberate step. Run
# `npm run migrate -w @parikshaa/store` as its own task before rolling out.
CMD ["node", "packages/api/dist/main.js"]
