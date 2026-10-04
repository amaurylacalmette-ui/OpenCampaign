# syntax=docker/dockerfile:1

# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# prisma needs a DATABASE_URL at generate time only for validation
ENV DATABASE_URL=file:/tmp/build.db
RUN npx prisma generate && npm run build

# ---- run ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# DATABASE_URL + APP_URL come from docker-compose / runtime env

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

# Apply the schema to the SQLite file, then start the standalone server
CMD ["sh", "-c", "npx --yes prisma@6.11.1 db push --skip-generate --accept-data-loss && node server.js"]
