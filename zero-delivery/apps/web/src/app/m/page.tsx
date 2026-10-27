"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, LocateFixed, MapPin, PackageCheck, Phone, Store } from "lucide-react";
import { api } from "@/lib/api";
import { EmptyState, ErrorNote, PageLoader } from "@/components/ui";

interface PublicBranch {
  id: string;
  nombre: string;
  slug: string;
  direccion: string;
  telefono: string | null;
  latitud: number | null;
  longitud: number | null;
  abierta: boolean;
  restaurante: string;
}

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** El cliente elige libremente de cuál sucursal pedir. */
export default function PublicBranchesPage() {
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["public-branches"],
    queryFn: () => api.get<{ ok: boolean; data: PublicBranch[] }>("/catalog/public/branches"),
    staleTime: 30_000,
  });

  const branches = useMemo(() => {
    const list = (query.data?.data ?? []).map((b) => ({
      ...b,
      distancia:
        me && b.latitud !== null && b.longitud !== null ? km(me.lat, me.lng, b.latitud, b.longitud) : null,
    }));
    if (!me) return list;
    return [...list].sort((a, b) => (a.distancia ?? 1e9) - (b.distancia ?? 1e9));
  }, [query.data, me]);

  function locate() {
    setGeoMsg(null);
    if (!("geolocation" in navigator)) {
      setGeoMsg("Tu navegador no permite geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoMsg("No se pudo obtener tu ubicación."),
      { timeout: 15000 }
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary">
              <PackageCheck className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-extrabold leading-tight text-foreground">Zero Delivery</h1>
              <p className="text-xs text-muted-foreground">Elige la sucursal y arma tu pedido</p>
            </div>
          </div>
          <button type="button" onClick={locate} className="btn-secondary !px-3 !py-2 text-xs">
            <LocateFixed className="h-4 w-4" aria-hidden />
            Cerca de mí
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-3 px-4 py-5">
        {geoMsg ? <p className="text-xs text-muted-foreground">{geoMsg}</p> : null}
        {query.isLoading ? <PageLoader label="Cargando sucursales…" /> : null}
        {query.isError ? <ErrorNote message="No se pudieron cargar las sucursales." /> : null}
        {!query.isLoading && !query.isError && branches.length === 0 ? (
          <EmptyState title="Todavía no hay sucursales disponibles" />
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/m/${b.slug}`}
              className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Store className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-bold text-foreground">{b.nombre}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      b.abierta ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {b.abierta ? "Abierta" : "Cerrada"}
                  </span>
                </div>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {b.direccion}
                </p>
                <p className="flex items-center gap-3 text-xs text-muted-foreground">
                  {b.telefono ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      {b.telefono}
                    </span>
                  ) : null}
                  {b.distancia !== null ? (
                    <span className="font-semibold text-primary">a {b.distancia.toFixed(1)} km</span>
                  ) : null}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
