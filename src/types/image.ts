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

export const ImageQuerySchema = z.object({
  w: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().positive().optional()),
  h: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().positive().optional()),

  fit: z.enum(FIT_VALUES).default("cover"),

  blur: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === "true" || val === "") return true;
      const num = parseFloat(val);
      return isNaN(num) ? undefined : num;
    }),

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
  "tint",
  "flip",
  "flop",
  "rot",
];

export type ImageOptions = z.infer<typeof ImageQuerySchema>;
