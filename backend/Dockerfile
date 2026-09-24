# ---- deps: cached separately so a source-only change doesn't reinstall packages ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S nodejs && adduser -S expressjs -G nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma.config.js ./
COPY prisma ./prisma
COPY src ./src

# `prisma generate` never connects to a database — it only reads the schema — but
# prisma.config.js still calls env("DATABASE_URL") and throws if that resolves to
# nothing at all. There's no .env in the build context (it's real secrets, excluded
# via .dockerignore), so this placeholder exists purely to satisfy that check; the
# real DATABASE_URL is supplied at container run time (docker-compose `environment:`)
# and takes over from here as soon as the process actually starts.
#
# Generates the Prisma client against THIS image's schema — must run here, not in the
# deps stage, so node_modules/.prisma + node_modules/@prisma/client land directly in
# the final image without a fragile cross-stage copy of Prisma's generated-output split.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Defensive: strips CR in case this file was ever saved with CRLF line endings (e.g.
# edited on Windows) — a CRLF shebang line makes Alpine's sh fail with a cryptic
# "no such file or directory" instead of a readable syntax error.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown -R expressjs:nodejs /app

USER expressjs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
