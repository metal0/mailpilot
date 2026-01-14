FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-slim
WORKDIR /app
# Install build tools for native module compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
# Copy build artifacts and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
# Use npm for production install (handles native modules more reliably than pnpm)
RUN npm install --omit=dev
EXPOSE 8080
CMD ["node", "dist/index.js"]
