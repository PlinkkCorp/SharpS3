import fs from "fs/promises";
import sharp from "sharp";

let watermarkBuffer: Buffer | null = null;

type WatermarkOptions = {
  position?: "center" | "bottom-right" | "bottom-left" | "top-right";
  opacity?: number;
  scale?: number;
};


export async function applyWatermark(
  image: sharp.Sharp,
  text: string,
  options?: { opacity?: number; repeat?: number }
) {
  const meta = await image.metadata();

  // Génère SVG basé sur la taille de l'image
  const svgBuffer = generateSVGWatermark(text, {
    width: meta.width!,
    height: meta.height!,
    opacity: options?.opacity ?? 0.1,
    repeat: options?.repeat ?? 10,
    rotate: -45,
    fontSize: Math.floor((meta.width ?? 500) / 20),
  });

  return image.composite([
    {
      input: svgBuffer,
      blend: "over",
    },
  ]);
}

function generateSVGWatermark(
  text: string,
  options: {
    width: number;
    height: number;
    fontSize?: number;
    opacity?: number;
    rotate?: number;
    repeat?: number;
  } = { width: 500, height: 500, fontSize: 36, opacity: 0.1, rotate: -45, repeat: 5 }
): Buffer {
  const { width, height, fontSize, opacity, rotate, repeat } = options;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;

  for (let i = 0; i < repeat!; i++) {
    for (let j = 0; j < repeat!; j++) {
      const x = i * fontSize! * 6;
      const y = j * fontSize! * 6;
      svg += `<text x="${x}" y="${y}" fill="black" fill-opacity="${opacity}" font-size="${fontSize}" transform="rotate(${rotate} ${x} ${y})" font-family="Arial, sans-serif">${text}</text>`;
    }
  }

  svg += "</svg>";

  return Buffer.from(svg);
}