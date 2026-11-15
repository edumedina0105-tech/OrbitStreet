# OrbitStreet — apps/web (Next.js 15 standalone) listo para Railway.
# Build multi-stage: la imagen final solo lleva el runtime mínimo.

# ---------- Etapa 1: dependencias + build ----------
FROM node:22-alpine AS builder
# Prisma (engines) y compatibilidad de binarios en Alpine.
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# Primero solo los package.json (capas cacheables por Docker).
COPY package.json package-lock.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# Código fuente del monorepo.
COPY packages ./packages
COPY apps/web ./apps/web

# Cliente Prisma (no requiere DATABASE_URL) y build de producción.
RUN npx prisma generate --schema packages/database/prisma/schema.prisma
WORKDIR /app/apps/web
RUN npm run build

# ---------- Etapa 2: imagen final mínima ----------
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

# Railway provee PORT y exige escuchar en 0.0.0.0.
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# El standalone de Next en monorepo queda enraizado en la raíz del repo:
# server.js queda en apps/web/server.js (relativo a /app).
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Prisma CLI aislado (con todas sus dependencias: @prisma/config, effect, etc.)
# para crear/actualizar las tablas automáticamente al arrancar el contenedor.
# db push es idempotente: solo crea lo que falta. El runtime ya trae el cliente
# generado (por eso --skip-generate) y NO tocamos su node_modules.
RUN mkdir -p /prisma-cli && cd /prisma-cli \
  && npm init -y >/dev/null \
  && npm install --no-audit --no-fund prisma@6 >/dev/null \
  && npm cache clean --force >/dev/null 2>&1 || true
COPY --from=builder /app/packages/database/prisma /prisma-cli/schema

EXPOSE 3000

# Healthcheck de plataforma: GET /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

# 1) Asegura el esquema (CREATE TABLE si no existen) y 2) arranca el servidor.
# exec: node reemplaza a sh para recibir SIGTERM correctamente (Railway).
CMD ["sh", "-c", "node /prisma-cli/node_modules/prisma/build/index.js db push --schema /prisma-cli/schema/schema.prisma --skip-generate && exec node apps/web/server.js"]
