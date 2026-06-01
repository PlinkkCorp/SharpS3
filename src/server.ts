import Fastify, { FastifyRequest } from "fastify";
import { cacheKey, getFromCache, saveToCache } from "./utils/cache";
import { getImageFromUrl, mimeTypeFromFormat, processImage } from "./utils/image";
import { getImageWithFallback } from "./utils/s3";
import {
  ImageFormat,
  ImageQuerySchema,
  sharpParams,
  SUPPORTED_FORMATS,
} from "./types/image";
import { extractScale } from "./utils/scale";
import { isPremiumRequest } from "./utils/premium";
import fastifyMultipart from "@fastify/multipart";
import z, { ZodError } from "zod";
import rateLimit from "@fastify/rate-limit";
import sharp from "sharp";
import os from "os";
import { redis } from "./utils/redis";
import("dotenv/config");

const fastify = Fastify({ logger: true });

function getOutputFormat(path: string): ImageFormat {
  const ext = path.split(".").pop()?.toLowerCase();

  if (!SUPPORTED_FORMATS.includes(ext as ImageFormat)) {
    throw new Error("Unsupported output format");
  }

  return ext as ImageFormat;
}

fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

fastify.register(rateLimit, {
  global: true,
  max: 50,
  timeWindow: "1 minute",
  hook: "preParsing",
  redis: redis,
  keyGenerator: (req) => {
    return req.ip;
  },
  errorResponseBuilder: (req, context) => {
    return {
      statusCode: 429,
      error: "Too Many Requests",
      message: `Trop de requêtes. Veuillez réessayer dans ${context.after}.`,
    };
  },
});

fastify.get(
  "/s3/:bucket/*",
  async (
    req: FastifyRequest<{ Params: { bucket: string; "*": string } }>,
    rep,
  ) => {
    const { bucket, "*": key } = req.params;

    if (!bucket || !key) {
      return rep.code(400).send("Invalid path");
    }

    if (key.includes("..")) {
      return rep.code(403).send("Forbidden");
    }

    const parsedQuery = ImageQuerySchema.parse(req.query);
    const premium = isPremiumRequest(req);

    const { cleanPath, scale } = extractScale(key);
    const outputFormat =
      parsedQuery.format || getOutputFormat(cleanPath) || "jpeg";
    const options = {
      ...parsedQuery,
      format: outputFormat,
      scale,
    };

    const cacheId = cacheKey(key + JSON.stringify(options));
    const cached = await getFromCache(cacheId);

    if (cached) {
      rep.header("Content-Type", mimeTypeFromFormat(outputFormat));
      rep.header("X-Cache", "HIT");
      return rep.send(cached);
    }

    const original = await getImageWithFallback(bucket, cleanPath);
    const output = await processImage(original, options);

    await saveToCache(cacheId, output);

    rep.header("Content-Type", mimeTypeFromFormat(outputFormat));
    rep.header("Cache-Control", "public, max-age=31536000, immutable");
    rep.header("X-Cache", "MISS");
    rep.header("Vary", "Accept");
    return rep.send(output);
  },
);

fastify.get(
  "/lnk/*",
  async (req: FastifyRequest<{ Params: { "*": string } }>, rep) => {
    let wildcard = req.params["*"];

    if (!wildcard) {
      return rep.code(400).send("Invalid path");
    }

    if (wildcard.includes("..")) {
      return rep.code(403).send("Forbidden");
    }

    const rawUrl = req.raw.url || "";
    const lnkIndex = rawUrl.indexOf("/lnk/");

    if (lnkIndex === -1) return rep.code(400).send("Malformed internal route");

    let fullTargetUrl = rawUrl.substring(lnkIndex + 5);

    fullTargetUrl = fullTargetUrl.replace(/^"|"$/g, "");

    const parsedTarget = new URL(
      fullTargetUrl.startsWith("http")
        ? fullTargetUrl
        : `https://${fullTargetUrl}`,
    );

    sharpParams.forEach((param) => parsedTarget.searchParams.delete(param));

    const finalUrlToFetch = parsedTarget.toString();

    const parsedQuery = ImageQuerySchema.parse(req.query);
    // const premium = isPremiumRequest(req);

    const { cleanPath, scale } = extractScale(parsedTarget.pathname);
    const outputFormat =
      parsedQuery.format || getOutputFormat(cleanPath) || "jpeg";

    const options = {
      ...parsedQuery,
      format: outputFormat,
      scale,
    };

    const cacheId = cacheKey(finalUrlToFetch + JSON.stringify(options));
    const cached = await getFromCache(cacheId);

    if (cached) {
      rep.header("Content-Type", mimeTypeFromFormat(outputFormat));
      rep.header("X-Cache", "HIT");
      return rep.send(cached);
    }

    let original: Buffer;
    try {
      original = await getImageFromUrl(finalUrlToFetch);
    } catch (error) {
      const width = options.w || 600;
      const height = options.h || 400;

      try {
        original = await getImageFromUrl(
          `https://placehold.co/${width}x${height}.png?text=Image%0ANon%20Disponible`,
        );

        rep.header("X-Image-Fallback", "true");
      } catch (error) {
        throw new Error("Image Fallback fail");
      }
    }

    const output = await processImage(original, options);

    await saveToCache(cacheId, output);

    rep.header("Content-Type", mimeTypeFromFormat(outputFormat));
    rep.header("Cache-Control", "public, max-age=31536000, immutable");
    rep.header("X-Cache", "MISS");
    rep.header("Vary", "Accept");
    return rep.send(output);
  },
);

fastify.post("/upload", async (req, rep) => {
  const data = await req.file();

  if (!data) {
    return rep.code(400).send("No file uploaded");
  }

  const originalBuffer = await data.toBuffer();

  const inputFormat = data.mimetype.split("/")[1] || "jpeg";

  const parsedQuery = ImageQuerySchema.parse(req.query);

  const outputFormat =
    parsedQuery.format ||
    z.enum(SUPPORTED_FORMATS).optional().parse(inputFormat);

  const options = {
    ...parsedQuery,
    format: outputFormat,
    scale: 1,
  };

  const output = await processImage(originalBuffer, options);

  rep.header("Content-Type", mimeTypeFromFormat(outputFormat));
  rep.header("Cache-Control", "no-store, must-revalidate");

  return rep.send(output);
});

fastify.get("/", async (req, rep) => {
  rep.type("text/html").send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MarvideoIMGProxy</title>
      <style>
        :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #38bdf8; }
        body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 2rem; }
        max-width: 900px; margin: 0 auto;
        h1 { color: var(--accent); border-bottom: 2px solid var(--card); padding-bottom: 1rem; }
        h2 { margin-top: 2rem; color: #e2e8f0; }
        code { background: #020617; padding: 0.2rem 0.4rem; border-radius: 4px; color: #f43f5e; font-family: monospace; }
        pre { background: #020617; padding: 1rem; border-radius: 8px; overflow-x: auto; border: 1px solid #334155; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #334155; }
        th { background: var(--card); color: var(--accent); }
        .endpoint { font-weight: bold; color: #10b981; }
      </style>
    </head>
    <body>
      <h1>MarvideoIMGProxy</h1>
      <p>Service de traitement et d'optimisation d'images à la volée propulsé par Fastify & Sharp.</p>

      <h2>📍 Endpoints disponibles</h2>
      <ul>
        <li><span class="endpoint">GET</span> <code>/s3/:bucket/*</code> — Traiter une image depuis le stockage S3</li>
        <li><span class="endpoint">GET</span> <code>/lnk/*</code> — Traiter une image distante depuis une URL absolue</li>
        <li><span class="endpoint">POST</span> <code>/upload</code> — Envoyer un fichier image à traiter (Multipart)</li>
        <li><span class="endpoint" style="color: #ef4444;">DELETE</span><code>/cache</code> — Vide l'intégralité du cache Redis (Nécessite le header <code>X-Purge-Token</code>)</li>
      </ul>

      <h2>⚙️ Paramètres de Requête (Query Params)</h2>
      <table>
        <thead>
          <tr><th>Paramètre</th><th>Type</th><th>Description</th><th>Exemple</th></tr>
        </thead>
        <tbody>
          <tr><td><code>w</code> / <code>h</code></td><td>number</td><td>Largeur / Hauteur en pixels</td><td><code>?w=800&h=600</code></td></tr>
          <tr><td><code>fit</code></td><td>string</td><td>Mode de redimensionnement (<code>cover, contain, fill, inside, outside</code>)</td><td><code>?fit=contain</code></td></tr>
          <tr><td><code>strategy</code></td><td>string</td><td>Smart cropping intelligent (<code>entropy, attention</code>)</td><td><code>?strategy=attention</code></td></tr>
          <tr><td><code>quality</code></td><td>number</td><td>Qualité de compression (1 à 100)</td><td><code>?quality=85</code></td></tr>
          <tr><td><code>format</code></td><td>string</td><td>Forcer le format de sortie (<code>webp, avif, png, jpeg</code>)</td><td><code>?format=avif</code></td></tr>
          <tr><td><code>blur</code></td><td>number</td><td>Flouter l'image (rayon de 1 à 1000)</td><td><code>?blur=10</code></td></tr>
          <tr><td><code>grayscale</code></td><td>boolean</td><td>Convertir l'image en noir et blanc</td><td><code>?grayscale=true</code></td></tr>
          <tr><td><code>tint</code></td><td>string</td><td>Appliquer une teinte colorée (Format Hex)</td><td><code>?tint=%23FF0000</code></td></tr>
          <tr><td><code>negate</code></td><td>boolean</td><td>Inverser les couleurs (négatif)</td><td><code>?negate=true</code></td></tr>
          <tr><td><code>placeholder</code></td><td>boolean</td><td>Générer un mini placeholder flou (LQIP)</td><td><code>?placeholder=true</code></td></tr>
          <tr><td><code>watermark</code></td><td>string</td><td>ID ou texte du filigrane à appliquer</td><td><code>?watermark=logo</code></td></tr>
        </tbody>
      </table>
    </body>
    </html>
  `);
});

fastify.get("/metrics", async (req, rep) => {
  const memoryUsage = process.memoryUsage();
  const freeMemPercentage = (os.freemem() / os.totalmem()) * 100;
  return {
    status: "OK",
    timestamp: new Date().toISOString(),

    redis: {
      connected: redis.status === "ready",
      host: redis.options.host,
    },

    container: {
      id: os.hostname(),
      platform: os.platform(),
      architecture: os.arch(),
      nodeVersion: process.version,
      cpusCount: os.cpus().length,
      serviceName: process.env.SWARM_SERVICE_NAME || "unknown",
      nodeId: process.env.SWARM_NODE_ID || "unknown"
    },

    perf: {
      uptimeSeconds: Math.floor(process.uptime()),
      processMemory: {
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      systemMemoryFreePercentage: Math.round(freeMemPercentage),
    },

    sharpCounters: sharp.counters(),
  };
});

fastify.post("/warmup", async (req, rep) => {
  const { bucket, key, targets } = req.body as {
    bucket: string;
    key: string;
    targets: Array<{ w?: number; h?: number; format: string }>;
  };

  for (const target of targets) {
    const original = await getImageWithFallback(bucket, key);
    const output = await processImage(original, target as any);
    const cacheId = cacheKey(key + JSON.stringify(target));
    await saveToCache(cacheId, output);
  }

  return rep.send({ success: true, message: `${targets.length} variantes mises en cache.` });
});

fastify.delete("/cache", async (req, rep) => {
  const secretToken = process.env.CACHE_PURGE_TOKEN || "hkgnkhjlvgdvùtdc";
  const authHeader = req.headers["x-purge-token"];

  if (!authHeader || authHeader !== secretToken) {
    return rep.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Jeton de purge invalide ou manquant dans les en-têtes (X-Purge-Token)."
    });
  }

  try {
    const keys = await redis.keys("img:*");

    if (keys.length === 0) {
      return rep.send({
        success: true,
        message: "Le cache est déjà vide.",
        clearedCount: 0
      });
    }

    await redis.del(...keys);

    return rep.send({
      success: true,
      message: "Le cache de MarvideoIMGProxy a été entièrement vidé.",
      clearedCount: keys.length
    });
  } catch (error) {
    req.log.error(error);
    return rep.status(500).send({
      statusCode: 500,
      error: "Internal Server Error",
      message: "Impossible de vider le cache Redis."
    });
  }
});

fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply
      .status(400)
      .header("Content-Type", "application/json; charset=utf-8")
      .send({
        statusCode: 400,
        error: "Bad Request",
        message: "Validation failed",
        details: error.flatten().fieldErrors,
      });
  }
  request.log.error(error);
  return reply
    .status(500)
    .send({ statusCode: 500, error: "Internal Server Error" });
});

fastify.listen({ port: 3002, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.info(`Server is now listening on ${address}`);
  sharp.cache(false);
  sharp.concurrency(2);
  sharp.simd(true);
});
