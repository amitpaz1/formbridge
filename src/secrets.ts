/**
 * Docker Secrets Support (`_FILE` suffix pattern)
 *
 * Resolves environment variables with support for Docker secrets.
 * When `ENV_NAME_FILE` is set, reads the file contents instead of `ENV_NAME`.
 * `_FILE` variant takes precedence over plain env var.
 */

import { readFileSync } from 'node:fs';

/**
 * Resolve a secret from environment variables with `_FILE` suffix support.
 *
 * Checks `<name>_FILE` first — if set, reads the file at that path (trimmed).
 * Falls back to plain `<name>` env var.
 *
 * @param name - Environment variable name (e.g., 'FORMBRIDGE_API_KEY')
 * @returns The resolved value, or undefined if neither is set
 * @throws Error if `_FILE` is set but the file cannot be read
 */
export function resolveSecret(name: string): string | undefined {
  const filePath = process.env[`${name}_FILE`];

  if (filePath) {
    try {
      return readFileSync(filePath, 'utf-8').trim();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to read secret file for ${name}_FILE (${filePath}): ${message}`
      );
    }
  }

  return process.env[name];
}
