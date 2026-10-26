import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  evaluateLoginLockout,
  generateSessionToken,
  verifyPassword,
} from "@/modules/identity";
import { createRequestId } from "@/shared/ids";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  tenantSlug: z.string().default("zero-delivery"),
  username: z.string().min(1, "El nombre de usuario es requerido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export function getRedirectUrlForRole(role: string): string {
  switch (role) {
    case "RIDER":
      return "/deliveries";
    case "BRANCH_MANAGER":
      return "/dashboard?view=branch";
    case "COORDINATOR":
      return "/dashboard?view=kanban";
    case "SUPPORT_AGENT":
      return "/dashboard?view=support";
    case "ADMIN":
    default:
      return "/dashboard";
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let rawInput: Record<string, unknown> = {};

    if (contentType.includes("application/json")) {
      rawInput = (await request.json()) as Record<string, unknown>;
    } else {
      const formData = await request.formData();
      rawInput = {
        username: formData.get("username"),
        password: formData.get("password"),
        tenantSlug: formData.get("tenantSlug") ?? "zero-delivery",
      };
    }

    const parsed = loginSchema.safeParse(rawInput);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Datos de inicio de sesión inválidos.",
            details: parsed.error.flatten(),
            requestId,
          },
        },
        { status: 422 },
      );
    }

    const { username, password, tenantSlug } = parsed.data;
    const db = getDb();

    // 1. Buscar Tenant
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, tenantSlug))
      .limit(1);

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Organización o usuario no encontrado.",
            requestId,
          },
        },
        { status: 401 },
      );
    }

    // 2. Buscar Usuario
    const [user] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.tenantId, tenant.id), eq(schema.users.username, username.trim())))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Credenciales incorrectas.",
            requestId,
          },
        },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error: {
            code: "USER_INACTIVE",
            message: "La cuenta de usuario está desactivada. Contacte al administrador.",
            requestId,
          },
        },
        { status: 403 },
      );
    }

    // 3. Evaluar Bloqueo de Cuenta por Intentos Fallidos
    const lockout = evaluateLoginLockout(user.failedLoginCount, user.lockedUntil);
    if (lockout.isLocked) {
      return NextResponse.json(
        {
          error: {
            code: "ACCOUNT_LOCKED",
            message: "Demasiados intentos fallidos. Cuenta temporalmente bloqueada por 15 minutos.",
            requestId,
          },
        },
        { status: 423 },
      );
    }

    // 4. Verificar Contraseña
    const passwordValid = verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      await db
        .update(schema.users)
        .set({
          failedLoginCount: lockout.nextFailedCount,
          lockedUntil: lockout.nextLockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id));

      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Credenciales incorrectas.",
            requestId,
          },
        },
        { status: 401 },
      );
    }

    // 5. Login Exitoso: Resetear contador de fallos y actualizar última fecha
    await db
      .update(schema.users)
      .set({
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    // 6. Generar Sesión
    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    await db.insert(schema.sessions).values({
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: request.headers.get("user-agent"),
    });

    const redirectUrl = getRedirectUrlForRole(user.role);

    const response = NextResponse.json({
      ok: true,
      requestId,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
      redirectUrl,
    });

    // Cookie segura de sesión
    response.cookies.set({
      name: "zd_session",
      value: rawToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Error al procesar el inicio de sesión.",
          details: String(err),
          requestId,
        },
      },
      { status: 500 },
    );
  }
}
