import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const redis = new Redis(redisUrl, {
  password: process.env.REDIS_PASSWORD!,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

redis.on("connect", () => console.log("Connecté à Redis avec succès"));
redis.on("error", (err) => console.error("❌ Erreur Redis :", err));