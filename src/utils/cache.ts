import { redis } from "./redis";
import("dotenv/config")

export function cacheKey(input: string) {
  return `img:${Buffer.from(input).toString("base64url")}`;
}

export async function getFromCache(cacheId: string): Promise<Buffer | null> {
  try {
    const data = await redis.getBuffer(cacheId);
    return data || null;
  } catch (error) {
    console.error("Erreur lecture cache Redis:", error);
    return null;
  }
}

export async function saveToCache(cacheId: string, buffer: Buffer) {
  try {
    // 604800 secondes = 7 jours de rétention dans le cache
    await redis.setex(cacheId, 604800, buffer);
  } catch (error) {
    console.error("Erreur écriture cache Redis:", error);
  }
}