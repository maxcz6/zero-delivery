"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import type { EstadoOperativoPedidoDb } from "@zero-delivery/shared-types";
import { api, ApiError } from "@/lib/api";
import type { ApiResponse, Pedido, Sucursal } from "@/lib/types";
import { droppableTarget, KANBAN_COLUMNS, STATES_REQUIRING_MOTIVO } from "@/lib/orders";
import { useCoordinatorStore } from "@/store/coordinator-store";
import { ErrorNote, PageLoader } from "@/components/ui";
import { OrderCard } from "./OrderCard";
import { YapeModal } from "./YapeModal";
import { AssignRiderModal } from "./AssignRiderModal";
import { RestaurantPaymentModal } from "./RestaurantPaymentModal";
import { MotivoModal } from "./MotivoModal";

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const sucursalId = useCoordinatorStore((s) => s.sucursalId);
  const query = useCoordinatorStore((s) => s.query);
  const modal = useCoordinatorStore((s) => s.modal);
  const { setSucursalId, setQuery, openModal, closeModal } = useCoordinatorStore();

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<ApiResponse<Sucursal[]>>("/catalog/branches"),
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", "active", sucursalId],
    queryFn: () =>
      api.get<ApiResponse<Pedido[]>>(
        `/orders/active${sucursalId ? `?sucursalId=${encodeURIComponent(sucursalId)}` : ""}`
      ),
    refetchInterval: 8_000,
  });

  const transitionMutation = useMutation({
    mutationFn: (input: {
      pedidoId: string;
      nuevoEstado: EstadoOperativoPedidoDb;
      motivo?: string;
      version?: number;
    }) =>
      api.post<ApiResponse<Pedido>>(`/orders/${input.pedidoId}/transition`, {
        nuevo_estado: input.nuevoEstado,
        motivo: input.motivo,
        version: input.version,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const pedidos = ordersQuery.data?.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pedidos;
    const numeric = q.replace(/^#/, "");
    return pedidos.filter((p) => {
      const numero = String(Number(p.numero) || p.numero);
      const cliente = (p.cliente?.nombre ?? "").toLowerCase();
      return numero === numeric || numero.includes(numeric) || cliente.includes(q);
    });
  }, [pedidos, query]);

  function handleDrop(columnStates: EstadoOperativoPedidoDb[], dataTransfer: DataTransfer) {
    const pedidoId = dataTransfer.getData("text/plain");
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return;
    const target = droppableTarget(pedido.estado_operativo, columnStates);
    if (!target) return;
    if (STATES_REQUIRING_MOTIVO.includes(target)) {
      openModal({ type: "motivo", pedidoId: pedido.id, nuevoEstado: target });
      return;
    }
    transitionMutation.mutate({ pedidoId: pedido.id, nuevoEstado: target, version: pedido.version });
  }

  if (ordersQuery.isLoading) return <PageLoader label="Cargando pedidos activos…" />;
  if (ordersQuery.isError) {
    const message =
      ordersQuery.error instanceof ApiError
        ? ordersQuery.error.message
        : "No se pudo conectar con la API";
    return <ErrorNote message={message} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 md:col-span-4">
          <label htmlFor="sucursal-filter" className="input-label">
            Sucursal
          </label>
          <select
            id="sucursal-filter"
            className="input cursor-pointer"
            value={sucursalId ?? ""}
            onChange={(e) => setSucursalId(e.target.value || null)}
          >
            <option value="">Todas las sucursales</option>
            {(branchesQuery.data?.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-12 md:col-span-5">
          <label htmlFor="order-search" className="input-label">
            Buscar por número o cliente
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="order-search"
              type="search"
              inputMode="numeric"
              className="input pl-9"
              placeholder="Ej. 0007 o María"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="col-span-12 flex items-end md:col-span-3">
          <p className="text-xs text-muted-foreground">
            {pedidos.length} pedidos activos · arrastra las tarjetas entre columnas
          </p>
        </div>
      </div>

      {transitionMutation.isError ? (
        <ErrorNote
          message={
            transitionMutation.error instanceof ApiError
              ? transitionMutation.error.message
              : "Falló la transición del pedido"
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KANBAN_COLUMNS.map((column) => {
          const columnOrders = filtered.filter((p) =>
            column.states.includes(p.estado_operativo)
          );
          return (
            <section
              key={column.key}
              aria-label={column.title}
              className="flex min-w-0 flex-col rounded-card bg-muted/60 p-2"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(column.states, e.dataTransfer);
              }}
            >
              <header className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {column.title}
                </h2>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-foreground shadow-sm">
                  {columnOrders.length}
                </span>
              </header>
              <div className="flex flex-1 flex-col gap-2">
                {columnOrders.map((pedido) => (
                  <OrderCard
                    key={pedido.id}
                    pedido={pedido}
                    alertMinutes={column.alertMinutes}
                    actions={{
                      onValidateYape: (p) => openModal({ type: "yape", pedidoId: p.id }),
                      onAssignRider: (p) => openModal({ type: "assign", pedidoId: p.id }),
                      onRestaurantPayment: (p) =>
                        openModal({ type: "restaurant", pedidoId: p.id }),
                    }}
                  />
                ))}
                {columnOrders.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-2 py-6 text-center text-xs text-muted-foreground">
                    Sin pedidos
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {modal?.type === "yape" ? (
        <YapeModal pedidoId={modal.pedidoId} onClose={closeModal} />
      ) : null}
      {modal?.type === "assign" ? (
        <AssignRiderModal pedidoId={modal.pedidoId} onClose={closeModal} />
      ) : null}
      {modal?.type === "restaurant" ? (
        <RestaurantPaymentModal pedidoId={modal.pedidoId} onClose={closeModal} />
      ) : null}
      {modal?.type === "motivo" ? (
        <MotivoModal
          pedido={pedidos.find((p) => p.id === modal.pedidoId)}
          pedidoId={modal.pedidoId}
          nuevoEstado={modal.nuevoEstado}
          onClose={closeModal}
        />
      ) : null}
    </div>
  );
}
