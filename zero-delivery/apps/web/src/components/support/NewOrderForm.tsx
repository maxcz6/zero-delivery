"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckCircle2,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { api, ApiError, money, toCents } from "@/lib/api";
import { orderNumber } from "@/lib/orders";
import type {
  ApiResponse,
  Pedido,
  ProductoCatalogo,
  Sucursal,
} from "@/lib/types";
import { ErrorNote, PageLoader, Spinner } from "@/components/ui";

interface Linea {
  productoId: string;
  cantidad: number;
}

const METODOS = [
  { value: "EFECTIVO", label: "Efectivo (cobro contra entrega)" },
  { value: "YAPE", label: "Yape (validación posterior)" },
  { value: "TRANSFERENCIA_BANCARIA", label: "Transferencia bancaria" },
] as const;

export function NewOrderForm() {
  const queryClient = useQueryClient();
  const [sucursalId, setSucursalId] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [metodoPago, setMetodoPago] = useState<(typeof METODOS)[number]["value"]>("EFECTIVO");
  const [notas, setNotas] = useState("");
  const [factura, setFactura] = useState(false);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [productoParaAgregar, setProductoParaAgregar] = useState("");
  const [creado, setCreado] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<ApiResponse<Sucursal[]>>("/catalog/branches"),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "active"],
    queryFn: () => api.get<ApiResponse<ProductoCatalogo[]>>("/catalog/products"),
  });

  const sucursales = branchesQuery.data?.data ?? [];
  const productos = productsQuery.data?.data ?? [];
  const sucursalElegida = sucursalId || sucursales[0]?.id || "";

  const productosPorId = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos]
  );

  const totalCentavos = lineas.reduce((acc, linea) => {
    const producto = productosPorId.get(linea.productoId);
    if (!producto) return acc;
    const unitario =
      toCents(producto.precio_base_centavos) + toCents(producto.empaque_centavos);
    return acc + unitario * linea.cantidad;
  }, 0);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<Pedido>>("/orders", {
        sucursal_id: sucursalElegida,
        cliente_nuevo: {
          nombre: nombre.trim(),
          telefono_e164: normalizarTelefono(telefono),
        },
        direccion_snapshot: {
          texto_direccion: direccion.trim(),
          referencia: referencia.trim() || undefined,
        },
        metodo_pago: metodoPago,
        canal: "MANUAL",
        factura_solicitada: factura,
        notas: notas.trim() || undefined,
        clave_idempotencia:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : undefined,
        items: lineas.map((linea) => ({
          producto_id: linea.productoId,
          cantidad: linea.cantidad,
          modificadores: [],
        })),
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCreado(res.data);
      setError(null);
      setLineas([]);
      setNombre("");
      setTelefono("");
      setDireccion("");
      setReferencia("");
      setNotas("");
      setFactura(false);
      setMetodoPago("EFECTIVO");
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "No se pudo crear el pedido"
      );
    },
  });

  function agregarProducto() {
    if (!productoParaAgregar) return;
    setLineas((prev) => {
      const existente = prev.find((l) => l.productoId === productoParaAgregar);
      if (existente) {
        return prev.map((l) =>
          l.productoId === productoParaAgregar
            ? { ...l, cantidad: l.cantidad + 1 }
            : l
        );
      }
      return [...prev, { productoId: productoParaAgregar, cantidad: 1 }];
    });
    setProductoParaAgregar("");
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setLineas((prev) =>
      prev
        .map((l) =>
          l.productoId === productoId ? { ...l, cantidad: l.cantidad + delta } : l
        )
        .filter((l) => l.cantidad > 0)
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!sucursalElegida || !nombre.trim() || !telefono.trim() || direccion.trim().length < 3) {
      setError("Completa sucursal, cliente, teléfono y dirección.");
      return;
    }
    if (lineas.length === 0) {
      setError("Agrega al menos un producto al pedido.");
      return;
    }
    mutation.mutate();
  }

  if (branchesQuery.isLoading || productsQuery.isLoading) {
    return <PageLoader label="Cargando catálogo…" />;
  }
  if (branchesQuery.isError || productsQuery.isError) {
    const err = branchesQuery.error ?? productsQuery.error;
    return (
      <ErrorNote
        message={err instanceof ApiError ? err.message : "No se pudo conectar con la API"}
      />
    );
  }

  if (creado) {
    return (
      <div className="card mx-auto max-w-lg space-y-4 p-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Pedido {orderNumber(creado)} creado
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Total {money(creado.total_centavos)} ·{" "}
            {creado.metodo_pago === "EFECTIVO"
              ? "cobro en efectivo contra entrega"
              : "pago digital pendiente de validación"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/orders" className="btn-secondary">
            Ver pedidos activos
          </Link>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setCreado(null)}
          >
            Crear otro pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card space-y-3 p-4 lg:col-span-2" aria-label="Datos del pedido">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
            Datos del cliente
          </h2>

          <div>
            <label htmlFor="pedido-sucursal" className="input-label">
              Sucursal
            </label>
            <select
              id="pedido-sucursal"
              className="input cursor-pointer"
              value={sucursalElegida}
              onChange={(e) => setSucursalId(e.target.value)}
              required
            >
              <option value="">Selecciona…</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                  {s.apertura_manual ? "" : " (cerrada)"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pedido-nombre" className="input-label">
                Nombre del cliente
              </label>
              <input
                id="pedido-nombre"
                type="text"
                className="input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                minLength={2}
                required
              />
            </div>
            <div>
              <label htmlFor="pedido-telefono" className="input-label">
                Teléfono
              </label>
              <input
                id="pedido-telefono"
                type="tel"
                className="input"
                placeholder="987 654 321"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
              />
              <span className="text-xs text-muted-foreground">
                Se normaliza a formato +51.
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="pedido-direccion" className="input-label">
              Dirección de entrega
            </label>
            <input
              id="pedido-direccion"
              type="text"
              className="input"
              placeholder="Av. Ejemplo 123, Dpto. 401"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              minLength={3}
              required
            />
          </div>
          <div>
            <label htmlFor="pedido-referencia" className="input-label">
              Referencia (opcional)
            </label>
            <input
              id="pedido-referencia"
              type="text"
              className="input"
              placeholder="Frente al parque, portón negro"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pedido-notas" className="input-label">
              Notas de preparación (opcional)
            </label>
            <textarea
              id="pedido-notas"
              className="input min-h-20 resize-y"
              placeholder="Sin cebolla, salsa aparte…"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </section>

        <section className="card space-y-3 p-4" aria-label="Pago">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
            Pago
          </h2>
          <div>
            <label htmlFor="pedido-metodo" className="input-label">
              Método de pago
            </label>
            <select
              id="pedido-metodo"
              className="input cursor-pointer"
              value={metodoPago}
              onChange={(e) =>
                setMetodoPago(e.target.value as (typeof METODOS)[number]["value"])
              }
            >
              {METODOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              className="h-5 w-5 cursor-pointer accent-primary"
              checked={factura}
              onChange={(e) => setFactura(e.target.checked)}
            />
            Cliente solicita factura
          </label>

          <div className="rounded-lg bg-muted px-3 py-3">
            <p className="text-xs font-medium text-muted-foreground">Total estimado</p>
            <p className="text-2xl font-bold text-foreground">
              {money(totalCentavos)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {metodoPago === "EFECTIVO"
                ? `El repartidor cobrará ${money(totalCentavos)} al entregar.`
                : "El pago quedará pendiente hasta validar el comprobante."}
            </p>
          </div>
        </section>
      </div>

      <section className="card space-y-3 p-4" aria-label="Productos">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
          Productos
        </h2>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="pedido-producto" className="input-label">
              Agregar producto
            </label>
            <select
              id="pedido-producto"
              className="input cursor-pointer"
              value={productoParaAgregar}
              onChange={(e) => setProductoParaAgregar(e.target.value)}
            >
              <option value="">Selecciona un producto…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {money(p.precio_base_centavos)}
                  {toCents(p.empaque_centavos) > 0
                    ? ` (+${money(p.empaque_centavos)} empaque)`
                    : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={agregarProducto}
            disabled={!productoParaAgregar}
            className="btn-secondary min-h-[48px]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Agregar
          </button>
        </div>

        {productos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay productos activos en el catálogo.
          </p>
        ) : null}

        {lineas.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <ShoppingBag className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-semibold text-muted-foreground">
              El pedido está vacío
            </p>
            <p className="text-xs text-muted-foreground">
              Agrega productos para calcular el total.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {lineas.map((linea) => {
              const producto = productosPorId.get(linea.productoId);
              if (!producto) return null;
              const unitario =
                toCents(producto.precio_base_centavos) +
                toCents(producto.empaque_centavos);
              return (
                <li
                  key={linea.productoId}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {producto.nombre}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {money(unitario)} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Quitar una unidad de ${producto.nombre}`}
                      onClick={() => cambiarCantidad(linea.productoId, -1)}
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"
                    >
                      <Minus className="h-4 w-4" aria-hidden />
                    </button>
                    <span className="min-w-[32px] text-center text-sm font-bold text-foreground">
                      {linea.cantidad}
                    </span>
                    <button
                      type="button"
                      aria-label={`Agregar una unidad de ${producto.nombre}`}
                      onClick={() => cambiarCantidad(linea.productoId, 1)}
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <p className="w-20 text-right text-sm font-bold text-foreground">
                    {money(unitario * linea.cantidad)}
                  </p>
                  <button
                    type="button"
                    aria-label={`Eliminar ${producto.nombre}`}
                    onClick={() =>
                      setLineas((prev) =>
                        prev.filter((l) => l.productoId !== linea.productoId)
                      )
                    }
                    className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error ? <ErrorNote message={error} /> : null}
      {mutation.isError && !error ? (
        <ErrorNote
          message={
            mutation.error instanceof ApiError
              ? mutation.error.message
              : "No se pudo crear el pedido"
          }
        />
      ) : null}

      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {lineas.length} {lineas.length === 1 ? "producto" : "productos"} ·{" "}
          <span className="font-bold text-foreground">{money(totalCentavos)}</span>
        </p>
        <button
          type="submit"
          className="btn-primary min-h-[52px] px-8 text-base"
          disabled={mutation.isPending || lineas.length === 0}
        >
          {mutation.isPending ? <Spinner className="h-5 w-5" /> : null}
          Crear pedido manual
        </button>
      </div>
    </form>
  );
}

function normalizarTelefono(raw: string): string {
  const limpio = raw.replace(/[\s()-]/g, "");
  if (limpio.startsWith("+")) return limpio;
  if (limpio.startsWith("51") && limpio.length >= 11) return `+${limpio}`;
  return `+51${limpio}`;
}
