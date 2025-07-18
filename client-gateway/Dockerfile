FROM node:18-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

RUN pnpm build

FROM node:18-alpine AS runner

WORKDIR /app
RUN npm install -g pnpm

COPY --from=builder /app ./
ENV NODE_ENV=production

EXPOSE 3000
CMD ["pnpm", "start"]
