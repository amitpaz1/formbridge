/**
 * OAuth 2.0 / OIDC JWT validation.
 *
 * Validates JWT tokens from external identity providers.
 * Uses the `jose` library for JWT verification.
 */

// =============================================================================
// § Types
// =============================================================================

export interface OAuthConfig {
  /** OIDC issuer URL (e.g., https://accounts.google.com) */
  issuer: string;
  /** Expected audience (client ID) */
  audience: string;
  /** JWKS URI for key retrieval (auto-derived from issuer if omitted) */
  jwksUri?: string;
  /** Claim to use as tenant ID */
  tenantClaim?: string;
  /** Claim to use as user role */
  roleClaim?: string;
}

export interface JwtClaims {
  /** Subject (user ID) */
  sub: string;
  /** Issuer */
  iss: string;
  /** Audience */
  aud: string | string[];
  /** Expiration time */
  exp: number;
  /** Issued at */
  iat: number;
  /** Tenant ID (from tenantClaim) */
  tenantId?: string;
  /** User role (from roleClaim) */
  role?: string;
  /** All raw claims */
  [key: string]: unknown;
}

export interface TokenValidationResult {
  valid: boolean;
  claims?: JwtClaims;
  error?: string;
}

// =============================================================================
// § OAuth Provider
// =============================================================================

export class OAuthProvider {
  private readonly config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Validate a JWT token.
   *
   * In production, this would use `jose` to verify the signature
   * against the provider's JWKS. For now, we do basic structural
   * validation and decode without signature verification.
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Basic JWT structure check
      const parts = token.split(".");
      if (parts.length !== 3) {
        return { valid: false, error: "Invalid JWT structure" };
      }

      // Decode payload
      const payload = JSON.parse(
        Buffer.from(parts[1]!, "base64url").toString("utf-8")
      );

      // Check required claims
      if (!payload.sub) {
        return { valid: false, error: "Missing 'sub' claim" };
      }

      if (!payload.exp) {
        return { valid: false, error: "Missing 'exp' claim" };
      }

      // Check expiration
      if (payload.exp * 1000 < Date.now()) {
        return { valid: false, error: "Token expired" };
      }

      // Check issuer
      if (payload.iss !== this.config.issuer) {
        return {
          valid: false,
          error: `Invalid issuer: expected ${this.config.issuer}, got ${payload.iss}`,
        };
      }

      // Check audience
      const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!aud.includes(this.config.audience)) {
        return { valid: false, error: "Invalid audience" };
      }

      // Extract tenant and role from configurable claims
      const tenantId = this.config.tenantClaim
        ? (payload[this.config.tenantClaim] as string)
        : undefined;
      const role = this.config.roleClaim
        ? (payload[this.config.roleClaim] as string)
        : undefined;

      const claims: JwtClaims = {
        ...payload,
        tenantId,
        role,
      };

      return { valid: true, claims };
    } catch (err) {
      return {
        valid: false,
        error: `Token validation failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  get issuer(): string {
    return this.config.issuer;
  }

  get audience(): string {
    return this.config.audience;
  }
}
