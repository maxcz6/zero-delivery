"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  LogOut,
  MapPin,
  Shield,
  ShieldCheck,
  User,
  UserCircle,
} from "lucide-react";
import { fetchMe, logout, ROLE_LABEL, ROLE_HOME } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { PageLoader, ErrorNote } from "@/components/ui";

export default function ProfilePage() {
  const router = useRouter();

  const { data: actor, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background">
        <AppHeader title="Mi Perfil" />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <PageLoader label="Cargando perfil de usuario…" />
        </main>
      </div>
    );
  }

  if (isError || !actor) {
    return (
      <div className="min-h-dvh bg-background">
        <AppHeader title="Mi Perfil" />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <ErrorNote message="No se pudo obtener la información de la sesión actual." />
        </main>
      </div>
    );
  }

  const roleName = ROLE_LABEL[actor.role] ?? actor.role;
  const homePath = ROLE_HOME[actor.role] ?? "/login";

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Mi Cuenta" />

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Tarjeta Principal de Identidad */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white text-2xl font-bold shadow-md shadow-primary/20">
                {(actor.role?.[0] ?? "U").toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">Cuenta Activa</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    En línea
                  </span>
                </div>
                <p className="text-sm font-semibold text-primary mt-0.5">{roleName}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  ID: {actor.userId}
                </p>
              </div>
            </div>

            <div className="flex sm:flex-col gap-2">
              <button
                type="button"
                onClick={() => router.push(homePath)}
                className="btn-primary min-h-[40px] text-xs px-4"
              >
                Ir a mi panel principal
              </button>
            </div>
          </div>
        </section>

        {/* Detalles de Sesión y Seguridad */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" /> Permisos y Seguridad
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Rol de Sistema:</span>
                <span className="font-semibold text-foreground">{roleName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Tenant / Inquilino:</span>
                <span className="font-mono text-xs text-foreground truncate max-w-[180px]">
                  {actor.tenantId}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Autenticación:</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" /> Cookie HttpOnly
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" /> Ámbito Operativo
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Sucursales con acceso:</span>
                <span className="font-semibold text-foreground">
                  {actor.branchIds.length > 0
                    ? `${actor.branchIds.length} asignada(s)`
                    : "Acceso Global"}
                </span>
              </div>
              {actor.riderId ? (
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">ID Repartidor Flota:</span>
                  <span className="font-mono text-xs text-foreground truncate max-w-[180px]">
                    {actor.riderId}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Petición actual:</span>
                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">
                  {actor.requestId}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Zona de Cerrar Sesión */}
        <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-destructive">Finalizar Sesión Activa</h3>
            <p className="text-xs text-muted-foreground">
              Se revocará el token de sesión y tendrás que volver a ingresar credenciales.
            </p>
          </div>
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-destructive px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión Ahora
          </button>
        </section>
      </main>
    </div>
  );
}
