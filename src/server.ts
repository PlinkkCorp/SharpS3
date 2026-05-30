import Fastify from "fastify";
import { cacheKey, getFromCache, saveToCache } from "./cache";
import mime from "mime-types";
import { getImageFromUrl, mimeTypeFromFormat, processImage, SOURCE_FALLBACKS } from "./image";
import { getImageWithFallback } from "./s3";
import { ImageFormat } from "./types/image";
import { extractScale, fitValues } from "./utils/scale";
import { isPremiumRequest } from "./utils/premium";
import { FitEnum } from "sharp";
import("dotenv/config");

const fastify = Fastify({ logger: true });

function getOutputFormat(path: string): ImageFormat {
  const ext = path.split(".").pop()?.toLowerCase();

  if (!SOURCE_FALLBACKS.includes(ext as ImageFormat)) {
    throw new Error("Unsupported output format");
  }

  return ext as ImageFormat;
}

fastify.get("/s3/:bucket/*", async (req, rep) => {
  const bucket = (req.params as any).bucket as string;
  const key = (req.params as any)["*"];

  if (!bucket || !key) {
    return rep.code(400).send("Invalid path");
  }

  if (key.includes("..")) {
    return rep.code(403).send("Forbidden");
  }

  const premium = isPremiumRequest(req);

  const { w, h, quality, blur, grayscale, fit, watermark } = req.query as {
    w: string;
    h: string;
    quality: string;
    blur: string;
    grayscale: string;
    fit: string;
    watermark: string;
  };

  const { cleanPath, scale } = extractScale(key);
  const outputFormat = getOutputFormat(cleanPath);
  const options: {
    w: number;
    h: number;
    format: string;
    quality: number;
    blur: number;
    grayscale: boolean;
    fit: keyof FitEnum;
    scale: number;
    watermark: string;
  } = {
    w: w ? parseInt(w) : undefined,
    h: h ? parseInt(h) : undefined,
    format: outputFormat,
    quality: quality ? parseInt(quality) : undefined,
    blur: blur ? parseInt(blur) : undefined,
    grayscale: grayscale === "true",
    fit: fitValues.includes(fit as any) ? (fit as keyof FitEnum) : ("cover" as keyof FitEnum),
    scale: scale,
    // watermark: !premium
    watermark: watermark,
  };

  const cacheId = cacheKey(key + JSON.stringify(options));
  const cached = await getFromCache(cacheId);

  if (cached) {
    rep.header("Content-Type", mime.lookup(outputFormat || "jpeg"));
    rep.header("X-Cache", "HIT");
    return rep.send(cached);
  }

  const original = await getImageWithFallback(bucket, cleanPath);
  const output = await processImage(original, options);

  await saveToCache(cacheId, output);

  rep.header("Content-Type", mimeTypeFromFormat(outputFormat));
  rep.header("Cache-Control", "public, max-age=31536000, immutable");
  rep.header("X-Cache", "MISS");
  return rep.send(output);
});

fastify.get("/lnk/*", async (req, rep) => {
  const key = (req.params as any)["*"];

  if (!key) {
    return rep.code(400).send("Invalid path");
  }

  if (key.includes("..")) {
    return rep.code(403).send("Forbidden");
  }

  const premium = isPremiumRequest(req);

  const { w, h, quality, blur, grayscale, fit, watermark } = req.query as {
    w: string;
    h: string;
    quality: string;
    blur: string;
    grayscale: string;
    fit: string;
    watermark: string;
  };

  const { cleanPath, scale } = extractScale(key);
  const outputFormat = getOutputFormat(cleanPath);
  const options: {
    w: number;
    h: number;
    format: string;
    quality: number;
    blur: number;
    grayscale: boolean;
    fit: keyof FitEnum;
    scale: number;
    watermark: string;
  } = {
    w: w ? parseInt(w) : undefined,
    h: h ? parseInt(h) : undefined,
    format: outputFormat,
    quality: quality ? parseInt(quality) : undefined,
    blur: blur ? parseInt(blur) : undefined,
    grayscale: grayscale === "true",
    fit: fitValues.includes(fit as any) ? (fit as keyof FitEnum) : ("cover" as keyof FitEnum),
    scale: scale,
    // watermark: !premium
    watermark: watermark,
  };

  const cacheId = cacheKey(key + JSON.stringify(options));
  const cached = await getFromCache(cacheId);

  if (cached) {
    rep.header("Content-Type", mime.lookup(outputFormat || "jpeg"));
    rep.header("X-Cache", "HIT");
    return rep.send(cached);
  }

  const original = await getImageFromUrl(cleanPath)

  const output = await processImage(original, options);

  await saveToCache(cacheId, output);

  rep.header("Content-Type", mimeTypeFromFormat(outputFormat));
  rep.header("Cache-Control", "public, max-age=31536000, immutable");
  rep.header("X-Cache", "MISS");
  return rep.send(output);
});

fastify.listen({ port: 3002, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.info(`Server is now listening on ${address}`);
});
