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

CMD ["sh", "-c", "npm run start"]

EXPOSE 3002