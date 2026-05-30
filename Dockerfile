FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

RUN npm run build

RUN npm prune --production

FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y openssl fontconfig fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

CMD ["sh", "-c", "npm run start"]

EXPOSE 3002