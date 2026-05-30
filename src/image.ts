import sharp, { FitEnum } from "sharp";
import { applyWatermark } from "./utils/watermark";

export const SOURCE_FALLBACKS = ["webp", "png", "jpg", "jpeg"] as const;

export async function processImage(
  buffer: Buffer<ArrayBufferLike>,
  opts: {
    w: number | undefined;
    h: number | undefined;
    fit: keyof FitEnum | undefined;
    blur: number | boolean | sharp.BlurOptions | undefined;
    grayscale: boolean | undefined;
    format: string | undefined;
    quality: number | undefined;
    scale: number | undefined;
    watermark?: string;
  },
) {
  let img = sharp(buffer);

  if (opts.w || opts.h) {
    img = img.resize({
      width: opts.w,
      height: opts.h,
      fit: opts.fit || "cover",
      withoutEnlargement: false,
    });
  }

  if (opts.blur) img = img.blur(opts.blur);
  if (opts.grayscale) img = img.grayscale();

  switch (opts.format) {
    case "webp":
      img = img.webp({ quality: opts.quality || 80 });
      break;
    case "avif":
      img = img.avif({ quality: opts.quality || 50 });
      break;
    case "png":
      img = img.png();
      break;
    default:
      img = img.jpeg({ quality: opts.quality || 80 });
  }

  if (opts.watermark !== undefined) {
    img = await applyWatermark(img, opts.watermark, { opacity: 0.28 });
  }

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
  const res = (await fetch(url)) as any;

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Failed to fetch image from URL: ${res.status}`);
  }

  if (typeof res.buffer === "function") {
    return await res.buffer();
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}