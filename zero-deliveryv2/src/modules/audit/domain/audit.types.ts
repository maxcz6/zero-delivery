import type { Role } from "@/modules/identity/domain/permissions";

export type AuditEntryInput = {
  tenantId: string;
  actorId: string | null;
  actorRole: Role | "SYSTEM" | null;
  action: string;
  objectType: string;
  objectId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string | null;
  ip?: string | null;
};
