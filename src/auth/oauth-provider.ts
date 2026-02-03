/**
 * OAuth 2.0 / OIDC JWT validation.
 *
 * Validates JWT tokens from external identity providers using proper
 * cryptographic signature verification via JWKS (JSON Web Key Sets).
 *
 * Security: Uses the `jose` library for JWT verification against the
 * provider's published public keys. Never accepts unsigned or
 * unverified tokens.
 */

import * as jose from "jose";

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
  /**
   * Allowed signing algorithms. Defaults to RS256, ES256.
   * IMPORTANT: Never include 'none' or symmetric algorithms like HS256
   * unless you have a specific use case and understand the risks.
   */
  allowedAlgorithms?: string[];
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

// Default allowed algorithms - asymmetric only (RS256, ES256, etc.)
// SECURITY: Never include 'none' or HS256 (symmetric) by default
const DEFAULT_ALLOWED_ALGORITHMS = [
  "RS256",
  "RS384",
  "RS512",
  "ES256",
  "ES384",
  "ES512",
  "PS256",
  "PS384",
  "PS512",
];

// =============================================================================
// § OAuth Provider
// =============================================================================

export class OAuthProvider {
  private readonly config: OAuthConfig;
  private jwks: jose.JWTVerifyGetKey | null = null;
  private readonly allowedAlgorithms: string[];

  constructor(config: OAuthConfig) {
    this.config = config;
    this.allowedAlgorithms =
      config.allowedAlgorithms ?? DEFAULT_ALLOWED_ALGORITHMS;

    // Validate that 'none' algorithm is never allowed
    if (this.allowedAlgorithms.includes("none")) {
      throw new Error(
        "Security error: 'none' algorithm is not allowed for JWT verification"
      );
    }
  }

  /**
   * Get the JWKS (JSON Web Key Set) for signature verification.
   * Lazily initialized and cached.
   */
  private async getJwks(): Promise<jose.JWTVerifyGetKey> {
    if (this.jwks) {
      return this.jwks;
    }

    // Derive JWKS URI from issuer if not provided
    const jwksUri =
      this.config.jwksUri ??
      `${this.config.issuer.replace(/\/$/, "")}/.well-known/jwks.json`;

    // Create remote JWKS with caching
    this.jwks = jose.createRemoteJWKSet(new URL(jwksUri), {
      // Cache keys for 10 minutes
      cooldownDuration: 10 * 60 * 1000,
      // Refresh if key not found (rotation support)
      cacheMaxAge: 10 * 60 * 1000,
    });

    return this.jwks;
  }

  /**
   * Validate a JWT token with full cryptographic signature verification.
   *
   * Security guarantees:
   * - Verifies signature against provider's JWKS public keys
   * - Validates issuer, audience, and expiration
   * - Rejects unsigned tokens ('none' algorithm)
   * - Rejects tokens with mismatched claims
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Basic JWT structure check (3 parts separated by dots)
      const parts = token.split(".");
      if (parts.length !== 3) {
        return { valid: false, error: "Invalid JWT structure" };
      }

      // Get JWKS for signature verification
      const jwks = await this.getJwks();

      // Verify the token with full cryptographic validation
      const { payload } = await jose.jwtVerify(token, jwks, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: this.allowedAlgorithms,
      });

      // Check required claims
      if (!payload.sub || typeof payload.sub !== "string") {
        return { valid: false, error: "Missing or invalid 'sub' claim" };
      }

      // Extract tenant and role from configurable claims
      const tenantId = this.config.tenantClaim
        ? (payload[this.config.tenantClaim] as string | undefined)
        : undefined;
      const role = this.config.roleClaim
        ? (payload[this.config.roleClaim] as string | undefined)
        : undefined;

      const claims: JwtClaims = {
        sub: payload.sub,
        iss: payload.iss as string,
        aud: payload.aud as string | string[],
        exp: payload.exp as number,
        iat: payload.iat as number,
        ...payload,
        tenantId,
        role,
      };

      return { valid: true, claims };
    } catch (err) {
      // Handle specific jose errors for better error messages
      if (err instanceof jose.errors.JWTExpired) {
        return { valid: false, error: "Token expired" };
      }
      if (err instanceof jose.errors.JWTClaimValidationFailed) {
        return { valid: false, error: `Claim validation failed: ${err.message}` };
      }
      if (err instanceof jose.errors.JWSSignatureVerificationFailed) {
        return { valid: false, error: "Invalid signature" };
      }
      if (err instanceof jose.errors.JWKSNoMatchingKey) {
        return { valid: false, error: "No matching key found in JWKS" };
      }
      if (err instanceof jose.errors.JOSEAlgNotAllowed) {
        return { valid: false, error: "Algorithm not allowed" };
      }

      return {
        valid: false,
        error: `Token validation failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Clear the cached JWKS (useful for testing or key rotation).
   */
  clearJwksCache(): void {
    this.jwks = null;
  }

  get issuer(): string {
    return this.config.issuer;
  }

  get audience(): string {
    return this.config.audience;
  }
}
