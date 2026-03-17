FROM node:20-alpine
WORKDIR /app
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/common/package.json ./packages/common/
COPY services/dispute-service/package.json ./services/dispute-service/
RUN corepack enable && pnpm install --no-frozen-lockfile
COPY packages/ ./packages/
COPY services/dispute-service/ ./services/dispute-service/
COPY tsconfig.base.json ./
RUN pnpm --filter @exchange/shared-types build && pnpm --filter @exchange/common build && pnpm --filter @exchange/dispute-service build
EXPOSE 3007
CMD ["node", "services/dispute-service/dist/main"]
