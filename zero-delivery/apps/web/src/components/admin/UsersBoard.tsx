"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck, Store, UserPlus } from "lucide-react";
import {
  dbRoleToRole,
  type RolUsuarioDb,
  type UserRole,
} from "@zero-delivery/shared-types";
import { api, ApiError } from "@/lib/api";
import { fetchMe, ROLE_LABEL } from "@/lib/auth";
import type { ApiResponse, Sucursal, UsuarioSistema } from "@/lib/types";
import {
  Badge,
  EmptyState,
  ErrorNote,
  Modal,
  PageLoader,
  Spinner,
} from "@/components/ui";

const ROL_BADGE: Record<UserRole, string> = {
  ADMIN: "bg-primary text-white",
  COORDINATOR: "bg-info-soft text-primary",
  BRANCH_MANAGER: "bg-accent-soft text-accent",
  SUPPORT_AGENT: "bg-yape-soft text-yape",
  RIDER: "bg-success-soft text-success",
};

export function UsersBoard() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [rol, setRol] = useState("");
  const [assigningUser, setAssigningUser] = useState<UsuarioSistema | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000 });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<ApiResponse<UsuarioSistema[]>>("/users"),
  });
  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<ApiResponse<Sucursal[]>>("/catalog/branches"),
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
  const branches = branchesQuery.data?.data ?? [];

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Usuarios y Roles</h1>
          <p className="text-sm text-muted-foreground">
            El Administrador, Coordinador y Agente de soporte no pertenecen a ninguna sucursal individual. Cada sucursal creada es administrada por su Encargado de sucursal (`branch_demo`, `kitchen_demo`, etc.).
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setCreateOpen(true)}
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Nuevo usuario
        </button>
      </div>

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
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Alcance / Sucursal administrada</th>
                <th className="px-4 py-3 font-semibold">Último acceso</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((usuario) => {
                const mapped = dbRoleToRole[usuario.rol as RolUsuarioDb];
                const esYo = meQuery.data?.userId === usuario.id;
                const esEncargado = usuario.rol === "ENCARGADO_SUCURSAL";

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
                    <td className="px-4 py-3 text-xs">
                      {esEncargado ? (
                        usuario.sucursales.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {usuario.sucursales.map((s) => (
                              <Badge
                                key={s.id}
                                className="bg-primary/10 text-primary font-semibold"
                              >
                                <Store className="mr-1 inline h-3 w-3" />
                                {s.nombre}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-warning font-semibold">
                            Sin sucursal asignada
                          </span>
                        )
                      ) : usuario.rol === "ADMINISTRADOR" ? (
                        <span className="text-muted-foreground">
                          Global · Administra todas las sucursales (no pertenece a una sola)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Global · No pertenece a ninguna sucursal
                        </span>
                      )}
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
                      <div className="inline-flex items-center gap-2">
                        {esEncargado ? (
                          <button
                            type="button"
                            onClick={() => setAssigningUser(usuario)}
                            className="btn-secondary !px-3 !py-1.5 text-xs"
                          >
                            <Store className="h-3.5 w-3.5" />
                            Asignar sucursal
                          </button>
                        ) : null}
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
                          className={`min-h-[34px] cursor-pointer rounded-lg border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            usuario.esta_activo
                              ? "border-destructive/40 text-destructive hover:bg-destructive/5"
                              : "border-success/40 text-success hover:bg-success/5"
                          }`}
                        >
                          <ShieldCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                          {usuario.esta_activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {assigningUser ? (
        <AssignBranchModal
          usuario={assigningUser}
          branches={branches}
          onClose={() => setAssigningUser(null)}
        />
      ) : null}

      {createOpen ? (
        <CreateUserModal
          branches={branches}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}
    </div>
  );
}

function AssignBranchModal({
  usuario,
  branches,
  onClose,
}: {
  usuario: UsuarioSistema;
  branches: Sucursal[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    usuario.sucursales.map((s) => s.id)
  );

  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/users/${usuario.id}/branches`, {
        sucursal_ids: selectedIds,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
      onClose();
    },
  });

  function toggleBranch(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <Modal
      title={`Sucursales administradas por @${usuario.nombre_usuario}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Selecciona la sucursal que administra <strong>{usuario.nombre_mostrado}</strong>. El encargado podrá gestionar platos, precios, categorías, fotos y ubicación GPS de su sucursal.
        </p>
        <div className="divide-y divide-border rounded-lg border border-border">
          {branches.map((b) => (
            <label
              key={b.id}
              className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-muted/40"
            >
              <div>
                <p className="font-bold text-foreground">{b.nombre}</p>
                <p className="text-xs text-muted-foreground">{b.direccion}</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={selectedIds.includes(b.id)}
                onChange={() => toggleBranch(b.id)}
              />
            </label>
          ))}
        </div>
        {mutation.isError ? (
          <ErrorNote
            message={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : "No se pudo actualizar la asignación"
            }
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : null}
            Guardar asignación
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateUserModal({
  branches,
  onClose,
}: {
  branches: Sucursal[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<RolUsuarioDb>("ENCARGADO_SUCURSAL");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/users", {
        nombre_usuario: username.trim(),
        nombre_mostrado: displayName.trim(),
        password,
        rol,
        sucursal_ids:
          rol === "ENCARGADO_SUCURSAL" && branchId ? [branchId] : [],
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
      onClose();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title="Nuevo usuario del sistema" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="u-user" className="input-label">
            Usuario (login)
          </label>
          <input
            id="u-user"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            placeholder="ej. encargado_norte"
          />
        </div>
        <div>
          <label htmlFor="u-name" className="input-label">
            Nombre mostrado
          </label>
          <input
            id="u-name"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={2}
          />
        </div>
        <div>
          <label htmlFor="u-pass" className="input-label">
            Contraseña
          </label>
          <input
            id="u-pass"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div>
          <label htmlFor="u-rol" className="input-label">
            Rol
          </label>
          <select
            id="u-rol"
            className="input cursor-pointer"
            value={rol}
            onChange={(e) => setRol(e.target.value as RolUsuarioDb)}
          >
            {Object.entries(dbRoleToRole).map(([dbRole, role]) => (
              <option key={dbRole} value={dbRole}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>

        {rol === "ENCARGADO_SUCURSAL" ? (
          <div>
            <label htmlFor="u-branch" className="input-label">
              Sucursal que administra
            </label>
            <select
              id="u-branch"
              className="input cursor-pointer"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">Selecciona una sucursal…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Este rol es global y no pertenece a ninguna sucursal individual.
          </div>
        )}

        {mutation.isError ? (
          <ErrorNote
            message={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : "No se pudo crear el usuario"
            }
          />
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : null}
            Crear usuario
          </button>
        </div>
      </form>
    </Modal>
  );
}
