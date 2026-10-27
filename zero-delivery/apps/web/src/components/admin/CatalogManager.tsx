"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  LocateFixed,
  MapPin,
  PackagePlus,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Tags,
  Trash2,
  UserCheck,
  UserPlus,
  UtensilsCrossed,
} from "lucide-react";
import { centsToSoles, solesToCents } from "@zero-delivery/shared-types";
import { api, ApiError, money, toCents } from "@/lib/api";
import { fetchMe } from "@/lib/auth";
import type {
  ApiResponse,
  CategoriaCatalogo,
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

type ActiveTab = "platos" | "categorias" | "sucursal" | "usuarios";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

export function CatalogManager({ title = "Catálogo y Administración de Sucursal" }: { title?: string }) {
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("platos");
  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductoCatalogo | null>(null);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000 });
  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<ApiResponse<Sucursal[]>>("/catalog/branches"),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => api.get<ApiResponse<CategoriaCatalogo[]>>("/catalog/categories"),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "all"],
    queryFn: () =>
      api.get<ApiResponse<ProductoCatalogo[]>>("/catalog/products?incluirInactivos=true"),
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<ApiResponse<UsuarioSistema[]>>("/users"),
    enabled:
      meQuery.data?.role === "ADMIN" || meQuery.data?.role === "BRANCH_MANAGER",
  });

  const actor = meQuery.data;
  const isAdmin = actor?.role === "ADMIN";
  const isBranchManager = actor?.role === "BRANCH_MANAGER";
  const canEdit = isAdmin || isBranchManager;

  // Admin, Coordinador y Soporte no pertenecen a ninguna sucursal individual (ven todas).
  // El Encargado de Sucursal (`branch_demo`, `kitchen_demo`) ve únicamente las sucursales asignadas.
  const allBranches = branchesQuery.data?.data ?? [];
  const misSucursales = useMemo(() => {
    if (!actor || actor.role !== "BRANCH_MANAGER") {
      return allBranches;
    }
    return allBranches.filter((b) => actor.branchIds.includes(b.id));
  }, [allBranches, actor]);

  // Sincronizar con ?branchId=... si viene en la URL o elegir siempre una sucursal activa (NUNCA mezclar productos)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("branchId");
      if (fromUrl && misSucursales.some((b) => b.id === fromUrl)) {
        setSelectedBranchId(fromUrl);
        return;
      }
    }
    if (
      misSucursales.length > 0 &&
      (!selectedBranchId || !misSucursales.some((b) => b.id === selectedBranchId))
    ) {
      setSelectedBranchId(misSucursales[0]!.id);
    }
  }, [misSucursales, selectedBranchId]);

  const sucursalActiva = useMemo(
    () =>
      misSucursales.find((b) => b.id === selectedBranchId) ??
      misSucursales[0] ??
      null,
    [misSucursales, selectedBranchId]
  );

  // Categorías EXCLUSIVAS de la sucursal activa (nunca mezcladas con otra sucursal)
  const allCategories = categoriesQuery.data?.data ?? [];
  const categoriasSucursal = useMemo(() => {
    if (!sucursalActiva?.restaurante_id) return [];
    return allCategories.filter(
      (c) => c.restaurante_id === sucursalActiva.restaurante_id
    );
  }, [allCategories, sucursalActiva]);

  // Productos EXCLUSIVOS de la sucursal activa (nunca mezclados con otra sucursal)
  const allProducts = productsQuery.data?.data ?? [];
  const productosSucursal = useMemo(() => {
    if (!sucursalActiva?.restaurante_id) return [];
    return allProducts.filter(
      (p) => p.restaurante_id === sucursalActiva.restaurante_id
    );
  }, [allProducts, sucursalActiva]);

  const productosFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return productosSucursal.filter((p) => {
      if (selectedCategoryId && p.categoria_id !== selectedCategoryId) {
        return false;
      }
      if (!q) return true;
      return (
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion ?? "").toLowerCase().includes(q) ||
        (p.categoria?.nombre ?? "").toLowerCase().includes(q)
      );
    });
  }, [productosSucursal, selectedCategoryId, query]);

  const toggleBranchMutation = useMutation({
    mutationFn: (input: { branchId: string; apertura_manual: boolean }) =>
      api.patch<ApiResponse<Sucursal>>(`/catalog/branches/${input.branchId}/toggle`, {
        apertura_manual: input.apertura_manual,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (input: { productId: string; esta_activo: boolean }) =>
      api.patch<ApiResponse<ProductoCatalogo>>(
        `/catalog/products/${input.productId}/status`,
        { esta_activo: input.esta_activo }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/catalog/products/${productId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  if (branchesQuery.isLoading || productsQuery.isLoading) {
    return <PageLoader label="Cargando sucursales y catálogo…" />;
  }
  if (branchesQuery.isError || productsQuery.isError) {
    const err = branchesQuery.error ?? productsQuery.error;
    return (
      <ErrorNote
        message={
          err instanceof ApiError ? err.message : "No se pudo conectar con la API"
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Encabezado y alcance de rol */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "El Administrador gestiona todas las sucursales creadas. Selecciona una sucursal para ver y administrar su carta independiente sin mezclar productos."
              : isBranchManager
              ? "Administra todos los datos de tu sucursal asignada: platos, precios, comidas, categorías, fotos, ubicación GPS y personal."
              : "Consulta las sucursales y sus cartas independientes."}
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setCreateBranchOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nueva sucursal
          </button>
        ) : null}
      </div>

      {/* Selector de Sucursales Creadas (Tarjetas independientes) */}
      <section aria-label="Sucursales creadas" className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Store className="h-4 w-4 text-primary" aria-hidden />
            {isAdmin
              ? `Todas las sucursales creadas (${misSucursales.length}) · Selecciona una sucursal`
              : `Mi sucursal asignada (${misSucursales.length})`}
          </h2>
          <span className="text-xs text-muted-foreground">
            Los platos y categorías pertenecen exclusivamente a su sucursal y no se mezclan.
          </span>
        </div>

        {misSucursales.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No hay sucursales asignadas"
              hint={
                isAdmin
                  ? "Crea una sucursal con el botón «Nueva sucursal»."
                  : "Solicita al Administrador que asigne tu usuario a una sucursal."
              }
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {misSucursales.map((branch) => {
              const isSelected = sucursalActiva?.id === branch.id;
              const platosCount = allProducts.filter(
                (p) => p.restaurante_id === branch.restaurante_id
              ).length;
              const catsCount = allCategories.filter(
                (c) => c.restaurante_id === branch.restaurante_id
              ).length;
              const encargados = branch.encargados ?? [];

              return (
                <div
                  key={branch.id}
                  onClick={() => {
                    setSelectedBranchId(branch.id);
                    setSelectedCategoryId("");
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedBranchId(branch.id);
                      setSelectedCategoryId("");
                    }
                  }}
                  className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {branch.foto_url ? (
                        <img
                          src={branch.foto_url}
                          alt={branch.nombre}
                          className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <span
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-primary text-white"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          <Store className="h-6 w-6" aria-hidden />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-bold text-foreground">
                            {branch.nombre}
                          </p>
                          {isSelected ? (
                            <Badge className="bg-primary text-white text-[10px]">
                              Activa
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {branch.direccion}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                          {platosCount} plato(s) · {catsCount} categoría(s)
                        </p>
                      </div>
                    </div>

                    {/* Switch de apertura manual */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={branch.apertura_manual}
                      aria-label={`Abrir o cerrar ${branch.nombre}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBranchMutation.mutate({
                          branchId: branch.id,
                          apertura_manual: !branch.apertura_manual,
                        });
                      }}
                      disabled={toggleBranchMutation.isPending || !canEdit}
                      className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
                        branch.apertura_manual ? "bg-success" : "bg-border"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                          branch.apertura_manual ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                      <UserCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
                      {encargados.length > 0 ? (
                        <span>
                          Encargado:{" "}
                          <strong className="text-foreground">
                            {encargados.map((u) => `@${u.nombre_usuario}`).join(", ")}
                          </strong>
                        </span>
                      ) : (
                        <span className="text-warning">Sin encargado asignado</span>
                      )}
                    </div>
                    <Badge
                      className={
                        branch.apertura_manual
                          ? "bg-success-soft text-success"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {branch.apertura_manual ? "Abierta" : "Cerrada"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Panel de Administración de la Sucursal Seleccionada */}
      {sucursalActiva ? (
        <section className="space-y-4">
          {/* Barra superior de la sucursal activa + Sub-pestañas */}
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-3">
                {sucursalActiva.foto_url ? (
                  <img
                    src={sucursalActiva.foto_url}
                    alt={sucursalActiva.nombre}
                    className="h-11 w-11 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-extrabold text-foreground">
                      {sucursalActiva.nombre}
                    </h2>
                    <Badge className="font-mono text-xs bg-muted text-foreground">
                      /m/{sucursalActiva.slug}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sucursalActiva.direccion}
                    {sucursalActiva.telefono ? ` · Tel: ${sucursalActiva.telefono}` : ""}
                    {sucursalActiva.latitud != null && sucursalActiva.longitud != null
                      ? ` · GPS (${Number(sucursalActiva.latitud).toFixed(4)}, ${Number(
                          sucursalActiva.longitud
                        ).toFixed(4)})`
                      : " · Sin coordenadas GPS"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/m/${sucursalActiva.slug}`}
                  target="_blank"
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Ver carta pública
                </Link>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => setCreateProductOpen(true)}
                    className="btn-primary !px-3.5 !py-2 text-xs"
                  >
                    <PackagePlus className="h-4 w-4" aria-hidden />
                    Nuevo plato en {sucursalActiva.nombre}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Pestañas de gestión integral de la sucursal */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("platos")}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === "platos"
                    ? "bg-primary text-white"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <UtensilsCrossed className="h-3.5 w-3.5" />
                Platos, Comidas y Precios ({productosSucursal.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("categorias")}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === "categorias"
                    ? "bg-primary text-white"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Tags className="h-3.5 w-3.5" />
                Categorías ({categoriasSucursal.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("sucursal")}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === "sucursal"
                    ? "bg-primary text-white"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                Datos, Fotos y Ubicación GPS
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("usuarios")}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === "usuarios"
                    ? "bg-primary text-white"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Encargados y Usuarios ({(sucursalActiva.encargados ?? []).length})
              </button>
            </div>
          </div>

          {/* CONTENIDO DE PESTAÑA 1: PLATOS, COMIDAS Y PRECIOS */}
          {activeTab === "platos" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label htmlFor="catalog-search" className="input-label">
                    Buscar plato o comida en {sucursalActiva.nombre}
                  </label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <input
                      id="catalog-search"
                      type="search"
                      className="input pl-9"
                      placeholder="Nombre, ingredientes o categoría…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="min-w-[220px]">
                  <label htmlFor="catalog-category" className="input-label">
                    Categoría de {sucursalActiva.nombre}
                  </label>
                  <select
                    id="catalog-category"
                    className="input cursor-pointer"
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                  >
                    <option value="">Todas las categorías ({categoriasSucursal.length})</option>
                    {categoriasSucursal.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
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
                      : "No se pudo actualizar la disponibilidad"
                  }
                />
              ) : null}

              {productosFiltrados.length === 0 ? (
                <EmptyState
                  title={`Sin platos registrados en ${sucursalActiva.nombre}`}
                  hint="Usa el botón «Nuevo plato» para agregar comidas, fotos y precios a esta sucursal."
                />
              ) : (
                <div className="card overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">Plato / Comida</th>
                        <th className="px-4 py-3 font-semibold">Categoría</th>
                        <th className="px-4 py-3 text-right font-semibold">Precio base</th>
                        <th className="px-4 py-3 text-right font-semibold">Empaque</th>
                        <th className="px-4 py-3 font-semibold">Disponible</th>
                        <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosFiltrados.map((producto) => (
                        <tr
                          key={producto.id}
                          className="border-b border-border last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {producto.imagen_url ? (
                                <img
                                  src={producto.imagen_url}
                                  alt={producto.nombre}
                                  className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                  <UtensilsCrossed className="h-5 w-5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-foreground">
                                    {producto.nombre}
                                  </span>
                                  {producto.es_fragil ? (
                                    <Badge className="border border-destructive/30 bg-destructive/5 text-destructive">
                                      <AlertTriangle className="h-3 w-3" aria-hidden />
                                      Frágil
                                    </Badge>
                                  ) : null}
                                  {!producto.esta_activo ? (
                                    <Badge className="bg-muted text-muted-foreground">
                                      No disponible
                                    </Badge>
                                  ) : null}
                                </div>
                                {producto.descripcion ? (
                                  <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                                    {producto.descripcion}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className="bg-primary/10 text-primary">
                              {producto.categoria?.nombre ??
                                categoriasSucursal.find((c) => c.id === producto.categoria_id)
                                  ?.nombre ??
                                "Sin categoría"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">
                            {money(producto.precio_base_centavos)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {money(producto.empaque_centavos)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={producto.esta_activo}
                              aria-label={`Disponibilidad de ${producto.nombre}`}
                              onClick={() =>
                                statusMutation.mutate({
                                  productId: producto.id,
                                  esta_activo: !producto.esta_activo,
                                })
                              }
                              disabled={statusMutation.isPending || !canEdit}
                              className={`relative h-8 w-14 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
                                producto.esta_activo ? "bg-success" : "bg-border"
                              }`}
                            >
                              <span
                                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                                  producto.esta_activo ? "left-7" : "left-1"
                                }`}
                              />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canEdit ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingProduct(producto)}
                                  className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                                  Editar / Precio / Foto
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `¿Archivar el plato «${producto.nombre}» de ${sucursalActiva.nombre}?`
                                      )
                                    ) {
                                      archiveMutation.mutate(producto.id);
                                    }
                                  }}
                                  disabled={archiveMutation.isPending}
                                  className="inline-flex min-h-[34px] cursor-pointer items-center justify-center rounded-lg border border-destructive/30 px-2 text-xs text-destructive hover:bg-destructive/10"
                                  title="Archivar plato"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {/* CONTENIDO DE PESTAÑA 2: CATEGORÍAS DE LA SUCURSAL */}
          {activeTab === "categorias" ? (
            <BranchCategoriesPanel
              branch={sucursalActiva}
              categories={categoriasSucursal}
              products={productosSucursal}
              canEdit={canEdit}
            />
          ) : null}

          {/* CONTENIDO DE PESTAÑA 3: DATOS, FOTOS Y UBICACIÓN GPS DE LA SUCURSAL */}
          {activeTab === "sucursal" ? (
            <BranchDetailsPanel branch={sucursalActiva} canEdit={canEdit} />
          ) : null}

          {/* CONTENIDO DE PESTAÑA 4: ENCARGADOS Y USUARIOS DE LA SUCURSAL */}
          {activeTab === "usuarios" ? (
            <BranchUsersPanel
              branch={sucursalActiva}
              allUsers={usersQuery.data?.data ?? []}
              canEdit={canEdit}
              isAdmin={isAdmin}
            />
          ) : null}
        </section>
      ) : null}

      {/* Modal: Nuevo Plato en la Sucursal Activa */}
      {createProductOpen && sucursalActiva ? (
        <ProductFormModal
          branch={sucursalActiva}
          categorias={categoriasSucursal}
          onClose={() => setCreateProductOpen(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["products"] });
            void queryClient.invalidateQueries({ queryKey: ["categories"] });
            setCreateProductOpen(false);
          }}
        />
      ) : null}

      {/* Modal: Editar Plato / Precio / Foto */}
      {editingProduct && sucursalActiva ? (
        <ProductFormModal
          branch={sucursalActiva}
          categorias={categoriasSucursal}
          producto={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["products"] });
            setEditingProduct(null);
          }}
        />
      ) : null}

      {/* Modal: Crear Nueva Sucursal (Solo Admin) */}
      {createBranchOpen ? (
        <CreateBranchModal
          users={usersQuery.data?.data ?? []}
          onClose={() => setCreateBranchOpen(false)}
          onCreated={(newBranchId) => {
            setCreateBranchOpen(false);
            if (newBranchId) setSelectedBranchId(newBranchId);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Modal unificado para Crear o Editar un Plato/Comida de una Sucursal específica
 * (incluye nombre, descripción, categoría de la sucursal, precio base, empaque, fragilidad y foto).
 */
function ProductFormModal({
  branch,
  categorias,
  producto,
  onClose,
  onSuccess,
}: {
  branch: Sucursal;
  categorias: CategoriaCatalogo[];
  producto?: ProductoCatalogo;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(producto);

  const [categoriaId, setCategoriaId] = useState(
    producto?.categoria_id ?? categorias[0]?.id ?? ""
  );
  const [nuevaCatNombre, setNuevaCatNombre] = useState("");
  const [creandoCat, setCreandoCat] = useState(categorias.length === 0);

  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");
  const [precio, setPrecio] = useState(
    producto
      ? String(centsToSoles(toCents(producto.precio_base_centavos)))
      : ""
  );
  const [empaque, setEmpaque] = useState(
    producto
      ? String(centsToSoles(toCents(producto.empaque_centavos)))
      : "0"
  );
  const [fragil, setFragil] = useState(producto?.es_fragil ?? false);
  const [imagenUrl, setImagenUrl] = useState(producto?.imagen_url ?? "");

  const createCatMutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<CategoriaCatalogo>>("/catalog/categories", {
        restaurante_id: branch.restaurante_id,
        nombre: nuevaCatNombre.trim(),
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoriaId(res.data.id);
      setNuevaCatNombre("");
      setCreandoCat(false);
    },
  });

  const precioCentavos = solesToCents(Number(precio) || 0);
  const empaqueCentavos = empaque.trim() ? solesToCents(Number(empaque) || 0) : 0;

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit && producto) {
        return api.patch<ApiResponse<ProductoCatalogo>>(
          `/catalog/products/${producto.id}`,
          {
            categoria_id: categoriaId,
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
            precio_base_centavos: String(precioCentavos),
            empaque_centavos: String(empaqueCentavos),
            es_fragil: fragil,
            imagen_url: imagenUrl.trim() || null,
          }
        );
      }
      return api.post<ApiResponse<ProductoCatalogo>>("/catalog/products", {
        restaurante_id: branch.restaurante_id,
        categoria_id: categoriaId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        precio_base_centavos: String(precioCentavos),
        empaque_centavos: String(empaqueCentavos),
        es_fragil: fragil,
        imagen_url: imagenUrl.trim() || undefined,
      });
    },
    onSuccess,
  });

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setImagenUrl(dataUrl);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (categoriaId && nombre.trim().length >= 2 && precioCentavos > 0) {
      mutation.mutate();
    }
  }

  return (
    <Modal
      title={
        isEdit
          ? `Editar plato · ${producto?.nombre} (${branch.nombre})`
          : `Nuevo plato para ${branch.nombre}`
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-foreground">
          Sucursal destino: <strong>{branch.nombre}</strong> ({branch.direccion}). Este plato solo aparecerá en la carta de esta sucursal.
        </div>

        {/* Categoría */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="plato-categoria" className="input-label !mb-0">
              Categoría en {branch.nombre}
            </label>
            <button
              type="button"
              onClick={() => setCreandoCat((v) => !v)}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              {creandoCat ? "Elegir existente" : "+ Crear categoría rápida"}
            </button>
          </div>
          {creandoCat ? (
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Ej. Pollos a la Brasa, Hamburguesas, Bebidas…"
                value={nuevaCatNombre}
                onChange={(e) => setNuevaCatNombre(e.target.value)}
              />
              <button
                type="button"
                disabled={createCatMutation.isPending || nuevaCatNombre.trim().length < 2}
                onClick={() => createCatMutation.mutate()}
                className="btn-primary !px-3 text-xs"
              >
                Guardar categoría
              </button>
            </div>
          ) : (
            <select
              id="plato-categoria"
              className="input mt-1 cursor-pointer"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              required
            >
              <option value="">Selecciona una categoría…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="plato-nombre" className="input-label">
              Nombre del plato / comida
            </label>
            <input
              id="plato-nombre"
              type="text"
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. 1/2 Pollo a la Brasa con Papas"
              required
              minLength={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="plato-precio" className="input-label">
                Precio base (S/)
              </label>
              <input
                id="plato-precio"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                className="input"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="plato-empaque" className="input-label">
                Empaque (S/)
              </label>
              <input
                id="plato-empaque"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="input"
                value={empaque}
                onChange={(e) => setEmpaque(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="plato-descripcion" className="input-label">
            Descripción / Ingredientes (opcional)
          </label>
          <textarea
            id="plato-descripcion"
            className="input min-h-16 resize-y"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Describe qué incluye el plato, guarniciones o tamaño…"
          />
        </div>

        {/* Foto del plato */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="plato-foto" className="input-label !mb-0 flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-primary" />
              Foto del plato (URL o subir archivo)
            </label>
            <label className="btn-secondary !px-2.5 !py-1 text-xs cursor-pointer">
              <Camera className="h-3.5 w-3.5" />
              Subir imagen
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            {imagenUrl ? (
              <img
                src={imagenUrl}
                alt="Vista previa"
                className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
            <input
              id="plato-foto"
              type="text"
              className="input flex-1 text-xs"
              placeholder="https://ejemplo.com/plato.jpg o sube una foto desde tu equipo"
              value={imagenUrl}
              onChange={(e) => setImagenUrl(e.target.value)}
            />
          </div>
        </div>

        <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            className="h-5 w-5 cursor-pointer accent-primary"
            checked={fragil}
            onChange={(e) => setFragil(e.target.checked)}
          />
          Producto frágil (requiere empaque especial o maletera cuidadosa)
        </label>

        {mutation.isError ? (
          <ErrorNote
            message={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : "No se pudo guardar el plato"
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
            disabled={
              mutation.isPending ||
              !categoriaId ||
              nombre.trim().length < 2 ||
              precioCentavos <= 0
            }
          >
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : null}
            {isEdit ? "Guardar cambios" : "Crear plato"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Pestaña 2: Gestión de Categorías de la Sucursal
 */
function BranchCategoriesPanel({
  branch,
  categories,
  products,
  canEdit,
}: {
  branch: Sucursal;
  categories: CategoriaCatalogo[];
  products: ProductoCatalogo[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [nombreNueva, setNombreNueva] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/catalog/categories", {
        restaurante_id: branch.restaurante_id,
        nombre: nombreNueva.trim(),
      }),
    onSuccess: () => {
      setNombreNueva("");
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; nombre: string }) =>
      api.patch(`/catalog/categories/${input.id}`, { nombre: input.nombre }),
    onSuccess: () => {
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/catalog/categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Categorías de {branch.nombre}
          </h3>
          <p className="text-xs text-muted-foreground">
            Organiza las secciones de comidas de esta sucursal (ej. Entradas, Pollos a la Brasa, Hamburguesas, Bebidas).
          </p>
        </div>
      </div>

      {canEdit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nombreNueva.trim().length >= 2) createMutation.mutate();
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            type="text"
            className="input max-w-md flex-1"
            placeholder="Nueva categoría para esta sucursal…"
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            required
            minLength={2}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={createMutation.isPending || nombreNueva.trim().length < 2}
          >
            <Plus className="h-4 w-4" />
            Agregar categoría
          </button>
        </form>
      ) : null}

      {categories.length === 0 ? (
        <EmptyState title="Esta sucursal aún no tiene categorías" />
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoria_id === cat.id).length;
            const isEditing = editingId === cat.id;

            return (
              <div
                key={cat.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                {isEditing ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      className="input max-w-xs"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-primary !px-3 !py-1.5 text-xs"
                      onClick={() =>
                        updateMutation.mutate({
                          id: cat.id,
                          nombre: editingName.trim(),
                        })
                      }
                      disabled={updateMutation.isPending || editingName.trim().length < 2}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5 text-xs"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-foreground">{cat.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {count} plato(s) en esta categoría
                    </p>
                  </div>
                )}

                {canEdit && !isEditing ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5 text-xs"
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditingName(cat.nombre);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Renombrar
                    </button>
                    <button
                      type="button"
                      disabled={count > 0 || deleteMutation.isPending}
                      title={
                        count > 0
                          ? "Archiva o mueve primero los platos de esta categoría"
                          : "Eliminar categoría"
                      }
                      onClick={() => deleteMutation.mutate(cat.id)}
                      className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-destructive/30 px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Pestaña 3: Datos de la Sucursal, Foto/Fachada y Ubicación GPS
 */
function BranchDetailsPanel({
  branch,
  canEdit,
}: {
  branch: Sucursal;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(branch.nombre);
  const [direccion, setDireccion] = useState(branch.direccion);
  const [telefono, setTelefono] = useState(branch.telefono ?? "");
  const [ruc, setRuc] = useState(branch.ruc ?? "");
  const [razonSocial, setRazonSocial] = useState(branch.razon_social ?? "");
  const [lat, setLat] = useState(branch.latitud != null ? String(branch.latitud) : "");
  const [lng, setLng] = useState(branch.longitud != null ? String(branch.longitud) : "");
  const [fotoUrl, setFotoUrl] = useState(branch.foto_url ?? "");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    setNombre(branch.nombre);
    setDireccion(branch.direccion);
    setTelefono(branch.telefono ?? "");
    setRuc(branch.ruc ?? "");
    setRazonSocial(branch.razon_social ?? "");
    setLat(branch.latitud != null ? String(branch.latitud) : "");
    setLng(branch.longitud != null ? String(branch.longitud) : "");
    setFotoUrl(branch.foto_url ?? "");
    setSavedOk(false);
  }, [branch]);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/catalog/branches/${branch.id}`, {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim() || null,
        ruc: ruc.trim() || null,
        razon_social: razonSocial.trim() || null,
        latitud: lat.trim() ? Number(lat) : null,
        longitud: lng.trim() ? Number(lng) : null,
        foto_url: fotoUrl.trim() || null,
      }),
    onSuccess: () => {
      setSavedOk(true);
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
      void queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    },
  });

  function fillGps() {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Tu navegador no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      () => setGeoError("No se pudo obtener el GPS actual."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleBranchPhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setFotoUrl(dataUrl);
  }

  return (
    <div className="card p-5">
      <h3 className="text-base font-bold text-foreground">
        Datos generales, Foto y Ubicación GPS · {branch.nombre}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Tanto el Administrador como el Encargado de esta sucursal pueden actualizar su dirección, teléfono, RUC, foto y coordenadas GPS.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSavedOk(false);
          mutation.mutate();
        }}
        className="mt-4 space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bd-nombre" className="input-label">
              Nombre de la sucursal
            </label>
            <input
              id="bd-nombre"
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={!canEdit}
              required
            />
          </div>
          <div>
            <label htmlFor="bd-direccion" className="input-label">
              Dirección del local
            </label>
            <input
              id="bd-direccion"
              className="input"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              disabled={!canEdit}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="bd-telefono" className="input-label">
              Teléfono / WhatsApp
            </label>
            <input
              id="bd-telefono"
              className="input"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              disabled={!canEdit}
              placeholder="+51987654321"
            />
          </div>
          <div>
            <label htmlFor="bd-ruc" className="input-label">
              RUC (11 dígitos, opcional)
            </label>
            <input
              id="bd-ruc"
              className="input"
              value={ruc}
              maxLength={11}
              onChange={(e) => setRuc(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label htmlFor="bd-razon" className="input-label">
              Razón social (opcional)
            </label>
            <input
              id="bd-razon"
              className="input"
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>

        {/* Foto de la sucursal */}
        <div className="rounded-xl border border-border p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="input-label !mb-0 flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-primary" />
              Foto / Logo de la Sucursal
            </span>
            {canEdit ? (
              <label className="btn-secondary !px-3 !py-1 text-xs cursor-pointer">
                <Camera className="h-3.5 w-3.5" />
                Subir foto desde mi equipo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBranchPhotoUpload}
                />
              </label>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {fotoUrl ? (
              <img
                src={fotoUrl}
                alt={nombre}
                className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Store className="h-6 w-6" />
              </div>
            )}
            <input
              type="text"
              className="input flex-1 text-xs"
              placeholder="URL de la foto de la sucursal o sube un archivo"
              value={fotoUrl}
              onChange={(e) => setFotoUrl(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>

        {/* Ubicación GPS */}
        <div className="rounded-xl border border-border p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="input-label !mb-0 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              Ubicación GPS de la Sucursal (para cálculo de distancia de repartidores)
            </span>
            {canEdit ? (
              <button
                type="button"
                onClick={fillGps}
                className="btn-secondary !px-3 !py-1 text-xs"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                Usar mi ubicación GPS
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="bd-lat" className="text-xs text-muted-foreground">
                Latitud
              </label>
              <input
                id="bd-lat"
                className="input mt-0.5"
                inputMode="decimal"
                placeholder="-12.046374"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label htmlFor="bd-lng" className="text-xs text-muted-foreground">
                Longitud
              </label>
              <input
                id="bd-lng"
                className="input mt-0.5"
                inputMode="decimal"
                placeholder="-77.042793"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
          {geoError ? <p className="text-xs text-destructive">{geoError}</p> : null}
        </div>

        {mutation.isError ? (
          <ErrorNote
            message={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : "No se pudieron guardar los datos de la sucursal"
            }
          />
        ) : null}

        {savedOk ? (
          <div className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-xs font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" />
            Datos, foto y ubicación de la sucursal actualizados correctamente.
          </div>
        ) : null}

        {canEdit ? (
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="h-4 w-4" /> : null}
              Guardar datos de la sucursal
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}

/**
 * Pestaña 4: Usuarios y Encargados de la Sucursal (`branch_demo`, `kitchen_demo`, etc.)
 */
function BranchUsersPanel({
  branch,
  allUsers,
  canEdit,
  isAdmin,
}: {
  branch: Sucursal;
  allUsers: UsuarioSistema[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Solo los usuarios con rol ENCARGADO_SUCURSAL pertenecen a sucursales específicas
  const encargadosDisponibles = allUsers.filter(
    (u) => u.rol === "ENCARGADO_SUCURSAL"
  );
  const usuariosGlobales = allUsers.filter(
    (u) =>
      u.rol === "ADMINISTRADOR" ||
      u.rol === "COORDINADOR" ||
      u.rol === "AGENTE_SOPORTE"
  );

  const assignMutation = useMutation({
    mutationFn: (input: { userId: string; branchIds: string[] }) =>
      api.put(`/users/${input.userId}/branches`, {
        sucursal_ids: input.branchIds,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  const createManagerMutation = useMutation({
    mutationFn: () =>
      api.post("/users", {
        nombre_usuario: newUsername.trim(),
        nombre_mostrado: newDisplayName.trim(),
        password: newPassword,
        rol: "ENCARGADO_SUCURSAL",
        sucursal_ids: [branch.id],
      }),
    onSuccess: () => {
      setNewUsername("");
      setNewDisplayName("");
      setNewPassword("");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Nota de Arquitectura de Roles */}
      <div className="card border-l-4 border-l-primary p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-foreground">
              Regla de Alcance de Usuarios y Sucursales
            </p>
            <p className="text-muted-foreground">
              • <strong>Administrador (`admin_demo`)</strong>, <strong>Coordinador (`coordinator_demo`)</strong> y <strong>Agente de soporte (`support_demo`)</strong> <u>no pertenecen a ninguna sucursal individual</u>. El Administrador administra todas las sucursales creadas.
            </p>
            <p className="text-muted-foreground">
              • Cada sucursal creada es administrada directamente por su <strong>Encargado de sucursal</strong> (como <code>branch_demo</code> o <code>kitchen_demo</code>), quien gestiona sus platos, precios, categorías, fotos, ubicación y personal.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Encargados de Sucursal para asignar/desasignar a esta sucursal */}
      <div className="card p-4 space-y-3">
        <h3 className="text-base font-bold text-foreground">
          Encargados de Sucursal (`ENCARGADO_SUCURSAL`) · {branch.nombre}
        </h3>
        <p className="text-xs text-muted-foreground">
          Marca o asigna qué Encargado(s) administran <strong>{branch.nombre}</strong>.
        </p>

        <div className="divide-y divide-border rounded-lg border border-border">
          {encargadosDisponibles.map((u) => {
            const assignedHere = u.sucursales.some((s) => s.id === branch.id);
            return (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      {u.nombre_mostrado}
                    </span>
                    <Badge className="font-mono text-xs bg-muted text-foreground">
                      @{u.nombre_usuario}
                    </Badge>
                    {assignedHere ? (
                      <Badge className="bg-success-soft text-success">
                        Encargado de {branch.nombre}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sucursal(es) asignadas:{" "}
                    {u.sucursales.length > 0
                      ? u.sucursales.map((s) => s.nombre).join(", ")
                      : "Ninguna"}
                  </p>
                </div>

                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={assignMutation.isPending}
                      onClick={() => {
                        // Asignar exclusivamente a esta sucursal para evitar mezclar sucursales
                        assignMutation.mutate({
                          userId: u.id,
                          branchIds: assignedHere
                            ? u.sucursales
                                .filter((s) => s.id !== branch.id)
                                .map((s) => s.id)
                            : [branch.id],
                        });
                      }}
                      className={
                        assignedHere
                          ? "btn-secondary !px-3 !py-1.5 text-xs"
                          : "btn-primary !px-3 !py-1.5 text-xs"
                      }
                    >
                      {assignedHere
                        ? `Quitar de ${branch.nombre}`
                        : `Asignar a ${branch.nombre}`}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulario para crear un nuevo Encargado / Usuario de esta sucursal */}
      {canEdit ? (
        <div className="card p-4 space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <UserPlus className="h-4 w-4 text-primary" />
            Crear nuevo Encargado para {branch.nombre}
          </h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createManagerMutation.mutate();
            }}
            className="grid gap-3 sm:grid-cols-4"
          >
            <input
              type="text"
              className="input"
              placeholder="Usuario (ej. encargado_sur)"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
              minLength={3}
            />
            <input
              type="text"
              className="input"
              placeholder="Nombre completo"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              required
              minLength={2}
            />
            <input
              type="password"
              className="input"
              placeholder="Contraseña (mín. 6)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={createManagerMutation.isPending}
            >
              {createManagerMutation.isPending ? (
                <Spinner className="h-4 w-4" />
              ) : null}
              Crear y asignar
            </button>
          </form>
          {createManagerMutation.isError ? (
            <ErrorNote
              message={
                createManagerMutation.error instanceof ApiError
                  ? createManagerMutation.error.message
                  : "No se pudo crear el usuario"
              }
            />
          ) : null}
        </div>
      ) : null}

      {/* Usuarios Globales (Informativo) */}
      {usuariosGlobales.length > 0 ? (
        <div className="card p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Roles Globales del Sistema (No pertenecen a ninguna sucursal individual)
          </h4>
          <div className="flex flex-wrap gap-2">
            {usuariosGlobales.map((u) => (
              <div
                key={u.id}
                className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs"
              >
                <span className="font-bold text-foreground">
                  {u.nombre_mostrado}
                </span>{" "}
                <span className="font-mono text-muted-foreground">
                  (@{u.nombre_usuario})
                </span>{" "}
                · <span className="text-primary font-semibold">{u.rol}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Modal para crear una nueva sucursal independiente desde el Catálogo (Solo Admin)
 */
function CreateBranchModal({
  users,
  onClose,
  onCreated,
}: {
  users: UsuarioSistema[];
  onClose: () => void;
  onCreated: (branchId?: string) => void;
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

  const encargados = users.filter((u) => u.rol === "ENCARGADO_SUCURSAL");

  const mutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<Sucursal>>("/catalog/branches", {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim() || undefined,
        ruc: ruc.trim() || undefined,
        latitud: lat.trim() ? Number(lat) : null,
        longitud: lng.trim() ? Number(lng) : null,
        foto_url: fotoUrl.trim() || undefined,
        encargado_ids: encargadoId ? [encargadoId] : undefined,
      }),
    onSuccess: (res) => {
      for (const key of ["branches", "restaurants", "categories", "products", "users"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      onCreated(res.data?.id);
    },
  });

  return (
    <Modal title="Nueva sucursal independiente" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nb-nombre" className="input-label">
              Nombre de la sucursal
            </label>
            <input
              id="nb-nombre"
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              minLength={2}
              placeholder="Ej. Sucursal San Isidro"
            />
          </div>
          <div>
            <label htmlFor="nb-encargado" className="input-label">
              Encargado de sucursal (opcional)
            </label>
            <select
              id="nb-encargado"
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
          <label htmlFor="nb-dir" className="input-label">
            Dirección física
          </label>
          <input
            id="nb-dir"
            className="input"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            required
            minLength={3}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nb-tel" className="input-label">
              Teléfono / WhatsApp
            </label>
            <input
              id="nb-tel"
              className="input"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+51987654321"
            />
          </div>
          <div>
            <label htmlFor="nb-ruc" className="input-label">
              RUC (11 dígitos, opcional)
            </label>
            <input
              id="nb-ruc"
              className="input"
              maxLength={11}
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nb-lat" className="input-label">
              Latitud GPS
            </label>
            <input
              id="nb-lat"
              className="input"
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="-12.097"
            />
          </div>
          <div>
            <label htmlFor="nb-lng" className="input-label">
              Longitud GPS
            </label>
            <input
              id="nb-lng"
              className="input"
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="-77.036"
            />
          </div>
        </div>

        <div>
          <label htmlFor="nb-foto" className="input-label">
            URL de Foto de la sucursal (opcional)
          </label>
          <input
            id="nb-foto"
            className="input"
            value={fotoUrl}
            onChange={(e) => setFotoUrl(e.target.value)}
            placeholder="https://..."
          />
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
