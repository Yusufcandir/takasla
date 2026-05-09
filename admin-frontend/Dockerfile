FROM node:22-alpine AS builder
WORKDIR /app
COPY admin-frontend/package.json ./
RUN corepack enable && pnpm install --node-linker=hoisted
COPY admin-frontend/ ./
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 4001
ENV PORT=4001
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
