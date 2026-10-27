"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, Eye, EyeOff, Lock, PackageCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { homeForDbRole } from "@/lib/auth";
import type { LoginResponse } from "@/lib/types";
import { InstallBanner } from "@/components/InstallBanner";
import { Spinner } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inquilino, setInquilino] = useState("zero-delivery-demo");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setLockMessage(null);
    try {
      const res = await api.post<LoginResponse>("/auth/login", {
        inquilino_slug: inquilino.trim(),
        nombre_usuario: usuario.trim(),
        password,
      });
      const home = homeForDbRole(res.usuario.rol);
      const next = searchParams.get("next");
      // Solo permitir redirecciones internas hacia la zona del propio rol (evita open-redirect y cruce entre roles).
      const safeNext =
        next && next.startsWith(home) && !next.startsWith("//") ? next : home;
      router.replace(safeNext);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (
          (err.status === 403 || err.status === 423) &&
          /bloqueada/i.test(err.message)
        ) {
          setLockMessage(err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError("No se pudo conectar con la API. Verifica que el backend esté corriendo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-md">
            <PackageCheck className="h-8 w-8" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold text-foreground">Zero Delivery</h1>
          <p className="text-sm text-muted-foreground">
            Ingresa con las credenciales de tu organización
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6" noValidate>
          {lockMessage ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-medium text-warning"
            >
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{lockMessage}</span>
            </div>
          ) : null}

          {error ? (
            <div
              id="login-error"
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}

          <div>
            <label htmlFor="inquilino" className="input-label">
              Inquilino (slug)
            </label>
            <input
              id="inquilino"
              name="inquilino_slug"
              type="text"
              autoComplete="organization"
              className={error ? "input input-error" : "input"}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              value={inquilino}
              onChange={(e) => setInquilino(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="usuario" className="input-label">
              Nombre de usuario
            </label>
            <input
              id="usuario"
              name="nombre_usuario"
              type="text"
              autoComplete="username"
              className={error ? "input input-error" : "input"}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="input-label">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className={error ? "input input-error pr-12" : "input pr-12"}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? <Spinner className="h-4 w-4" /> : null}
            {submitting ? "Verificando…" : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Sesión protegida con cookie HttpOnly. Nunca guardamos tokens en tu navegador.
        </p>
      </div>
      <InstallBanner />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
