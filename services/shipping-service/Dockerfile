FROM node:20-alpine
WORKDIR /app
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/common/package.json ./packages/common/
COPY services/shipping-service/package.json ./services/shipping-service/
RUN corepack enable && pnpm install --no-frozen-lockfile
COPY packages/ ./packages/
COPY services/shipping-service/ ./services/shipping-service/
COPY tsconfig.base.json ./
RUN pnpm --filter @exchange/shared-types build && pnpm --filter @exchange/common build && pnpm --filter @exchange/shipping-service build
EXPOSE 3009
CMD ["node", "services/shipping-service/dist/main"]
