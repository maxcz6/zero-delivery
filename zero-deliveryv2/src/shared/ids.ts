import { randomUUID } from "node:crypto";

export function createId(): string {
  return randomUUID();
}

export function createRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
