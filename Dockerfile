# Dockerfile Hardening Produksi JagaMedis (v0.3 — Node 24 Alpine, Multi-Stage, Non-Root)
# Memenuhi kaidah CIS Docker Benchmark: pengguna non-root (USER node), capability minimal, healthcheck aktif

# ==========================================
# TAHAP 1: Pembangun Dependensi & Kompilasi (Builder)
# ==========================================
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json next.config.ts proxy.ts ./
RUN npx prisma generate

COPY app ./app
COPY components ./components
COPY features ./features
COPY lib ./lib
COPY public ./public

ENV NODE_ENV=production
RUN npm run build

# ==========================================
# TAHAP 2: Citra Produksi yang Diperkeras (Hardened Runner)
# ==========================================
FROM node:24-alpine AS runner

WORKDIR /app

# Pengerasan Container 1: Jalankan sebagai pengguna non-root 'node' (UID 1000)
USER node

ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/prisma ./prisma

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "run", "start"]
