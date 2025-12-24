 FROM node:20-slim

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

COPY . .

RUN npm install -g pnpm@9.12.3

ENV CI=true

RUN pnpm install

RUN pnpm run build

CMD ["sh", "-c", "pnpm run start"]

EXPOSE 3002