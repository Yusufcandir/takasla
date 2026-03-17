FROM node:20-alpine
WORKDIR /app
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/common/package.json ./packages/common/
COPY services/certificate-service/package.json ./services/certificate-service/
RUN corepack enable && pnpm install --no-frozen-lockfile
COPY packages/ ./packages/
COPY services/certificate-service/ ./services/certificate-service/
COPY tsconfig.base.json ./
RUN pnpm --filter @exchange/shared-types build && pnpm --filter @exchange/common build && pnpm --filter @exchange/certificate-service build
EXPOSE 3008
CMD ["node", "services/certificate-service/dist/main"]
