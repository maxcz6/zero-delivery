import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { AppError } from "@/shared/errors";

const MIN_PASSWORD_LENGTH = 10;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

export function validatePasswordStrength(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      "VALIDATION_ERROR",
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      422,
    );
  }
}

/**
 * Genera el hash seguro de una contraseña.
 * Formato portable: "scrypt$N=16384,r=8,p=1$<saltHex>$<derivedHex>"
 */
export function hashPassword(password: string): string {
  validatePasswordStrength(password);
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const expectedHex = parts[5];
  if (!saltHex || !expectedHex || !N || !r || !p) {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  const derived = scryptSync(password, salt, expected.length, { N, r, p });
  return timingSafeEqual(derived, expected);
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function evaluateLoginLockout(
  failedLoginCount: number,
  lockedUntil: Date | null,
  now: Date = new Date(),
): { isLocked: boolean; nextFailedCount: number; nextLockedUntil: Date | null } {
  if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
    return {
      isLocked: true,
      nextFailedCount: failedLoginCount,
      nextLockedUntil: lockedUntil,
    };
  }
  const nextFailedCount = failedLoginCount + 1;
  const nextLockedUntil =
    nextFailedCount >= MAX_FAILED_LOGIN_ATTEMPTS
      ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
      : null;

  return {
    isLocked: false,
    nextFailedCount,
    nextLockedUntil,
  };
}
