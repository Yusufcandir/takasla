FROM node:20-alpine
WORKDIR /app
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/common/package.json ./packages/common/
COPY services/messaging-service/package.json ./services/messaging-service/
RUN corepack enable && pnpm install --no-frozen-lockfile
COPY packages/ ./packages/
COPY services/messaging-service/ ./services/messaging-service/
COPY tsconfig.base.json ./
RUN pnpm --filter @exchange/shared-types build && pnpm --filter @exchange/common build && pnpm --filter @exchange/messaging-service build
EXPOSE 3011
CMD ["node", "services/messaging-service/dist/main"]
