FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_PUBLIC_SERVER_URL=https://api.superstar-ai.xyz
ENV NEXT_PUBLIC_URL=https://superstar-ai.xyz
ENV NEXT_PUBLIC_IS_MOCK=false
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV NEXT_PUBLIC_SERVER_URL=https://api.superstar-ai.xyz
ENV NEXT_PUBLIC_URL=https://superstar-ai.xyz
ENV NEXT_PUBLIC_IS_MOCK=false
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA

COPY --from=builder /app ./

EXPOSE 8080

CMD ["npm", "start"]
