import sharp from "sharp";

export function extractScale(path: string): { cleanPath: string; scale: number } {
  const match = path.match(/@([23])x(?=\.)/);
  if (!match) return { cleanPath: path, scale: 1 };

  return {
    cleanPath: path.replace(/@([23])x/, ""),
    scale: parseInt(match[1], 10),
  };
}

export function resizeForScale(
  img: sharp.Sharp,
  baseWidth?: number,
  scale = 1
) {
  if (!baseWidth) return img;
  return img.resize({ width: baseWidth * scale });
}