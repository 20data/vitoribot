import { envSchema } from '@vitoribot/types';

export function loadEnv(): void {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment variables: ${details}`);
  }
}
