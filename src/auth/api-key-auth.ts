/**
 * API Key Authentication
 *
 * - CRUD for API keys with SHA-256 hashing at rest
 * - Keys scoped per intake + operation
 * - Format: fb_key_<uuid>
 */

import { createHash, randomUUID } from "node:crypto";

// =============================================================================
// § Types
// =============================================================================

export interface ApiKey {
  /** SHA-256 hash of the key (stored at rest) */
  keyHash: string;
  /** Human-readable label */
  name: string;
  /** Tenant this key belongs to */
  tenantId: string;
  /** Intakes this key can access (empty = all) */
  intakeScopes: string[];
  /** Operations this key can perform */
  operations: ApiKeyOperation[];
  /** When the key was created */
  createdAt: string;
  /** When the key expires (optional) */
  expiresAt?: string;
  /** Whether the key is active */
  active: boolean;
}

export type ApiKeyOperation = "read" | "write" | "approve" | "admin";

export interface CreateApiKeyRequest {
  name: string;
  tenantId: string;
  intakeScopes?: string[];
  operations: ApiKeyOperation[];
  expiresAt?: string;
}

export interface CreateApiKeyResult {
  /** The raw key — only returned once at creation time */
  rawKey: string;
  /** The key hash (used for lookups) */
  keyHash: string;
  /** The created key metadata */
  key: ApiKey;
}

// =============================================================================
// § Key Utilities
// =============================================================================

const KEY_PREFIX = "fb_key_";

/**
 * Generate a new API key string.
 */
export function generateApiKey(): string {
  return `${KEY_PREFIX}${randomUUID()}`;
}

/**
 * Hash an API key using SHA-256.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Check if a string looks like a FormBridge API key.
 */
export function isFormBridgeApiKey(key: string): boolean {
  return key.startsWith(KEY_PREFIX);
}

// =============================================================================
// § API Key Store
// =============================================================================

export interface ApiKeyStore {
  create(request: CreateApiKeyRequest): CreateApiKeyResult;
  getByHash(keyHash: string): ApiKey | null;
  listByTenant(tenantId: string): ApiKey[];
  revoke(keyHash: string): boolean;
  isAuthorized(
    keyHash: string,
    intakeId: string,
    operation: ApiKeyOperation
  ): boolean;
}

/**
 * In-memory API key store.
 */
export class InMemoryApiKeyStore implements ApiKeyStore {
  private keys = new Map<string, ApiKey>();

  create(request: CreateApiKeyRequest): CreateApiKeyResult {
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);

    const key: ApiKey = {
      keyHash,
      name: request.name,
      tenantId: request.tenantId,
      intakeScopes: request.intakeScopes ?? [],
      operations: request.operations,
      createdAt: new Date().toISOString(),
      expiresAt: request.expiresAt,
      active: true,
    };

    this.keys.set(keyHash, key);

    return { rawKey, keyHash, key };
  }

  getByHash(keyHash: string): ApiKey | null {
    return this.keys.get(keyHash) ?? null;
  }

  listByTenant(tenantId: string): ApiKey[] {
    return Array.from(this.keys.values()).filter(
      (k) => k.tenantId === tenantId
    );
  }

  revoke(keyHash: string): boolean {
    const key = this.keys.get(keyHash);
    if (!key) return false;
    key.active = false;
    return true;
  }

  isAuthorized(
    keyHash: string,
    intakeId: string,
    operation: ApiKeyOperation
  ): boolean {
    const key = this.keys.get(keyHash);
    if (!key) return false;
    if (!key.active) return false;

    // Check expiration
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return false;
    }

    // Check operation scope
    if (!key.operations.includes(operation) && !key.operations.includes("admin")) {
      return false;
    }

    // Check intake scope (empty = all intakes)
    if (key.intakeScopes.length > 0 && !key.intakeScopes.includes(intakeId)) {
      return false;
    }

    return true;
  }
}
