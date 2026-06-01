import sharp, { FitEnum } from "sharp";
import { applyWatermark } from "./utils/watermark";
import { ImageOptions } from "./types/image";

export async function processImage(
  buffer: Buffer<ArrayBufferLike>,
  opts: ImageOptions,
) {
  let img = sharp(buffer);

  img = img.rotate();
  
  if (opts.placeholder) {
    img = img
      .resize({ width: 20 })
      .blur(5);
  } else if (opts.w || opts.h) {
    img = img.resize({
      width: opts.w,
      height: opts.h,
      fit: opts.fit,
      position: opts.strategy || "center",
      withoutEnlargement: false,
    });
  }

  if (opts.blur && !opts.placeholder) img = img.blur(opts.blur);  if (opts.grayscale) img = img.grayscale();
  if (opts.tint) img = img.tint(opts.tint);
  if (opts.negate) img = img.negate();


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
  const parsedUrl = new URL(url);

  const privateIpRegex =
    /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;
  if (privateIpRegex.test(parsedUrl.hostname)) {
    throw new Error("Forbidden target URL (Private IP)");
  }

  const res = (await fetch(url)) as any;
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
