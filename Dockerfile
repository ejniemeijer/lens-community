# Self-hosted Lens image (single-tenant edition).
#
# The platform-owner console, cross-tenant account APIs, trials, and seat caps
# are all disabled by NEXT_PUBLIC_DEPLOYMENT_MODE=self-hosted (baked in below).
#
# NEXT_PUBLIC_* values are inlined at BUILD time, so the customer's public
# Supabase config is passed as build args. Server-only secrets (service-role
# key, AI keys, Resend) are supplied at RUN time via the container env.
#
#   docker build -t lens-selfhosted \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... .
#   docker run -p 3000:3000 --env-file .env.production lens-selfhosted

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Edition + public client config (inlined into the build).
# DEPLOYMENT_MODE defaults to self-hosted; pass --build-arg DEPLOYMENT_MODE=cloud
# to build your own operator edition from this same Dockerfile.
ARG DEPLOYMENT_MODE=self-hosted
ENV NEXT_PUBLIC_DEPLOYMENT_MODE=$DEPLOYMENT_MODE
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Build stamp: .git is dockerignored, so pass the commit in. Coolify supplies
# SOURCE_COMMIT automatically; for manual builds add
#   --build-arg SOURCE_COMMIT=$(git rev-parse --short HEAD)
# Without it the build still gets a unique timestamp (see next.config.mjs).
ARG SOURCE_COMMIT
ENV SOURCE_COMMIT=$SOURCE_COMMIT

RUN npm run build

# ---------- run ----------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# Server-side edition read at runtime (proxy, API routes) — keep in step
# with the build arg above.
ARG DEPLOYMENT_MODE=self-hosted
ENV NEXT_PUBLIC_DEPLOYMENT_MODE=$DEPLOYMENT_MODE
# /api/version reads the commit at request time, so the RUN stage needs it too
# (the build stage's copy only feeds build-time inlining).
ARG SOURCE_COMMIT
ENV SOURCE_COMMIT=$SOURCE_COMMIT
ENV PORT=3000

# Standalone output: server + only the deps it actually uses. No source, no
# full node_modules.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
