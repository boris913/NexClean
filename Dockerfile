# Image de production NEXCLEAN (ADR 0002) — construite par Coolify sur le VPS.
# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:scripts

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 STORAGE_DIR=/data/documents
RUN groupadd --system --gid 1001 nexclean && useradd --system --uid 1001 --gid nexclean nexclean \
  && mkdir -p /data/documents && chown -R nexclean:nexclean /data
COPY --from=build --chown=nexclean:nexclean /app/.next/standalone ./
COPY --from=build --chown=nexclean:nexclean /app/.next/static ./.next/static
COPY --from=build --chown=nexclean:nexclean /app/public ./public
COPY --from=build --chown=nexclean:nexclean /app/dist-scripts ./dist-scripts
COPY --from=build --chown=nexclean:nexclean /app/lib/db/migrations ./lib/db/migrations
# Module natif utilisé par le hachage des mots de passe (non empaqueté par esbuild).
COPY --from=build --chown=nexclean:nexclean /app/node_modules/@node-rs ./node_modules/@node-rs
COPY --chown=nexclean:nexclean docker-entrypoint.sh ./
USER nexclean
EXPOSE 3000
VOLUME ["/data/documents"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
