# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Copy source (exclude node_modules, .next, .git)
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js standalone
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built artifacts from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/keys ./keys

# Copy Prisma client binaries
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client /app/node_modules/@prisma/client
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma /app/node_modules/prisma

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
