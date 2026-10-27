"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  LocateFixed,
  MapPin,
  Phone,
  Plus,
  Store,
  Tags,
  UserCheck,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type {
  ApiResponse,
  ProductoCatalogo,
  Sucursal,
  UsuarioSistema,
} from "@/lib/types";
import {
  Badge,
  EmptyState,
  ErrorNote,
  Modal,
  PageLoader,
  Spinner,
} from "@/components/ui";

/**
 * Gestión de sucursales (Administrador). Cada sucursal es independiente:
 * tiene su propia carta (categorías y platos), fotos, ubicación GPS y Encargado de sucursal asignado.
 */
export function BranchesManager() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [categoryFor, setCategoryFor] = useState<Sucursal | null>(null);

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<ApiResponse<Sucursal[]>>("/catalog/branches"),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "all"],
    queryFn: () =>
      api.get<ApiResponse<ProductoCatalogo[]>>("/catalog/products?incluirInactivos=true"),
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<ApiResponse<UsuarioSistema[]>>("/users"),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; abierta: boolean }) =>
      api.patch(`/catalog/branches/${input.id}/toggle`, {
        apertura_manual: input.abierta,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["branches"] }),
  });

  if (branchesQuery.isLoading) return <PageLoader label="Cargando sucursales…" />;
  if (branchesQuery.isError) {
    return <ErrorNote message="No se pudieron cargar las sucursales." />;
  }

  const branches = branchesQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const users = usersQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Sucursales</h1>
          <p className="text-sm text-muted-foreground">
            Cada sucursal es independiente y administra su propia carta de platos, categorías, fotos, GPS y encargado sin mezclar productos.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nueva sucursal
        </button>
      </div>

      {branches.length === 0 ? (
        <EmptyState
          title="Aún no hay sucursales"
          hint="Crea la primera con el botón «Nueva sucursal»."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => {
            const platos = products.filter(
              (p) => p.restaurante_id === b.restaurante_id && p.esta_activo
            ).length;
            const encargados = b.encargados ?? [];
            return (
              <article key={b.id} className="card space-y-3 p-4">
                <header className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {b.foto_url ? (
                      <img
                        src={b.foto_url}
                        alt={b.nombre}
                        className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Store className="h-5 w-5" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold text-foreground">
                        {b.nombre}
                      </h2>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        /m/{b.slug}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={
                      b.apertura_manual
                        ? "bg-success-soft text-success"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {b.apertura_manual ? "Abierta" : "Cerrada"}
                  </Badge>
                </header>

                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {b.direccion}
                  </p>
                  {b.telefono ? (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0" aria-hidden />
                      {b.telefono}
                    </p>
                  ) : null}
                  <p className="flex items-center gap-2 text-xs">
                    <UserCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {encargados.length > 0 ? (
                      <span>
                        Encargado:{" "}
                        <strong className="text-foreground">
                          {encargados
                            .map((u) => `@${u.nombre_usuario} (${u.nombre_mostrado})`)
                            .join(", ")}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-warning">Sin encargado asignado</span>
                    )}
                  </p>
                  <p className="text-xs">
                    {platos} plato(s) activos ·{" "}
                    {b.latitud !== null && b.latitud !== undefined
                      ? `GPS (${Number(b.latitud).toFixed(4)}, ${Number(b.longitud).toFixed(
                          4
                        )})`
                      : "sin ubicación GPS"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    disabled={toggleMutation.isPending}
                    onClick={() =>
                      toggleMutation.mutate({ id: b.id, abierta: !b.apertura_manual })
                    }
                  >
                    {b.apertura_manual ? "Cerrar" : "Abrir"}
                  </button>
                  <Link
                    href={`/admin/catalogo?branchId=${b.id}`}
                    className="btn-primary !px-3 !py-1.5 text-xs"
                  >
                    Platos, precios y datos
                  </Link>
                  <button
                    type="button"
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    onClick={() => setCategoryFor(b)}
                  >
                    <Tags className="h-3.5 w-3.5" aria-hidden />
                    Categoría
                  </button>
                  <Link
                    href={`/m/${b.slug}`}
                    target="_blank"
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    Ver carta
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {createOpen ? (
        <CreateBranchModal users={users} onClose={() => setCreateOpen(false)} />
      ) : null}
      {categoryFor ? (
        <CategoryModal branch={categoryFor} onClose={() => setCategoryFor(null)} />
      ) : null}
    </div>
  );
}

function CreateBranchModal({
  users,
  onClose,
}: {
  users: UsuarioSistema[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ruc, setRuc] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [encargadoId, setEncargadoId] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);

  const encargados = users.filter((u) => u.rol === "ENCARGADO_SUCURSAL");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/catalog/branches", {
        nombre,
        direccion,
        telefono: telefono || undefined,
        ruc: ruc || undefined,
        latitud: lat ? Number(lat) : null,
        longitud: lng ? Number(lng) : null,
        foto_url: fotoUrl.trim() || undefined,
        encargado_ids: encargadoId ? [encargadoId] : undefined,
      }),
    onSuccess: () => {
      for (const key of ["branches", "restaurants", "categories", "products", "users"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      onClose();
    },
  });

  function fillLocation() {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Tu navegador no permite geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      () => setGeoError("No se pudo obtener la ubicación (permiso denegado)."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title="Nueva sucursal" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="b-nombre" className="input-label">
              Nombre de la sucursal
            </label>
            <input
              id="b-nombre"
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div>
            <label htmlFor="b-encargado" className="input-label">
              Encargado de sucursal (opcional)
            </label>
            <select
              id="b-encargado"
              className="input cursor-pointer"
              value={encargadoId}
              onChange={(e) => setEncargadoId(e.target.value)}
            >
              <option value="">Asignar luego…</option>
              {encargados.map((u) => (
                <option key={u.id} value={u.id}>
                  @{u.nombre_usuario} ({u.nombre_mostrado})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="b-dir" className="input-label">
            Dirección
          </label>
          <input
            id="b-dir"
            className="input"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            required
            minLength={3}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="b-tel" className="input-label">
              Teléfono / WhatsApp
            </label>
            <input
              id="b-tel"
              className="input"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+51987654321"
            />
          </div>
          <div>
            <label htmlFor="b-ruc" className="input-label">
              RUC (opcional)
            </label>
            <input
              id="b-ruc"
              className="input"
              inputMode="numeric"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              maxLength={11}
            />
          </div>
        </div>
        <div>
          <label htmlFor="b-foto" className="input-label">
            URL de Foto de la sucursal (opcional)
          </label>
          <input
            id="b-foto"
            className="input"
            value={fotoUrl}
            onChange={(e) => setFotoUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="input-label !mb-0">
              Ubicación GPS (para calcular distancias)
            </span>
            <button
              type="button"
              className="btn-secondary !px-3 !py-1 text-xs"
              onClick={fillLocation}
            >
              <LocateFixed className="h-3.5 w-3.5" aria-hidden />
              Usar mi ubicación
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <input
              className="input"
              inputMode="decimal"
              placeholder="Latitud"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              aria-label="Latitud"
            />
            <input
              className="input"
              inputMode="decimal"
              placeholder="Longitud"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              aria-label="Longitud"
            />
          </div>
          {geoError ? <p className="mt-1 text-xs text-destructive">{geoError}</p> : null}
        </div>
        {mutation.isError ? (
          <ErrorNote
            message={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : "No se pudo crear la sucursal"
            }
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : null}
            Crear sucursal
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryModal({
  branch,
  onClose,
}: {
  branch: Sucursal;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/catalog/categories", {
        restaurante_id: branch.restaurante_id,
        nombre,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      onClose();
    },
  });

  return (
    <Modal title={`Nueva categoría · ${branch.nombre}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="c-nombre" className="input-label">
            Nombre de la categoría
          </label>
          <input
            id="c-nombre"
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        {mutation.isError ? (
          <ErrorNote
            message={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : "No se pudo crear la categoría"
            }
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={mutation.isPending || !nombre.trim()}
          >
            Crear categoría
          </button>
        </div>
      </form>
    </Modal>
  );
}
