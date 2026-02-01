/**
 * Branded Types for Domain IDs
 *
 * Uses TypeScript's structural typing escape hatch to create nominal types
 * that prevent accidental mixing of different ID types at compile time.
 * Each branded type is still a string at runtime but distinct in the type system.
 */

// =============================================================================
// § Brand Symbols (unique per type)
// =============================================================================

declare const SubmissionIdBrand: unique symbol;
declare const IntakeIdBrand: unique symbol;
declare const ResumeTokenBrand: unique symbol;
declare const EventIdBrand: unique symbol;
declare const DeliveryIdBrand: unique symbol;
declare const TenantIdBrand: unique symbol;
declare const KeyHashBrand: unique symbol;
declare const UploadIdBrand: unique symbol;

// =============================================================================
// § Branded Types
// =============================================================================

export type SubmissionId = string & { readonly __brand: typeof SubmissionIdBrand };
export type IntakeId = string & { readonly __brand: typeof IntakeIdBrand };
export type ResumeToken = string & { readonly __brand: typeof ResumeTokenBrand };
export type EventId = string & { readonly __brand: typeof EventIdBrand };
export type DeliveryId = string & { readonly __brand: typeof DeliveryIdBrand };
export type TenantId = string & { readonly __brand: typeof TenantIdBrand };
export type KeyHash = string & { readonly __brand: typeof KeyHashBrand };
export type UploadId = string & { readonly __brand: typeof UploadIdBrand };

// =============================================================================
// § Constructor Functions
// =============================================================================

export function SubmissionId(value: string): SubmissionId {
  return value as SubmissionId;
}

export function IntakeId(value: string): IntakeId {
  return value as IntakeId;
}

export function ResumeToken(value: string): ResumeToken {
  return value as ResumeToken;
}

export function EventId(value: string): EventId {
  return value as EventId;
}

export function DeliveryId(value: string): DeliveryId {
  return value as DeliveryId;
}

export function TenantId(value: string): TenantId {
  return value as TenantId;
}

export function KeyHash(value: string): KeyHash {
  return value as KeyHash;
}

export function UploadId(value: string): UploadId {
  return value as UploadId;
}
