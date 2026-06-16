import { pseudoRandomBytes } from "crypto";
import sharp from "sharp";

export async function applyWatermark(
  image: sharp.Sharp,
  text: string,
  options?: { opacity?: number },
) {
  const infoImage = sharp(await image.clone().toBuffer());
  const meta = await infoImage.metadata();

  const width = meta.width ?? 800;
  const height = meta.height ?? 600;

  const fontSize = Math.floor(width / 25);
  const finalFontSize = fontSize < 12 ? 12 : fontSize;

  const noiseMask = await generateMicroNoiseMask(width, height);

  const composites: sharp.OverlayOptions[] = [];

  if (text.startsWith("-")) {
    composites.push(
      {
        input: generateSVGWatermarkHard(text.slice(1), {
          width,
          height,
          opacity: options?.opacity ?? 0.1,
          fontSize: finalFontSize,
        }),
        blend: "over",
      },
      {
        input: generateMicroTextLayer(text.slice(1), width, height),
        blend: "soft-light",
      },
    );
  } else {
    composites.push({
      input: generateSVGWatermark(text, {
        width,
        height,
        opacity: options?.opacity ?? 0.1,
        fontSize: finalFontSize,
      }),
      blend: "over",
    });
  }

  composites.push({
    input: noiseMask,
    blend: "dest-in",
    raw: {
      width,
      height,
      channels: 1,
    },
  });

  const finalComposite = image.composite(composites);

  return finalComposite;
}

function generateSVGWatermarkHard(
  text: string,
  options: {
    width: number;
    height: number;
    fontSize?: number;
    opacity?: number;
  },
): Buffer {
  const { width, height, fontSize = 32, opacity = 0.1 } = options;

  const spacingX = fontSize * 5;
  const spacingY = fontSize * 2.5;

  let texts = "";

  for (let y = -height; y < height * 2; y += spacingY) {
    for (let x = -width; x < width * 2; x += spacingX) {
      const angle = -30 + Math.random() * 20;
      const localOpacity = opacity * (0.5 + Math.random());

      const size = fontSize * (0.9 + Math.random() * 0.3);

      const useWhite = Math.random() > 0.5;

      texts += `
        <text
          x="${x}"
          y="${y}"
          transform="rotate(${angle} ${x} ${y})"
          fill="${useWhite ? "white" : "black"}"
          fill-opacity="${localOpacity}"
          stroke="${useWhite ? "black" : "white"}"
          stroke-opacity="${localOpacity * 0.4}"
          stroke-width="1"
          font-size="${size}"
          font-family="Arial, sans-serif"
          font-weight="bold"
        >
          ${text}
        </text>
      `;
    }
  }

  const svg = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
  >
    ${texts}
  </svg>
  `;

  return Buffer.from(svg);
}

function generateSVGWatermark(
  text: string,
  options: {
    width: number;
    height: number;
    fontSize?: number;
    opacity?: number;
  },
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

function generateMicroTextLayer(
  text: string,
  width: number,
  height: number,
): Buffer {
  let svg = "";

  for (let y = 0; y < height; y += 40) {
    for (let x = 0; x < width; x += 120) {
      svg += `
        <text
          x="${x}"
          y="${y}"
          font-size="8"
          fill="black"
          fill-opacity="0.03"
          transform="rotate(-20 ${x} ${y})"
        >
          ${text}
        </text>
      `;
    }
  }

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${width}"
         height="${height}">
      ${svg}
    </svg>
  `);
}

async function generateMicroNoiseMask(
  width: number,
  height: number,
): Promise<Buffer> {
  const randomBuffer = pseudoRandomBytes(width * height);
  return await sharp(randomBuffer, { raw: { width, height, channels: 1 } })
    .blur(100)
    .toBuffer();
}
