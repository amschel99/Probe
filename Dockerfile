# syntax=docker/dockerfile:1.7
#
# Single image, single origin. Runs TWO apps from the Turborepo:
#   • apps/api  — Express + tRPC + Scalar (Node via tsx) on :8000
#   • apps/web  — Next.js on :3000, reverse-proxies /trpc,/api/auth,/submit,/docs → :8000
# Frontend and backend are separate apps in the monorepo; they're co-located in
# one container so the public surface stays single-origin.

# ─── Stage 1: install all workspace deps ──────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable pnpm

# Copy manifests for every workspace package so the install layer caches well.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json prettier.config.js .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY apps/docs/package.json ./apps/docs/
COPY packages/database/package.json ./packages/database/
COPY packages/services/package.json ./packages/services/
COPY packages/trpc/package.json ./packages/trpc/
COPY packages/logger/package.json ./packages/logger/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: build the Next.js web app ───────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* are inlined into the client bundle at build time (not read at
# runtime). Kamal passes them as --build-arg (see config/deploy.yml → builder.args);
# declare them here and promote to ENV so `next build` can see them. These are
# public values that ship to the browser anyway, so baking them in is expected.
ARG NEXT_PUBLIC_RAZORPAY_DONATE_LINK
ARG NEXT_PUBLIC_GITHUB_URL
ARG NEXT_PUBLIC_TWITTER_URL
ARG NEXT_PUBLIC_LINKEDIN_URL
ARG NEXT_PUBLIC_ENABLE_CHAI_NUDGE
ENV NEXT_PUBLIC_RAZORPAY_DONATE_LINK=$NEXT_PUBLIC_RAZORPAY_DONATE_LINK \
    NEXT_PUBLIC_GITHUB_URL=$NEXT_PUBLIC_GITHUB_URL \
    NEXT_PUBLIC_TWITTER_URL=$NEXT_PUBLIC_TWITTER_URL \
    NEXT_PUBLIC_LINKEDIN_URL=$NEXT_PUBLIC_LINKEDIN_URL \
    NEXT_PUBLIC_ENABLE_CHAI_NUDGE=$NEXT_PUBLIC_ENABLE_CHAI_NUDGE

# Build the Starlight docs site first (static → apps/docs/dist). The api serves
# it at /docs at runtime; the runtime stage copies apps/ (incl. dist) below.
RUN pnpm --filter @repo/docs build

RUN pnpm --filter web build

# ─── Stage 3: runtime ─────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The web app proxies to the api on this internal URL.
ENV API_INTERNAL_URL=http://localhost:8000

RUN corepack enable pnpm && \
    addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs nextjs

# Copy the full installed workspace (incl. devDeps — tsx runs the api, drizzle-kit
# pushes the schema) and the built web app.
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/turbo.json /app/tsconfig.base.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/scripts ./scripts

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health || exit 1

CMD ["sh", "scripts/docker-start.sh"]
