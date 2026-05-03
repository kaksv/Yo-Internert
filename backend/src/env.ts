import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "Set JWT_SECRET (32+ chars in production)"),
  CORS_ORIGIN: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").map((x) => x.trim()) : ["*"])),
  /** mock = instant success for demos; momo = expect provider webhook */
  PAYMENT_MODE: z.enum(["mock", "momo"]).default("mock"),
  /** When true, enables POST /api/dev/complete-payment (never enable in production) */
  ENABLE_DEV_ROUTES: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}
