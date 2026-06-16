import { z } from "zod";

export const SUPPORTED_FORMATS = [
  "webp",
  "png",
  "avif",
  "jpeg",
  "jpg",
  "gif",
] as const;

export const FIT_VALUES = [
  "contain",
  "cover",
  "fill",
  "inside",
  "outside",
] as const;
export const STRATEGY_VALUES = ["entropy", "attention"] as const;
export type ImageFormat = (typeof SUPPORTED_FORMATS)[number];

export class InvalidImageOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageOperationError";
  }
}

export const ImageQuerySchema = z.object({
  w: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().positive().max(2000).optional()),

  h: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().positive().max(2000).optional()),

  fit: z.enum(FIT_VALUES).default("cover"),

  blur: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .pipe(z.number().positive().min(0.3).max(1000).optional()),

  grayscale: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  tint: z
    .string()
    .optional()
    .refine((v) => !v || /^#[0-9A-F]{6}$/i.test(v), {
      message:
        "Le format de la couleur de teinte doit être un Hex valide (ex: #FF0000)",
    }),

  negate: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  negateAlpha: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  placeholder: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  strategy: z.enum(STRATEGY_VALUES).optional(),

  format: z.enum(SUPPORTED_FORMATS).optional(),

  quality: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().min(1).max(100).optional()),

  scale: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .pipe(z.number().positive().optional()),

  flip: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  flop: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  rot: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined)),

  extend: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined)),

  extendBg: z
    .string()
    .optional()
    .refine((v) => !v || /^#[0-9A-F]{6}$/i.test(v), {
      message:
        "Le format de la couleur de teinte doit être un Hex valide (ex: #FF0000)",
    }),

  extract: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const parts = v.split(",");
        return (
          parts.length === 4 &&
          parts.every((p) => !isNaN(Number(p)) && p.trim() !== "")
        );
      },
      {
        message:
          "Le format d'extraction doit être strictly top,left,width,height (ex: 10,20,200,300)",
      },
    )
    .transform((v) => {
      if (!v) return undefined;
      const [top, left, width, height] = v.split(",").map(Number);
      return { top, left, width, height };
    }),

  trim: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined)),

  trimBg: z
    .string()
    .optional()
    .refine((v) => !v || /^#[0-9A-F]{6}$/i.test(v), {
      message:
        "Le format de la couleur de teinte doit être un Hex valide (ex: #FF0000)",
    }),

  linear: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const [a, b] = v.split(",").map(Number);
      return { a, b };
    }),

  modulate: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const [b, s, h] = v.split(",").map(Number);
      return { brightness: b, saturation: s, hue: h };
    }),

  watermark: z.string().optional(),
});

export const sharpParams = [
  "w",
  "h",
  "quality",
  "blur",
  "grayscale",
  "fit",
  "watermark",
  "format",
  "strategy",
  "placeholder",
  "negate",
  "negateAlpha",
  "tint",
  "flip",
  "flop",
  "rot",
  "extend",
  "extendBg",
  "extract",
  "trim",
  "trimBg",
  "linear",
  "modulate"
];

export function getOutputFormat(path: string): ImageFormat {
  const ext = path.split(".").pop()?.toLowerCase();

  if (!SUPPORTED_FORMATS.includes(ext as ImageFormat)) {
    throw new Error("Unsupported output format");
  }

  return ext as ImageFormat;
}

export type ImageOptions = z.infer<typeof ImageQuerySchema>;
