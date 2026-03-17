FROM node:20-alpine
WORKDIR /app
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/common/package.json ./packages/common/
COPY services/user-service/package.json ./services/user-service/
RUN corepack enable && pnpm install --no-frozen-lockfile
COPY packages/ ./packages/
COPY services/user-service/ ./services/user-service/
COPY tsconfig.base.json ./
RUN pnpm --filter @exchange/shared-types build && pnpm --filter @exchange/common build && pnpm --filter @exchange/user-service build
EXPOSE 3002
CMD ["node", "services/user-service/dist/main"]
