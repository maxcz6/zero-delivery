import { z } from "zod";

const envSchema = z.object({
  APP_BASE_URL: z.string().url().default("http://localhost:3001"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://postgres:postgres@localhost:5433/zero_delivery"),
  SESSION_SECRET: z
    .string()
    .min(16)
    .default("dev-session-secret-change-in-production-32chars"),
  DEFAULT_TENANT_SLUG: z.string().min(1).default("zero-delivery"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./.storage"),
  VOCERO_BASE_URL: z.string().url().default("http://localhost:3000"),
  VOCERO_BOT_API_KEY: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}
