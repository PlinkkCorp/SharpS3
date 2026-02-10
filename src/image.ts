import sharp from "sharp";
import { applyWatermark } from "./utils/watermark";

export const SOURCE_FALLBACKS = ["webp", "png", "jpg", "jpeg", "svg", "avif"] as const;

export async function processImage(
  buffer: Buffer<ArrayBufferLike>,
  opts: {
    w: number | undefined;
    h: number | undefined;
    fit: any | undefined;
    blur: number | boolean | sharp.BlurOptions | undefined;
    grayscale: boolean | undefined;
    format: string | undefined;
    quality: number | undefined;
    scale: number | undefined;
    watermark: boolean
  }
) {
  // SVG is not supported by Sharp, return buffer as-is
  if (opts.format === "svg") {
    return buffer;
  }

  let img = sharp(buffer);

  if (opts.w || opts.h) {
    img = img.resize({
      width: opts.w,
      height: opts.h,
      fit: opts.fit || "cover",
    });
  }

  if (opts.blur) img = img.blur(opts.blur);
  if (opts.grayscale) img = img.grayscale();

  if (opts.watermark) img = await applyWatermark(img, "Plinkk", { opacity: 0.28, repeat: 12 });

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
    case "svg":
      return "image/svg+xml";
    default:
      return "image/jpeg";
  }
}
