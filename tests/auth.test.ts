/**
 * Feature 023 — Auth, Authorization & Multi-Tenancy Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryApiKeyStore,
  generateApiKey,
  hashApiKey,
  isFormBridgeApiKey,
} from "../src/auth/api-key-auth.js";
import { OAuthProvider } from "../src/auth/oauth-provider.js";
import {
  hasPermission,
  getPermissions,
  getRoles,
  isValidRole,
  isRoleAtLeast,
} from "../src/auth/rbac.js";
import {
  InMemoryTenantStore,
  getPlanLimits,
} from "../src/auth/tenant-manager.js";
import { RateLimiter } from "../src/auth/rate-limiter.js";
import { createAuthMiddleware, requirePermission } from "../src/auth/middleware.js";
import { Hono } from "hono";

// =============================================================================
// § API Key Auth Tests
// =============================================================================

describe("API Key Auth", () => {
  let store: InMemoryApiKeyStore;

  beforeEach(() => {
    store = new InMemoryApiKeyStore();
  });

  it("should generate keys with fb_key_ prefix", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^fb_key_/);
    expect(isFormBridgeApiKey(key)).toBe(true);
  });

  it("should hash keys with SHA-256", () => {
    const key = "fb_key_test-key";
    const hash = hashApiKey(key);
    expect(hash).toHaveLength(64); // SHA-256 hex length
    // Same input should produce same hash
    expect(hashApiKey(key)).toBe(hash);
  });

  it("should reject non-FormBridge keys", () => {
    expect(isFormBridgeApiKey("random-string")).toBe(false);
    expect(isFormBridgeApiKey("Bearer token")).toBe(false);
  });

  it("should create and retrieve API keys", () => {
    const result = store.create({
      name: "Test Key",
      tenantId: "tenant-1",
      operations: ["read", "write"],
    });

    expect(result.rawKey).toMatch(/^fb_key_/);
    expect(result.keyHash).toBeTruthy();

    const retrieved = store.getByHash(result.keyHash);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe("Test Key");
    expect(retrieved!.tenantId).toBe("tenant-1");
    expect(retrieved!.active).toBe(true);
  });

  it("should list keys by tenant", () => {
    store.create({ name: "Key 1", tenantId: "t1", operations: ["read"] });
    store.create({ name: "Key 2", tenantId: "t1", operations: ["write"] });
    store.create({ name: "Key 3", tenantId: "t2", operations: ["read"] });

    const t1Keys = store.listByTenant("t1");
    expect(t1Keys).toHaveLength(2);

    const t2Keys = store.listByTenant("t2");
    expect(t2Keys).toHaveLength(1);
  });

  it("should revoke keys", () => {
    const result = store.create({
      name: "Revocable",
      tenantId: "t1",
      operations: ["read"],
    });

    expect(store.revoke(result.keyHash)).toBe(true);
    const key = store.getByHash(result.keyHash);
    expect(key!.active).toBe(false);
  });

  it("should authorize keys by operation and scope", () => {
    const result = store.create({
      name: "Scoped",
      tenantId: "t1",
      intakeScopes: ["intake-a"],
      operations: ["read"],
    });

    // Authorized: correct intake + operation
    expect(store.isAuthorized(result.keyHash, "intake-a", "read")).toBe(true);

    // Not authorized: wrong operation
    expect(store.isAuthorized(result.keyHash, "intake-a", "write")).toBe(false);

    // Not authorized: wrong intake
    expect(store.isAuthorized(result.keyHash, "intake-b", "read")).toBe(false);
  });

  it("should allow admin operations on all intakes", () => {
    const result = store.create({
      name: "Admin",
      tenantId: "t1",
      operations: ["admin"],
    });

    expect(store.isAuthorized(result.keyHash, "any-intake", "read")).toBe(true);
    expect(store.isAuthorized(result.keyHash, "any-intake", "write")).toBe(true);
    expect(store.isAuthorized(result.keyHash, "any-intake", "approve")).toBe(true);
  });

  it("should reject revoked keys", () => {
    const result = store.create({
      name: "ToRevoke",
      tenantId: "t1",
      operations: ["read"],
    });

    store.revoke(result.keyHash);
    expect(store.isAuthorized(result.keyHash, "intake", "read")).toBe(false);
  });

  it("should reject expired keys", () => {
    const result = store.create({
      name: "Expired",
      tenantId: "t1",
      operations: ["read"],
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    expect(store.isAuthorized(result.keyHash, "intake", "read")).toBe(false);
  });

  it("should allow keys with empty intake scopes on any intake", () => {
    const result = store.create({
      name: "Global",
      tenantId: "t1",
      intakeScopes: [],
      operations: ["read"],
    });

    expect(store.isAuthorized(result.keyHash, "any-intake", "read")).toBe(true);
  });
});

// =============================================================================
// § OAuth Provider Tests
// =============================================================================

describe("OAuth Provider", () => {
  function createJwt(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${header}.${body}.fake-signature`;
  }

  const provider = new OAuthProvider({
    issuer: "https://auth.example.com",
    audience: "formbridge-api",
    tenantClaim: "org_id",
    roleClaim: "role",
  });

  it("should validate a valid JWT", async () => {
    const token = createJwt({
      sub: "user-1",
      iss: "https://auth.example.com",
      aud: "formbridge-api",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      org_id: "tenant-1",
      role: "admin",
    });

    const result = await provider.validateToken(token);
    expect(result.valid).toBe(true);
    expect(result.claims?.sub).toBe("user-1");
    expect(result.claims?.tenantId).toBe("tenant-1");
    expect(result.claims?.role).toBe("admin");
  });

  it("should reject expired tokens", async () => {
    const token = createJwt({
      sub: "user-1",
      iss: "https://auth.example.com",
      aud: "formbridge-api",
      exp: Math.floor(Date.now() / 1000) - 60, // expired
      iat: Math.floor(Date.now() / 1000) - 3660,
    });

    const result = await provider.validateToken(token);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("expired");
  });

  it("should reject wrong issuer", async () => {
    const token = createJwt({
      sub: "user-1",
      iss: "https://other.example.com",
      aud: "formbridge-api",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const result = await provider.validateToken(token);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("issuer");
  });

  it("should reject wrong audience", async () => {
    const token = createJwt({
      sub: "user-1",
      iss: "https://auth.example.com",
      aud: "wrong-audience",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const result = await provider.validateToken(token);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("audience");
  });

  it("should reject invalid JWT structure", async () => {
    const result = await provider.validateToken("not-a-jwt");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("structure");
  });

  it("should reject tokens missing sub claim", async () => {
    const token = createJwt({
      iss: "https://auth.example.com",
      aud: "formbridge-api",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const result = await provider.validateToken(token);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("sub");
  });

  it("should expose issuer and audience", () => {
    expect(provider.issuer).toBe("https://auth.example.com");
    expect(provider.audience).toBe("formbridge-api");
  });
});

// =============================================================================
// § RBAC Tests
// =============================================================================

describe("RBAC", () => {
  it("should have 3 roles", () => {
    const roles = getRoles();
    expect(roles).toContain("admin");
    expect(roles).toContain("reviewer");
    expect(roles).toContain("viewer");
    expect(roles).toHaveLength(3);
  });

  it("admin should have all permissions", () => {
    const perms = getPermissions("admin");
    expect(perms.length).toBeGreaterThan(10);
    expect(hasPermission("admin", "intake:read")).toBe(true);
    expect(hasPermission("admin", "intake:write")).toBe(true);
    expect(hasPermission("admin", "submission:delete")).toBe(true);
    expect(hasPermission("admin", "apikey:write")).toBe(true);
  });

  it("reviewer should read and approve but not write intakes", () => {
    expect(hasPermission("reviewer", "intake:read")).toBe(true);
    expect(hasPermission("reviewer", "approval:approve")).toBe(true);
    expect(hasPermission("reviewer", "approval:reject")).toBe(true);
    expect(hasPermission("reviewer", "intake:write")).toBe(false);
    expect(hasPermission("reviewer", "submission:write")).toBe(false);
  });

  it("viewer should only read", () => {
    expect(hasPermission("viewer", "intake:read")).toBe(true);
    expect(hasPermission("viewer", "submission:read")).toBe(true);
    expect(hasPermission("viewer", "approval:approve")).toBe(false);
    expect(hasPermission("viewer", "intake:write")).toBe(false);
    expect(hasPermission("viewer", "apikey:write")).toBe(false);
  });

  it("should validate role strings", () => {
    expect(isValidRole("admin")).toBe(true);
    expect(isValidRole("reviewer")).toBe(true);
    expect(isValidRole("viewer")).toBe(true);
    expect(isValidRole("superuser")).toBe(false);
    expect(isValidRole("")).toBe(false);
  });

  it("should compare role levels", () => {
    expect(isRoleAtLeast("admin", "admin")).toBe(true);
    expect(isRoleAtLeast("admin", "reviewer")).toBe(true);
    expect(isRoleAtLeast("admin", "viewer")).toBe(true);
    expect(isRoleAtLeast("reviewer", "viewer")).toBe(true);
    expect(isRoleAtLeast("reviewer", "admin")).toBe(false);
    expect(isRoleAtLeast("viewer", "reviewer")).toBe(false);
  });
});

// =============================================================================
// § Tenant Manager Tests
// =============================================================================

describe("Tenant Manager", () => {
  let tenantStore: InMemoryTenantStore;

  beforeEach(() => {
    tenantStore = new InMemoryTenantStore();
  });

  it("should create tenant with default plan", () => {
    const tenant = tenantStore.create({ id: "t1", name: "Acme Corp" });
    expect(tenant.id).toBe("t1");
    expect(tenant.name).toBe("Acme Corp");
    expect(tenant.plan).toBe("free");
    expect(tenant.active).toBe(true);
  });

  it("should apply plan limits", () => {
    const free = tenantStore.create({ id: "t1", name: "Free", plan: "free" });
    expect(free.maxIntakes).toBe(3);

    const biz = tenantStore.create({ id: "t2", name: "Business", plan: "business" });
    expect(biz.maxIntakes).toBe(50);
  });

  it("should get tenant by ID", () => {
    tenantStore.create({ id: "t1", name: "Test" });
    const tenant = tenantStore.get("t1");
    expect(tenant).not.toBeNull();
    expect(tenant!.name).toBe("Test");
  });

  it("should return null for missing tenant", () => {
    expect(tenantStore.get("nonexistent")).toBeNull();
  });

  it("should list tenants", () => {
    tenantStore.create({ id: "t1", name: "One" });
    tenantStore.create({ id: "t2", name: "Two" });
    expect(tenantStore.list()).toHaveLength(2);
  });

  it("should update tenant", () => {
    tenantStore.create({ id: "t1", name: "Old Name", plan: "free" });
    const updated = tenantStore.update("t1", { name: "New Name", plan: "business" });
    expect(updated!.name).toBe("New Name");
    expect(updated!.plan).toBe("business");
    expect(updated!.maxIntakes).toBe(50);
  });

  it("should deactivate tenant", () => {
    tenantStore.create({ id: "t1", name: "Test" });
    tenantStore.update("t1", { active: false });
    const tenant = tenantStore.get("t1");
    expect(tenant!.active).toBe(false);
  });

  it("should delete tenant", () => {
    tenantStore.create({ id: "t1", name: "Test" });
    expect(tenantStore.delete("t1")).toBe(true);
    expect(tenantStore.get("t1")).toBeNull();
  });

  it("should prevent duplicate tenant IDs", () => {
    tenantStore.create({ id: "t1", name: "First" });
    expect(() => tenantStore.create({ id: "t1", name: "Second" })).toThrow(
      "already exists"
    );
  });

  it("should expose plan limits", () => {
    const limits = getPlanLimits("enterprise");
    expect(limits.maxIntakes).toBe(Infinity);
    expect(limits.maxFileSizeBytes).toBe(500 * 1024 * 1024);
  });
});

// =============================================================================
// § Rate Limiter Tests
// =============================================================================

describe("Rate Limiter", () => {
  it("should allow requests within limit", () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });

    for (let i = 0; i < 5; i++) {
      const result = limiter.check("key1");
      expect(result.allowed).toBe(true);
    }
  });

  it("should reject requests over limit", () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60000 });

    limiter.check("key1");
    limiter.check("key1");
    limiter.check("key1");

    const result = limiter.check("key1");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should track remaining count", () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });

    const r1 = limiter.check("key1");
    expect(r1.remaining).toBe(4);

    const r2 = limiter.check("key1");
    expect(r2.remaining).toBe(3);
  });

  it("should isolate keys", () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60000 });

    limiter.check("key1");
    limiter.check("key1");

    // key2 should still be allowed
    const result = limiter.check("key2");
    expect(result.allowed).toBe(true);
  });

  it("should reset key", () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60000 });

    limiter.check("key1");
    expect(limiter.check("key1").allowed).toBe(false);

    limiter.reset("key1");
    expect(limiter.check("key1").allowed).toBe(true);
  });

  it("should include rate limit headers info", () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
    const result = limiter.check("key1");
    expect(result.limit).toBe(10);
    expect(result.resetAt).toBeGreaterThan(Date.now() - 1000);
  });
});

// =============================================================================
// § Auth Middleware Tests
// =============================================================================

describe("Auth Middleware", () => {
  it("should pass through when auth is disabled", async () => {
    const app = new Hono();
    app.use("*", createAuthMiddleware({ enabled: false }));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should reject requests without auth header", async () => {
    const app = new Hono();
    app.use("*", createAuthMiddleware({ enabled: true }));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });

  it("should authenticate with valid API key", async () => {
    const keyStore = new InMemoryApiKeyStore();
    const { rawKey } = keyStore.create({
      name: "Test",
      tenantId: "t1",
      operations: ["read"],
    });

    const app = new Hono();
    app.use("*", createAuthMiddleware({
      enabled: true,
      apiKeyStore: keyStore,
    }));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { Authorization: `Bearer ${rawKey}` },
    });
    expect(res.status).toBe(200);
  });

  it("should reject invalid API key", async () => {
    const keyStore = new InMemoryApiKeyStore();

    const app = new Hono();
    app.use("*", createAuthMiddleware({
      enabled: true,
      apiKeyStore: keyStore,
    }));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { Authorization: "Bearer fb_key_invalid" },
    });
    expect(res.status).toBe(401);
  });

  it("should enforce rate limits", async () => {
    const keyStore = new InMemoryApiKeyStore();
    const { rawKey } = keyStore.create({
      name: "Test",
      tenantId: "t1",
      operations: ["read"],
    });

    const rateLimiter = new RateLimiter({ maxRequests: 2, windowMs: 60000 });

    const app = new Hono();
    app.use("*", createAuthMiddleware({
      enabled: true,
      apiKeyStore: keyStore,
      rateLimiter,
    }));
    app.get("/test", (c) => c.json({ ok: true }));

    const headers = { Authorization: `Bearer ${rawKey}` };

    // First 2 should succeed
    expect((await app.request("/test", { headers })).status).toBe(200);
    expect((await app.request("/test", { headers })).status).toBe(200);

    // Third should be rate limited
    const res = await app.request("/test", { headers });
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error.type).toBe("rate_limited");
  });

  it("should set rate limit headers", async () => {
    const keyStore = new InMemoryApiKeyStore();
    const { rawKey } = keyStore.create({
      name: "Test",
      tenantId: "t1",
      operations: ["read"],
    });

    const rateLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });

    const app = new Hono();
    app.use("*", createAuthMiddleware({
      enabled: true,
      apiKeyStore: keyStore,
      rateLimiter,
    }));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined();
    expect(res.headers.get("X-RateLimit-Reset")).toBeDefined();
  });
});

// =============================================================================
// § Permission Middleware Tests
// =============================================================================

describe("Permission Middleware", () => {
  it("should allow admin to access admin routes", async () => {
    const keyStore = new InMemoryApiKeyStore();
    const { rawKey } = keyStore.create({
      name: "Admin",
      tenantId: "t1",
      operations: ["admin"],
    });

    const app = new Hono();
    app.use("*", createAuthMiddleware({
      enabled: true,
      apiKeyStore: keyStore,
    }));
    app.get("/admin", requirePermission("tenant:write"), (c) =>
      c.json({ ok: true })
    );

    const res = await app.request("/admin", {
      headers: { Authorization: `Bearer ${rawKey}` },
    });
    expect(res.status).toBe(200);
  });

  it("should reject viewer from write routes", async () => {
    const keyStore = new InMemoryApiKeyStore();
    const { rawKey } = keyStore.create({
      name: "Viewer",
      tenantId: "t1",
      operations: ["read"],
    });

    const app = new Hono();
    app.use("*", createAuthMiddleware({
      enabled: true,
      apiKeyStore: keyStore,
    }));
    app.post("/write", requirePermission("intake:write"), (c) =>
      c.json({ ok: true })
    );

    const res = await app.request("/write", {
      method: "POST",
      headers: { Authorization: `Bearer ${rawKey}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error.type).toBe("forbidden");
  });

  it("should reject unauthenticated requests", async () => {
    const app = new Hono();
    app.use("*", createAuthMiddleware({ enabled: true }));
    app.get("/protected", requirePermission("intake:read"), (c) =>
      c.json({ ok: true })
    );

    const res = await app.request("/protected");
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// § Disabled Auth Mode
// =============================================================================

describe("Disabled Auth Mode", () => {
  it("should grant admin role when disabled", async () => {
    const app = new Hono();
    app.use("*", createAuthMiddleware({ enabled: false }));
    app.get("/admin", requirePermission("tenant:write"), (c) =>
      c.json({ ok: true })
    );

    const res = await app.request("/admin");
    expect(res.status).toBe(200);
  });

  it("should set default tenant when disabled", async () => {
    const app = new Hono();
    app.use("*", createAuthMiddleware({ enabled: false }));
    app.get("/test", (c) => {
      const auth = c.get("formbridge-auth") as any;
      return c.json({ tenantId: auth?.tenantId });
    });

    const res = await app.request("/test");
    const body = await res.json() as any;
    expect(body.tenantId).toBe("default");
  });
});
