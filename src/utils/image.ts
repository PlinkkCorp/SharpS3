import sharp, { FitEnum } from "sharp";
import { applyWatermark } from "./watermark";
import { ImageOptions, InvalidImageOperationError } from "../types/image";

export async function processImage(
  buffer: Buffer<ArrayBufferLike>,
  opts: ImageOptions,
) {
  const metadata = await sharp(buffer).metadata();
  const imgWidth = metadata.width || 0;
  const imgHeight = metadata.height || 0;

  let img = sharp(buffer, { animated: metadata.pages && metadata.pages > 1 });

  img = img.autoOrient().rotate();

  if (opts.extract) {
    const { top, left, width, height } = opts.extract;

    const isOutOfBounds = 
      left < 0 || 
      top < 0 || 
      width <= 0 || 
      height <= 0 || 
      (left + width) > imgWidth || 
      (top + height) > imgHeight;

    if (isOutOfBounds) {
      throw new InvalidImageOperationError(
        `Zone d'extraction invalide. L'image d'origine fait ${imgWidth}x${imgHeight}px. ` +
        `La zone demandée (${left + width}x${top + height}px) dépasse des limites.`
      );
    }

    img = img.extract(opts.extract);
  }

  if (opts.trim !== undefined) {
    img = img.trim({
      threshold: opts.trim,
      background: opts.trimBg ? `#${opts.trimBg}` : undefined
    });
  }

  if (opts.placeholder) {
    img = img.resize({ width: Math.round(metadata.width * 0.3) }).blur(2);
  } else if (opts.w || opts.h) {
    img = img.resize({
      width: opts.w,
      height: opts.h,
      fit: opts.fit,
      position: opts.strategy || "center",
      withoutEnlargement: false,
    });
  }

  if (opts.extend) {
    const background = opts.extendBg ? `#${opts.extendBg}` : { r: 0, g: 0, b: 0, alpha: 0 };
    img = img.extend({
      top: opts.extend,
      bottom: opts.extend,
      left: opts.extend,
      right: opts.extend,
      background
    });
  }

  if (opts.modulate) {
    img = img.modulate({
      brightness: opts.modulate.brightness || 1,
      saturation: opts.modulate.saturation || 1,
      hue: opts.modulate.hue || 0,
    });
  }

  if (opts.blur && !opts.placeholder) img = img.blur(opts.blur);
  if (opts.grayscale) img = img.grayscale();
  if (opts.tint) img = img.tint(opts.tint);
  if (opts.negate) img = img.negate();
  if (opts.linear) img = img.linear(opts.linear.a, opts.linear.b);
  if (opts.flip) img = img.flip();
  if (opts.flop) img = img.flop();
  if (opts.rot)
    img = img.rotate(opts.rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } });

  if (opts.format === "gif") {
    img = img.gif({ loop: 0 });
  } else {
    switch (opts.format) {
      case "webp":
        img = img.webp({ quality: opts.quality || 80 });
        break;
      case "avif":
        img = img.avif({ quality: opts.quality || 50 });
        break;
      case "png":
        img = img.png({ progressive: true });
        break;
      default:
        img = img.jpeg({ quality: opts.quality || 80, progressive: true });
    }
  }

  if (opts.watermark !== undefined) {
    img = await applyWatermark(img, opts.watermark, { opacity: 0.28 });
  }

  img = img.withMetadata({
    exif: {
      IFD0: {
        Artist: "MarvideoIMGProxy",
        ImageDescription: "Edité par MarvideoIMGProxy",
        Copyright: "MarvideoIMGProxy 2026",
      },
      IFD1: {
        UserComment: "Edité par MarvideoIMGProxy",
      },
    },
  });

  return img.toBuffer();
}

export function mimeTypeFromFormat(format: string): string {
  switch (format) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    default:
      return "image/jpeg";
  }
}

export async function getImageFromUrl(url: string): Promise<Buffer> {
  const cleanUrl = url.replace(/^"|"$/g, "").trim();

  const parsedUrl = new URL(cleanUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  const privateIpRegex =
    /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;
  if (privateIpRegex.test(parsedUrl.hostname)) {
    throw new Error("Forbidden target URL (Private IP)");
  }

  try {
    const response = (await globalThis.fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Connection: "keep-alive",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
      },
    })) as unknown as InstanceType<typeof globalThis.Response>;
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Erreur HTTP Distante : ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(
        "Le serveur distant a mis trop de temps à répondre (Timeout 2s).",
      );
    }
    throw error;
  }
}
