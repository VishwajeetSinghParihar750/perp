# Single-image build for the perp backend stack (engine + dbpoller + backend),
# with an in-container Redis. Designed to run as one Render free web service.
FROM oven/bun:1.3.14

# Redis (in-container cache/stream store) + bash for the entrypoint script.
RUN apt-get update \
  && apt-get install -y --no-install-recommends redis-server ca-certificates bash \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json bun.lock bunfig.toml turbo.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/engine/package.json apps/engine/package.json
COPY apps/dbpoller/package.json apps/dbpoller/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN bun install --frozen-lockfile

# Copy the rest of the source.
COPY . .

# Generate the Prisma client (uses packages/db/prisma.config.ts).
RUN cd packages/db && bunx prisma generate

RUN chmod +x start.sh

ENV NODE_ENV=production
# Render provides PORT at runtime; default for local docker runs.
ENV PORT=3001
EXPOSE 3001

CMD ["bash", "start.sh"]
