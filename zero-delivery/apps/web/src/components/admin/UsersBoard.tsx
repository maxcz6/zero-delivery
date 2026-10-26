"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck } from "lucide-react";
import {
  dbRoleToRole,
  type RolUsuarioDb,
  type UserRole,
} from "@zero-delivery/shared-types";
import { api, ApiError } from "@/lib/api";
import { fetchMe, ROLE_LABEL } from "@/lib/auth";
import type { ApiResponse, UsuarioSistema } from "@/lib/types";
import { Badge, EmptyState, ErrorNote, PageLoader } from "@/components/ui";

const ROL_BADGE: Record<UserRole, string> = {
  ADMIN: "bg-[#2563EB] text-white",
  COORDINATOR: "bg-[#2563EB]/10 text-[#1D4ED8]",
  BRANCH_MANAGER: "bg-[#EA580C]/15 text-[#C2410C]",
  SUPPORT_AGENT: "bg-[#7C3AED]/10 text-[#6D28D9]",
  RIDER: "bg-[#059669]/10 text-[#047857]",
};

function roleLabel(rol: string): string {
  const mapped = dbRoleToRole[rol as RolUsuarioDb];
  return mapped ? ROLE_LABEL[mapped] : rol;
}

export function UsersBoard() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [rol, setRol] = useState("");

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000 });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<ApiResponse<UsuarioSistema[]>>("/users"),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { userId: string; esta_activo: boolean }) =>
      api.patch<ApiResponse<UsuarioSistema>>(`/users/${input.userId}/status`, {
        esta_activo: input.esta_activo,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const usuarios = usersQuery.data?.data ?? [];

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return usuarios.filter((u) => {
      const coincideRol = !rol || u.rol === rol;
      if (!coincideRol) return false;
      if (!q) return true;
      return (
        u.nombre_usuario.toLowerCase().includes(q) ||
        u.nombre_mostrado.toLowerCase().includes(q) ||
        u.sucursales.some((s) => s.nombre.toLowerCase().includes(q))
      );
    });
  }, [usuarios, query, rol]);

  if (usersQuery.isLoading) return <PageLoader label="Cargando usuarios…" />;
  if (usersQuery.isError) {
    return (
      <ErrorNote
        message={
          usersQuery.error instanceof ApiError
            ? usersQuery.error.message
            : "No se pudo conectar con la API"
        }
      />
    );
  }

  const activos = usuarios.filter((u) => u.esta_activo).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium text-muted-foreground">Usuarios del sistema</p>
          <p className="text-2xl font-bold text-foreground">{usuarios.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-muted-foreground">Activos</p>
          <p className="text-2xl font-bold text-success">{activos}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-muted-foreground">Desactivados</p>
          <p className="text-2xl font-bold text-muted-foreground">
            {usuarios.length - activos}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="users-search" className="input-label">
            Buscar usuario
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="users-search"
              type="search"
              className="input pl-9"
              placeholder="Nombre, usuario o sucursal"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="min-w-[200px]">
          <label htmlFor="users-role" className="input-label">
            Rol
          </label>
          <select
            id="users-role"
            className="input cursor-pointer"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
          >
            <option value="">Todos los roles</option>
            {Object.entries(dbRoleToRole).map(([dbRole, role]) => (
              <option key={dbRole} value={dbRole}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusMutation.isError ? (
        <ErrorNote
          message={
            statusMutation.error instanceof ApiError
              ? statusMutation.error.message
              : "No se pudo actualizar el estado del usuario"
          }
        />
      ) : null}

      {filtrados.length === 0 ? (
        <EmptyState title="Sin usuarios que coincidan" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Sucursales</th>
                <th className="px-4 py-3 font-semibold">Último acceso</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((usuario) => {
                const mapped = dbRoleToRole[usuario.rol as RolUsuarioDb];
                const esYo = meQuery.data?.userId === usuario.id;
                return (
                  <tr
                    key={usuario.id}
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">
                        {usuario.nombre_mostrado}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{usuario.nombre_usuario}
                        {esYo ? " · tu cuenta" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {mapped ? (
                        <Badge className={ROL_BADGE[mapped]}>
                          {ROLE_LABEL[mapped]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{usuario.rol}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {usuario.sucursales.length > 0
                        ? usuario.sucursales.map((s) => s.nombre).join(", ")
                        : "Todas"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {usuario.ultimo_acceso_en
                        ? new Date(usuario.ultimo_acceso_en).toLocaleString("es-PE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Nunca"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          usuario.esta_activo
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }
                      >
                        {usuario.esta_activo ? "Activo" : "Desactivado"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          statusMutation.mutate({
                            userId: usuario.id,
                            esta_activo: !usuario.esta_activo,
                          })
                        }
                        disabled={statusMutation.isPending || esYo}
                        title={esYo ? "No puedes desactivar tu propia cuenta" : undefined}
                        className={`min-h-[36px] cursor-pointer rounded-lg border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          usuario.esta_activo
                            ? "border-destructive/40 text-destructive hover:bg-destructive/5"
                            : "border-success/40 text-success hover:bg-success/5"
                        }`}
                      >
                        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                        {usuario.esta_activo ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
