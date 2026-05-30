import sharp from "sharp";

export async function applyWatermark(
  image: sharp.Sharp,
  text: string,
  options?: { opacity?: number; }
) {
  const infoImage = sharp(await image.clone().toBuffer());
  const meta = await infoImage.metadata();

  const width = meta.width ?? 800;
  const height = meta.height ?? 600;

  const fontSize = Math.floor(width / 20);
  const finalFontSize = fontSize < 14 ? 14 : fontSize;

  const svgBuffer = generateSVGWatermark(text, {
    width,
    height,
    opacity: options?.opacity ?? 0.1,
    fontSize: finalFontSize,
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
  }
): Buffer {
  const { width, height, fontSize, opacity } = options;

  const patternWidth = text.length * fontSize * 0.6 + 20;
  const patternHeight = fontSize * 4 - 10;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <pattern id="watermark-pattern" width="${patternWidth}" height="${patternHeight}" patternUnits="userSpaceOnUse">
          <text 
            x="${patternWidth / 2}" 
            y="${patternHeight / 2}" 
            fill="black" 
            fill-opacity="${opacity}" 
            font-size="${fontSize}" 
            font-family="Arial, sans-serif"
            text-anchor="middle"
            dominant-baseline="central"
            transform="rotate(-30 ${patternWidth / 2} ${patternHeight / 2})"
          >
            ${text}
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#watermark-pattern)" />
    </svg>
  `;

  return Buffer.from(svg);
}