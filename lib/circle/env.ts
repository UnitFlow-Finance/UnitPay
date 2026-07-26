import "server-only";

/**
 * Central place to read Circle-related server env vars, with clear errors
 * if something required is missing at request time (rather than silently
 * producing malformed API calls).
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See README for setup instructions.`,
    );
  }
  return value;
}

export const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? "";
