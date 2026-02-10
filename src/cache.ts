import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import("dotenv/config")

const CACHE_DIR = process.env.CACHE_DIR || "./cache";
const MAX_CACHE_SIZE = Number(process.env.MAX_CACHE_SIZE ?? 1 * 1024 ** 3); // 1 Go

export function cacheKey(str: string) {
  return crypto.createHash("sha1").update(str).digest("hex");
}

export async function getFromCache(key: string): Promise<Buffer | null> {
  const filePath = path.join(CACHE_DIR, key);

  try {
    const data = await fs.readFile(filePath);
    const now = new Date();
    await fs.utimes(filePath, now, now);
    return data;
  } catch {
    return null;
  }
}

async function getCacheFiles() {
  const files = await fs.readdir(CACHE_DIR);
  const stats = await Promise.all(
    files.map(async (f) => {
      const full = path.join(CACHE_DIR, f);
      const s = await fs.stat(full);
      return {
        path: full,
        size: s.size,
        mtime: s.mtimeMs,
      };
    })
  );
  return stats;
}

async function evictIfNeeded() {
  try {
    const files = await getCacheFiles();

    let totalSize = files.reduce((a, f) => a + f.size, 0);
    if (totalSize <= MAX_CACHE_SIZE) return;

    files.sort((a, b) => a.mtime - b.mtime);

    for (const file of files) {
      await fs.unlink(file.path);
      totalSize -= file.size;

      if (totalSize <= MAX_CACHE_SIZE) break;
    }
  } catch {
  }
}

export async function saveToCache(key: string, buffer: string | import("node:stream") | NodeJS.ArrayBufferView<ArrayBufferLike> | Iterable<string | NodeJS.ArrayBufferView<ArrayBufferLike>> | AsyncIterable<string | NodeJS.ArrayBufferView<ArrayBufferLike>>) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const filePath = path.join(CACHE_DIR, key);
  await fs.writeFile(filePath, buffer);

  await evictIfNeeded();
}