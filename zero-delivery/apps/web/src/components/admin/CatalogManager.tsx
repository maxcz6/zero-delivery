"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  PackagePlus,
  Pencil,
  Search,
  Store,
} from "lucide-react";
import { centsToSoles, solesToCents } from "@zero-delivery/shared-types";
import { api, ApiError, money, toCents } from "@/lib/api";
import { fetchMe } from "@/lib/auth";
import type {
  ApiResponse,
  CategoriaCatalogo,
  ProductoCatalogo,
  Sucursal,
} from "@/lib/types";
import {
  Badge,
  EmptyState,
  ErrorNote,
  Modal,
  PageLoader,
  Spinner,
} from "@/components/ui";

interface Restaurante {
  id: string;
  nombre: string;
}

export function CatalogManager({ title = "Catálogo" }: { title?: string }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [restauranteId, setRestauranteId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [priceFor, setPriceFor] = useState<ProductoCatalogo | null>(null);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000 });
  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<ApiResponse<Sucursal[]>>("/catalog/branches"),
  });
  const restaurantsQuery = useQuery({
    queryKey: ["restaurants"],
    queryFn: () => api.get<ApiResponse<Restaurante[]>>("/catalog/restaurants"),
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

  const products = productsQuery.data?.data ?? [];
  const restaurantes = restaurantsQuery.data?.data ?? [];
  const restauranteSeleccionado = restauranteId || restaurantes[0]?.id || "";

  const branchScope = meQuery.data?.branchIds ?? [];
  const misSucursales = (branchesQuery.data?.data ?? []).filter(
    (b) => branchScope.length === 0 || branchScope.includes(b.id)
  );

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = restauranteId
      ? products.filter((p) => p.restaurante_id === restauranteId)
      : products;
    if (!q) return base;
    return base.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.categoria?.nombre ?? "").toLowerCase().includes(q)
    );
  }, [products, query, restauranteId]);

  if (productsQuery.isLoading) return <PageLoader label="Cargando catálogo…" />;
  if (productsQuery.isError) {
    return (
      <ErrorNote
        message={
          productsQuery.error instanceof ApiError
            ? productsQuery.error.message
            : "No se pudo conectar con la API"
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <section aria-label="Sucursales" className="card p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-foreground">
          <Store className="h-4 w-4 text-primary" aria-hidden />
          Apertura de sucursales
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {misSucursales.map((branch) => (
            <div
              key={branch.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {branch.nombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  {branch.apertura_manual ? "Abierta" : "Cerrada"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={branch.apertura_manual}
                aria-label={`Abrir o cerrar ${branch.nombre}`}
                onClick={() =>
                  toggleBranchMutation.mutate({
                    branchId: branch.id,
                    apertura_manual: !branch.apertura_manual,
                  })
                }
                disabled={toggleBranchMutation.isPending}
                className={`relative h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
                  branch.apertura_manual ? "bg-[#059669]" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                    branch.apertura_manual ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          ))}
          {misSucursales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin sucursales asignadas.</p>
          ) : null}
        </div>
        {toggleBranchMutation.isError ? (
          <div className="mt-3">
            <ErrorNote
              message={
                toggleBranchMutation.error instanceof ApiError
                  ? toggleBranchMutation.error.message
                  : "No se pudo cambiar la apertura de la sucursal"
              }
            />
          </div>
        ) : null}
      </section>

      <section aria-label={title} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="catalog-search" className="input-label">
              Buscar producto
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
                placeholder="Nombre o categoría"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="min-w-[180px]">
            <label htmlFor="catalog-restaurant" className="input-label">
              Restaurante
            </label>
            <select
              id="catalog-restaurant"
              className="input cursor-pointer"
              value={restauranteId}
              onChange={(e) => setRestauranteId(e.target.value)}
            >
              <option value="">Todos</option>
              {restaurantes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-primary min-h-[44px]"
          >
            <PackagePlus className="h-4 w-4" aria-hidden />
            Nuevo producto
          </button>
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

        {filtrados.length === 0 ? (
          <EmptyState title="Sin productos" hint="Crea un producto para comenzar." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-right font-semibold">Precio base</th>
                  <th className="px-4 py-3 text-right font-semibold">Empaque</th>
                  <th className="px-4 py-3 font-semibold">Disponible</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((producto) => (
                  <tr
                    key={producto.id}
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {producto.nombre}
                        </span>
                        {producto.es_fragil ? (
                          <Badge className="border border-destructive/30 bg-destructive/5 text-destructive">
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            Frágil
                          </Badge>
                        ) : null}
                        {!producto.esta_activo ? (
                          <Badge className="bg-muted text-muted-foreground">Archivado</Badge>
                        ) : null}
                      </div>
                      {producto.descripcion ? (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                          {producto.descripcion}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {producto.categoria?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
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
                        disabled={statusMutation.isPending}
                        className={`relative h-8 w-14 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
                          producto.esta_activo ? "bg-[#059669]" : "bg-border"
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
                      <button
                        type="button"
                        onClick={() => setPriceFor(producto)}
                        className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Precio
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createOpen ? (
        <CreateProductModal
          restaurantes={restaurantes}
          restauranteId={restauranteSeleccionado}
          categorias={categoriesQuery.data?.data ?? []}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["products"] });
            setCreateOpen(false);
          }}
        />
      ) : null}

      {priceFor ? (
        <PriceModal
          producto={priceFor}
          onClose={() => setPriceFor(null)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["products"] });
            setPriceFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateProductModal({
  restaurantes,
  restauranteId,
  categorias,
  onClose,
  onSuccess,
}: {
  restaurantes: Restaurante[];
  restauranteId: string;
  categorias: CategoriaCatalogo[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [restaurante, setRestaurante] = useState(restauranteId);
  const [categoria, setCategoria] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [empaque, setEmpaque] = useState("");
  const [fragil, setFragil] = useState(false);

  const categoriasFiltradas = categorias.filter(
    (c) => !restaurante || c.restaurante_id === restaurante
  );

  const precioCentavos = solesToCents(Number(precio) || 0);
  const empaqueCentavos = empaque.trim() ? solesToCents(Number(empaque)) : 0;

  const mutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<ProductoCatalogo>>("/catalog/products", {
        restaurante_id: restaurante,
        categoria_id: categoria,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        precio_base_centavos: String(precioCentavos),
        empaque_centavos: String(empaqueCentavos),
        es_fragil: fragil,
      }),
    onSuccess,
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (restaurante && categoria && nombre.trim().length >= 2 && precioCentavos > 0) {
      mutation.mutate();
    }
  }

  return (
    <Modal title="Nuevo producto" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nuevo-restaurante" className="input-label">
              Restaurante
            </label>
            <select
              id="nuevo-restaurante"
              className="input cursor-pointer"
              value={restaurante}
              onChange={(e) => {
                setRestaurante(e.target.value);
                setCategoria("");
              }}
              required
            >
              <option value="">Selecciona…</option>
              {restaurantes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nuevo-categoria" className="input-label">
              Categoría
            </label>
            <select
              id="nuevo-categoria"
              className="input cursor-pointer"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              required
            >
              <option value="">Selecciona…</option>
              {categoriasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {categoriasFiltradas.length === 0 ? (
              <span className="text-xs text-warning">
                No hay categorías para este restaurante.
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <label htmlFor="nuevo-nombre" className="input-label">
            Nombre
          </label>
          <input
            id="nuevo-nombre"
            type="text"
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            minLength={2}
          />
        </div>

        <div>
          <label htmlFor="nuevo-descripcion" className="input-label">
            Descripción (opcional)
          </label>
          <textarea
            id="nuevo-descripcion"
            className="input min-h-20 resize-y"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nuevo-precio" className="input-label">
              Precio base (S/)
            </label>
            <input
              id="nuevo-precio"
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
            <label htmlFor="nuevo-empaque" className="input-label">
              Empaque (S/, opcional)
            </label>
            <input
              id="nuevo-empaque"
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

        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            className="h-5 w-5 cursor-pointer accent-[#2563EB]"
            checked={fragil}
            onChange={(e) => setFragil(e.target.checked)}
          />
          Producto frágil (requiere empaque especial)
        </label>

        {mutation.isError ? (
          <ErrorNote
            message={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : "No se pudo crear el producto"
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
              !restaurante ||
              !categoria ||
              nombre.trim().length < 2 ||
              precioCentavos <= 0
            }
          >
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : null}
            Crear producto
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PriceModal({
  producto,
  onClose,
  onSuccess,
}: {
  producto: ProductoCatalogo;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [precio, setPrecio] = useState(String(centsToSoles(toCents(producto.precio_base_centavos))));

  const mutation = useMutation({
    mutationFn: (precioBaseCentavos: string) =>
      api.patch<ApiResponse<ProductoCatalogo>>(
        `/catalog/products/${producto.id}/price`,
        { precio_base_centavos: precioBaseCentavos }
      ),
    onSuccess,
  });

  const precioCentavos = solesToCents(Number(precio) || 0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (precioCentavos > 0) mutation.mutate(String(precioCentavos));
  }

  return (
    <Modal title={`Precio · ${producto.nombre}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Precio actual: <span className="font-semibold text-foreground">
            {money(producto.precio_base_centavos)}
          </span>
        </div>
        <div>
          <label htmlFor="editar-precio" className="input-label">
            Nuevo precio base (S/)
          </label>
          <input
            id="editar-precio"
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
        {mutation.isError ? (
          <ErrorNote
            message={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : "No se pudo actualizar el precio"
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
            disabled={mutation.isPending || precioCentavos <= 0}
          >
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : null}
            Guardar precio
          </button>
        </div>
      </form>
    </Modal>
  );
}
