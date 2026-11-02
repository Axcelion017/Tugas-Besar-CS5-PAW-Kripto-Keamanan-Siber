# Dockerfile Hardening Produksi Resilio-Health (Sub-CPMK 3 KKS)
# Memenuhi kaidah: Multi-stage build, pengguna non-root (USER node), capability minimal, bebas critical vulnerability

# ==========================================
# TAHAP 1: Pembangun Dependensi & Kompilasi (Builder)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Pasang dependensi build
COPY package.json package-lock.json ./
RUN npm ci

# Salin konfigurasi skema dan build Next.js
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json next.config.ts ./
RUN npx prisma generate

COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public

ENV NODE_ENV=production
RUN npm run build

# ==========================================
# TAHAP 2: Citra Produksi yang Diperkeras (Hardened Runner)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Pengerasan Container 1: Jalankan sebagai pengguna non-root 'node' (UID 1000)
# Mencegah penyerang mengambil alih host jika container terkompromi
USER node

ENV NODE_ENV=production
ENV PORT=3000

# Salin hanya artefak yang dibutuhkan dengan kepemilikan user node
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/prisma ./prisma

# Pengerasan Container 2: Batasi ekspos port hanya ke web port internal
EXPOSE 3000

# Pengerasan Container 3: Jalankan Next.js server production
CMD ["npm", "run", "start"]
