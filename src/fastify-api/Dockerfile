# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN corepack enable && pnpm i --frozen-lockfile
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN pnpm run build

# ---------- runtime ----------
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --prod --frozen-lockfile
ENV NODE_ENV=production PORT=8000
CMD ["node", "dist/server.js"]
