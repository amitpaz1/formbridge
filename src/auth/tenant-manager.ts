/**
 * Tenant Manager — Multi-tenancy support.
 *
 * Manages tenant CRUD and plan enforcement.
 * Tenant derived from API key or OAuth claims.
 */

// =============================================================================
// § Types
// =============================================================================

export interface Tenant {
  id: string;
  name: string;
  /** Maximum number of intakes this tenant can create */
  maxIntakes: number;
  /** Maximum number of submissions per intake */
  maxSubmissionsPerIntake: number;
  /** Maximum file upload size in bytes */
  maxFileSizeBytes: number;
  /** Whether the tenant is active */
  active: boolean;
  /** When the tenant was created */
  createdAt: string;
  /** Plan name */
  plan: TenantPlan;
}

export type TenantPlan = "free" | "starter" | "business" | "enterprise";

export interface CreateTenantRequest {
  id: string;
  name: string;
  plan?: TenantPlan;
}

// =============================================================================
// § Plan Limits
// =============================================================================

const PLAN_LIMITS: Record<TenantPlan, Pick<Tenant, "maxIntakes" | "maxSubmissionsPerIntake" | "maxFileSizeBytes">> = {
  free: {
    maxIntakes: 3,
    maxSubmissionsPerIntake: 100,
    maxFileSizeBytes: 5 * 1024 * 1024, // 5MB
  },
  starter: {
    maxIntakes: 10,
    maxSubmissionsPerIntake: 1000,
    maxFileSizeBytes: 25 * 1024 * 1024, // 25MB
  },
  business: {
    maxIntakes: 50,
    maxSubmissionsPerIntake: 10000,
    maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
  },
  enterprise: {
    maxIntakes: Infinity,
    maxSubmissionsPerIntake: Infinity,
    maxFileSizeBytes: 500 * 1024 * 1024, // 500MB
  },
};

// =============================================================================
// § Tenant Manager
// =============================================================================

export interface TenantStore {
  create(request: CreateTenantRequest): Tenant;
  get(tenantId: string): Tenant | null;
  list(): Tenant[];
  update(tenantId: string, updates: Partial<Pick<Tenant, "name" | "plan" | "active">>): Tenant | null;
  delete(tenantId: string): boolean;
}

export class InMemoryTenantStore implements TenantStore {
  private tenants = new Map<string, Tenant>();

  create(request: CreateTenantRequest): Tenant {
    if (this.tenants.has(request.id)) {
      throw new Error(`Tenant '${request.id}' already exists`);
    }

    const plan = request.plan ?? "free";
    const limits = PLAN_LIMITS[plan];

    const tenant: Tenant = {
      id: request.id,
      name: request.name,
      maxIntakes: limits.maxIntakes,
      maxSubmissionsPerIntake: limits.maxSubmissionsPerIntake,
      maxFileSizeBytes: limits.maxFileSizeBytes,
      active: true,
      createdAt: new Date().toISOString(),
      plan,
    };

    this.tenants.set(request.id, tenant);
    return tenant;
  }

  get(tenantId: string): Tenant | null {
    return this.tenants.get(tenantId) ?? null;
  }

  list(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  update(
    tenantId: string,
    updates: Partial<Pick<Tenant, "name" | "plan" | "active">>
  ): Tenant | null {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return null;

    if (updates.name != null) tenant.name = updates.name;
    if (updates.active != null) tenant.active = updates.active;
    if (updates.plan != null) {
      tenant.plan = updates.plan;
      const limits = PLAN_LIMITS[updates.plan];
      tenant.maxIntakes = limits.maxIntakes;
      tenant.maxSubmissionsPerIntake = limits.maxSubmissionsPerIntake;
      tenant.maxFileSizeBytes = limits.maxFileSizeBytes;
    }

    return tenant;
  }

  delete(tenantId: string): boolean {
    return this.tenants.delete(tenantId);
  }
}

/**
 * Get the plan limits for a given plan.
 */
export function getPlanLimits(plan: TenantPlan) {
  return { ...PLAN_LIMITS[plan] };
}
