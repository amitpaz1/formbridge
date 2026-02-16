/**
 * Auth Configuration Loader
 *
 * Reads auth-related environment variables (with Docker secrets `_FILE` support)
 * and constructs an `AuthConfig` for the middleware pipeline.
 */

import { resolveSecret } from '../secrets.js';
import { InMemoryApiKeyStore } from './api-key-auth.js';
import { OAuthProvider } from './oauth-provider.js';
import { RateLimiter } from './rate-limiter.js';
import type { AuthConfig } from './middleware.js';

/**
 * Load auth configuration from environment variables.
 *
 * Env vars:
 * - `FORMBRIDGE_AUTH_ENABLED` — 'true' to enable (default: 'false')
 * - `OIDC_ISSUER` — OIDC issuer URL (required when auth enabled)
 * - `OIDC_CLIENT_ID` — OIDC audience/client ID (required when auth enabled)
 * - `OIDC_CLIENT_SECRET` — OIDC client secret (optional)
 * - `OIDC_TENANT_CLAIM` — JWT claim for tenant ID (default: 'tenant_id')
 * - `OIDC_ROLE_CLAIM` — JWT claim for role (default: 'role')
 * - `FORMBRIDGE_RATE_LIMIT` — Max requests per window (default: 100)
 * - `FORMBRIDGE_RATE_WINDOW_MS` — Window duration in ms (default: 60000)
 *
 * All sensitive vars support `_FILE` suffix for Docker secrets.
 *
 * @throws Error if auth is enabled but required vars are missing
 */
export function loadAuthConfigFromEnv(): AuthConfig {
  const enabled = process.env['FORMBRIDGE_AUTH_ENABLED'] === 'true';

  if (!enabled) {
    return { enabled: false };
  }

  // Required when auth is enabled
  const issuer = resolveSecret('OIDC_ISSUER');
  const clientId = resolveSecret('OIDC_CLIENT_ID');

  if (!issuer) {
    throw new Error(
      'FORMBRIDGE_AUTH_ENABLED=true requires OIDC_ISSUER to be set'
    );
  }
  if (!clientId) {
    throw new Error(
      'FORMBRIDGE_AUTH_ENABLED=true requires OIDC_CLIENT_ID to be set'
    );
  }

  const tenantClaim = process.env['OIDC_TENANT_CLAIM'] || 'tenant_id';
  const roleClaim = process.env['OIDC_ROLE_CLAIM'] || 'role';

  // OAuth provider
  const oauthProvider = new OAuthProvider({
    issuer,
    audience: clientId,
    tenantClaim,
    roleClaim,
  });

  // API key store
  const apiKeyStore = new InMemoryApiKeyStore();

  // Rate limiter
  const maxRequests = parseInt(process.env['FORMBRIDGE_RATE_LIMIT'] || '100', 10);
  const windowMs = parseInt(process.env['FORMBRIDGE_RATE_WINDOW_MS'] || '60000', 10);
  const rateLimiter = new RateLimiter({ maxRequests, windowMs });

  return {
    enabled: true,
    apiKeyStore,
    oauthProvider,
    rateLimiter,
    defaultRole: 'viewer',
  };
}
