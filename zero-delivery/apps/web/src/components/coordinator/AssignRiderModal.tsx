"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Banknote, Bike, Car, CheckCircle2, MapPin, Navigation, ShieldCheck, Star, Store } from "lucide-react";
import { api, ApiError, money } from "@/lib/api";
import type { ApiResponse, Pedido } from "@/lib/types";
import { Badge, ErrorNote, Modal, Spinner } from "@/components/ui";

interface RiderRecommendation {
  id: string;
  nombre_completo: string;
  telefono: string;
  tipo_vehiculo: "MOTO" | "AUTO";
  estado: string;
  alta_confianza: boolean;
  flota: string | null;
  estrellas: number | null;
  n_calificaciones: number;
  distancia_sucursal_km: number | null;
  saldo_centavos: string;
  entregas_activas: number;
  elegible: boolean;
  motivos_no_elegible: string[];
  score: number;
  razones: string[];
  recomendado: boolean;
}

interface Recommendations {
  pedido: {
    numero: string | number;
    metodo_pago: string;
    estado_pago: string;
    es_contra_entrega: boolean;
    total_centavos: string;
    cliente_nombre: string;
    direccion_entrega: string | null;
    sucursal_nombre: string;
    distancia_sucursal_cliente_km: number | null;
    tiene_fragiles: boolean;
  };
  garantia_minima_centavos: string;
  advertencias: string[];
  repartidores: RiderRecommendation[];
}

const ESTADO: Record<string, { label: string; className: string }> = {
  DISPONIBLE: { label: "Disponible", className: "bg-success text-white" },
  OCUPADO: { label: "Ocupado", className: "bg-warning text-white" },
  EN_CAMINO: { label: "En camino", className: "bg-primary text-white" },
  DESCONECTADO: { label: "Desconectado", className: "bg-muted text-muted-foreground" },
};

function Stars({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">Sin calificaciones</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-warning">
      <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
      {value.toFixed(1)}
    </span>
  );
}

/**
 * Asignación de repartidor con recomendación del sistema: estrellas, distancia a la sucursal,
 * disponibilidad, garantía (si es contra entrega) y confianza. Usable por Admin, Coordinador y Soporte.
 */
export function AssignRiderModal({ pedidoId, onClose }: { pedidoId: string; onClose: () => void }) {
  const queryClient = useQueryClient();

  const recQuery = useQuery({
    queryKey: ["recommendations", pedidoId],
    queryFn: () => api.get<ApiResponse<Recommendations>>(`/logistics/orders/${pedidoId}/recommendations`),
    refetchInterval: 20_000,
  });

  const assignMutation = useMutation({
    mutationFn: (repartidorId: string) =>
      api.post<ApiResponse<Pedido>>(`/logistics/orders/${pedidoId}/assign-rider`, {
        repartidor_id: repartidorId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["riders"] });
      void queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      onClose();
    },
  });

  const rec = recQuery.data?.data;
  const p = rec?.pedido;

  return (
    <Modal title={p ? `Asignar repartidor · #${String(Number(p.numero) || p.numero).padStart(4, "0")}` : "Asignar repartidor"} onClose={onClose} wide>
      {recQuery.isLoading ? (
        <div className="flex justify-center py-6 text-primary">
          <Spinner />
        </div>
      ) : recQuery.isError || !rec || !p ? (
        <ErrorNote
          message={recQuery.error instanceof ApiError ? recQuery.error.message : "No se pudieron calcular las recomendaciones"}
        />
      ) : (
        <div className="space-y-3">
          {/* Contexto del pedido para decidir */}
          <section className="grid grid-cols-1 gap-2 rounded-lg bg-muted p-3 text-xs sm:grid-cols-2">
            <p className="flex items-center gap-2 text-foreground">
              <Store className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                <b>Local elegido:</b> {p.sucursal_nombre}
              </span>
            </p>
            <p className="flex items-center gap-2 text-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span className="truncate">
                <b>Entrega:</b> {p.direccion_entrega ?? "—"}
              </span>
            </p>
            <p className="flex items-center gap-2 text-foreground">
              <Navigation className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                <b>Distancia local → cliente:</b>{" "}
                {p.distancia_sucursal_cliente_km !== null ? `${p.distancia_sucursal_cliente_km} km` : "sin coordenadas"}
              </span>
            </p>
            <p className="flex items-center gap-2 text-foreground">
              <Banknote className="h-4 w-4 shrink-0 text-success" aria-hidden />
              <span>
                <b>Pago:</b>{" "}
                {p.es_contra_entrega
                  ? `Contra entrega ${money(p.total_centavos)} (exige garantía ≥ ${money(rec.garantia_minima_centavos)})`
                  : `${p.metodo_pago} · ${p.estado_pago}`}
              </span>
            </p>
          </section>

          {rec.advertencias.length > 0 ? (
            <ul className="space-y-1">
              {rec.advertencias.map((a) => (
                <li key={a} className="flex items-start gap-2 rounded-lg border border-warning-soft bg-warning-soft px-3 py-2 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
          ) : null}

          {rec.repartidores.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay repartidores activos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {rec.repartidores.map((r) => {
                const estado = ESTADO[r.estado];
                return (
                  <li
                    key={r.id}
                    className={`rounded-lg border-2 p-3 ${
                      r.recomendado ? "border-primary bg-primary/5" : r.elegible ? "border-border bg-card" : "border-border bg-muted/50 opacity-80"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                        {r.tipo_vehiculo === "MOTO" ? <Bike className="h-5 w-5" aria-hidden /> : <Car className="h-5 w-5" aria-hidden />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-foreground">{r.nombre_completo}</p>
                          {r.recomendado ? (
                            <Badge className="bg-primary text-on-primary">
                              <CheckCircle2 className="h-3 w-3" aria-hidden />
                              Recomendado
                            </Badge>
                          ) : null}
                          {estado ? <Badge className={estado.className}>{estado.label}</Badge> : null}
                          {r.alta_confianza ? (
                            <Badge className="border border-primary/30 bg-primary/10 text-primary">
                              <ShieldCheck className="h-3 w-3" aria-hidden />
                              Alta confianza
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <Stars value={r.estrellas} />
                          {r.n_calificaciones > 0 ? <span>({r.n_calificaciones})</span> : null}
                          <span>
                            {r.distancia_sucursal_km !== null ? `${r.distancia_sucursal_km} km del local` : "sin GPS"}
                          </span>
                          <span>Garantía {money(r.saldo_centavos)}</span>
                          <span>{r.entregas_activas} activa(s)</span>
                          <span>{r.telefono}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {r.elegible ? (
                          <div className="text-center" title="Puntaje del sistema (0-100)">
                            <p className="text-lg font-extrabold leading-none text-primary">{r.score}</p>
                            <p className="text-[10px] font-semibold text-muted-foreground">puntaje</p>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="btn-primary !px-4 !py-2 text-sm"
                          disabled={!r.elegible || assignMutation.isPending}
                          onClick={() => assignMutation.mutate(r.id)}
                        >
                          Asignar
                        </button>
                      </div>
                    </div>
                    {r.elegible ? (
                      <p className="mt-2 text-[11px] text-muted-foreground">{r.razones.join(" · ")}</p>
                    ) : (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-destructive">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        No elegible: {r.motivos_no_elegible.join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {assignMutation.isError ? (
        <div className="mt-3">
          <ErrorNote
            message={assignMutation.error instanceof ApiError ? assignMutation.error.message : "No se pudo asignar al repartidor"}
          />
        </div>
      ) : null}
    </Modal>
  );
}
