# Walking-skeleton image for the webapp (FNS-138).
#
# TODO(FNS-111): This is scaffolding only and is NOT a working production image.
# It runs the TanStack Start dev server as a "good enough for docker-compose"
# local bring-up (FNS-90). A real production multi-stage build with proper SSR
# client-asset serving is deferred to FNS-111 — `bun run build` emits a Web
# `fetch` handler that still needs a hosting adapter to inject the client
# manifest and serve `dist/client`.
FROM oven/bun:1.3.13

WORKDIR /app

# Install deps first so the layer caches independently of source changes.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# App source.
COPY . .

ENV PORT=3000
EXPOSE 3000

# --host binds 0.0.0.0 so the server is reachable from outside the container.
CMD ["bun", "run", "dev", "--host"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD bun --eval "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
