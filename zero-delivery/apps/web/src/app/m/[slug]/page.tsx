"use client";

import { use, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  Clock,
  CreditCard,
  LocateFixed,
  MapPin,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Smartphone,
  Store,
  X,
} from "lucide-react";
import { api, ApiError, money, toCents } from "@/lib/api";
import { PageLoader, ErrorNote, EmptyState, Spinner } from "@/components/ui";

interface ProductoMenu {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria_id: string | null;
  precio_base_centavos: string;
  empaque_centavos: string;
}

interface MenuData {
  restaurante: { id: string; nombre: string } | null;
  sucursal: {
    id: string;
    nombre: string;
    slug: string;
    direccion: string;
    telefono: string | null;
    apertura_manual: boolean;
  };
  categorias: Array<{ id: string; nombre: string }>;
  productos: ProductoMenu[];
}

type Metodo = "EFECTIVO" | "YAPE" | "TRANSFERENCIA_BANCARIA";

const unitPrice = (p: ProductoMenu) => toCents(p.precio_base_centavos) + toCents(p.empaque_centavos);

export default function PublicMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [selectedCat, setSelectedCat] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const menuQuery = useQuery({
    queryKey: ["public-menu", slug],
    queryFn: () => api.get<{ ok: boolean; data: MenuData }>(`/catalog/public/menu/${slug}`),
    staleTime: 30_000,
  });
  const menu = menuQuery.data?.data;

  const filtered = useMemo(() => {
    if (!menu) return [];
    const q = search.trim().toLowerCase();
    return menu.productos.filter((p) => {
      const okCat = selectedCat === "ALL" || p.categoria_id === selectedCat;
      const okText = !q || p.nombre.toLowerCase().includes(q) || (p.descripcion ?? "").toLowerCase().includes(q);
      return okCat && okText;
    });
  }, [menu, selectedCat, search]);

  const lines = useMemo(
    () =>
      (menu?.productos ?? [])
        .filter((p) => (cart[p.id] ?? 0) > 0)
        .map((p) => ({ producto: p, cantidad: cart[p.id] ?? 0 })),
    [menu, cart]
  );
  const totalItems = lines.reduce((acc, l) => acc + l.cantidad, 0);
  const totalCents = lines.reduce((acc, l) => acc + l.cantidad * unitPrice(l.producto), 0);

  const setQty = (id: string, qty: number) =>
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(qty, 50);
      return next;
    });

  if (menuQuery.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <PageLoader label="Cargando la carta…" />
      </div>
    );
  }
  if (menuQuery.isError || !menu) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6">
        <div className="w-full max-w-md">
          <ErrorNote message="No se encontró la carta de esta sucursal." />
        </div>
        <Link href="/m" className="btn-secondary">Ver otras sucursales</Link>
      </div>
    );
  }

  const { sucursal, restaurante, categorias } = menu;
  const abierta = sucursal.apertura_manual;

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl space-y-3 px-4 py-5">
          <Link href="/m" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Todas las sucursales
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary">
                <Store className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h1 className="text-2xl font-extrabold leading-tight text-foreground">{restaurante?.nombre ?? sucursal.nombre}</h1>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{sucursal.nombre}</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                abierta ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive"
              }`}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {abierta ? "Abierta ahora" : "Cerrada por ahora"}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" aria-hidden />
              {sucursal.direccion}
            </span>
            {sucursal.telefono ? (
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-primary" aria-hidden />
                {sucursal.telefono}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <section className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto max-w-4xl space-y-2 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar platos…"
              aria-label="Buscar platos"
              className="input pl-9"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ id: "ALL", nombre: "Todos" }, ...categorias].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCat(c.id)}
                className={`min-h-[40px] shrink-0 cursor-pointer rounded-lg px-4 text-xs font-bold transition-colors ${
                  selectedCat === c.id ? "bg-primary text-on-primary" : "bg-muted text-foreground hover:bg-border"
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 py-5">
        {filtered.length === 0 ? (
          <EmptyState title="No hay platos para mostrar" hint="Prueba otra categoría o búsqueda." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <article key={p.id} className="card flex flex-col justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold leading-snug text-foreground">{p.nombre}</h3>
                      <span className="shrink-0 text-base font-extrabold text-primary">{money(unitPrice(p))}</span>
                    </div>
                    {p.descripcion ? <p className="mt-1 text-xs text-muted-foreground">{p.descripcion}</p> : null}
                  </div>
                  {qty === 0 ? (
                    <button
                      type="button"
                      disabled={!abierta}
                      onClick={() => setQty(p.id, 1)}
                      className="btn-primary min-h-[44px] w-full disabled:cursor-not-allowed"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Agregar
                    </button>
                  ) : (
                    <div className="flex min-h-[44px] items-center justify-between rounded-lg border-2 border-primary px-2">
                      <button type="button" aria-label="Quitar uno" onClick={() => setQty(p.id, qty - 1)} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-primary hover:bg-primary/10">
                        <Minus className="h-5 w-5" aria-hidden />
                      </button>
                      <span className="text-base font-extrabold text-foreground">{qty}</span>
                      <button type="button" aria-label="Agregar uno" onClick={() => setQty(p.id, qty + 1)} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-primary hover:bg-primary/10">
                        <Plus className="h-5 w-5" aria-hidden />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      {totalItems > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur-md">
          <div className="mx-auto max-w-4xl">
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="btn-primary min-h-[52px] w-full justify-between px-5 text-base"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" aria-hidden />
                Ver pedido ({totalItems})
              </span>
              <span>{money(totalCents)}</span>
            </button>
          </div>
        </div>
      ) : null}

      {checkoutOpen ? (
        <Checkout
          slug={slug}
          sucursalNombre={sucursal.nombre}
          lines={lines}
          totalCents={totalCents}
          setQty={setQty}
          onClose={() => setCheckoutOpen(false)}
          onDone={(token) => router.push(`/p/${token}`)}
        />
      ) : null}
    </div>
  );
}

function Checkout({
  slug,
  sucursalNombre,
  lines,
  totalCents,
  setQty,
  onClose,
  onDone,
}: {
  slug: string;
  sucursalNombre: string;
  lines: Array<{ producto: ProductoMenu; cantidad: number }>;
  totalCents: number;
  setQty: (id: string, qty: number) => void;
  onClose: () => void;
  onDone: (token: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("EFECTIVO");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; data: { token_publico: string } }>("/orders/public", {
        sucursal_slug: slug,
        cliente: { nombre, telefono },
        direccion: {
          texto: direccion,
          referencia: referencia || null,
          latitud: coords?.lat ?? null,
          longitud: coords?.lng ?? null,
        },
        metodo_pago: metodo,
        notas: notas || null,
        items: lines.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
      }),
    onSuccess: (res) => onDone(res.data.token_publico),
  });

  function fillLocation() {
    setGeoMsg(null);
    if (!("geolocation" in navigator)) {
      setGeoMsg("Tu navegador no permite geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoMsg("Ubicación guardada: ayuda al repartidor a llegar.");
      },
      () => setGeoMsg("No se pudo obtener tu ubicación."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  const METODOS: Array<{ key: Metodo; label: string; hint: string; icon: typeof Banknote }> = [
    { key: "EFECTIVO", label: "Efectivo", hint: "Pagas al recibir", icon: Banknote },
    { key: "YAPE", label: "Yape", hint: "Envías el comprobante", icon: Smartphone },
    { key: "TRANSFERENCIA_BANCARIA", label: "Transferencia", hint: "Envías el comprobante", icon: CreditCard },
  ];

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" onClick={onClose} role="presentation">
      <div
        className="modal max-h-[92vh] w-full max-w-lg overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar pedido"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-foreground">Tu pedido · {sucursalNombre}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
          {lines.map((l) => (
            <li key={l.producto.id} className="flex items-center justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{l.producto.nombre}</p>
                <p className="text-xs text-muted-foreground">{money(unitPrice(l.producto))} c/u</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Quitar uno" onClick={() => setQty(l.producto.id, l.cantidad - 1)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border">
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <span className="w-6 text-center font-bold">{l.cantidad}</span>
                <button type="button" aria-label="Agregar uno" onClick={() => setQty(l.producto.id, l.cantidad + 1)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border">
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between p-3 text-base font-extrabold">
            <span>Total</span>
            <span className="text-primary">{money(totalCents)}</span>
          </li>
        </ul>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="o-nombre" className="input-label">Tu nombre</label>
              <input id="o-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} autoComplete="name" />
            </div>
            <div>
              <label htmlFor="o-tel" className="input-label">Celular</label>
              <input id="o-tel" className="input" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} required placeholder="987654321" autoComplete="tel" />
            </div>
          </div>
          <div>
            <label htmlFor="o-dir" className="input-label">Dirección de entrega</label>
            <input id="o-dir" className="input" value={direccion} onChange={(e) => setDireccion(e.target.value)} required minLength={3} autoComplete="street-address" />
          </div>
          <div>
            <label htmlFor="o-ref" className="input-label">Referencia (opcional)</label>
            <input id="o-ref" className="input" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>
          <div>
            <button type="button" onClick={fillLocation} className="btn-secondary !px-3 !py-2 text-xs">
              <LocateFixed className="h-4 w-4" aria-hidden />
              Usar mi ubicación actual
            </button>
            {geoMsg ? <p className="mt-1 text-xs text-muted-foreground">{geoMsg}</p> : null}
          </div>

          <fieldset>
            <legend className="input-label">Método de pago</legend>
            <div className="grid grid-cols-3 gap-2">
              {METODOS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetodo(m.key)}
                  aria-pressed={metodo === m.key}
                  className={`flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-1 text-center text-xs font-bold transition-colors ${
                    metodo === m.key ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"
                  }`}
                >
                  <m.icon className="h-5 w-5" aria-hidden />
                  {m.label}
                  <span className="text-[10px] font-medium text-muted-foreground">{m.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="o-notas" className="input-label">Notas para el pedido (opcional)</label>
            <textarea id="o-notas" className="input min-h-16 resize-y" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          {mutation.isError ? (
            <ErrorNote message={mutation.error instanceof ApiError ? mutation.error.message : "No se pudo enviar el pedido"} />
          ) : null}

          <button type="submit" className="btn-primary min-h-[52px] w-full text-base" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner className="h-5 w-5" /> : null}
            Enviar pedido · {money(totalCents)}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Tu pedido llega al coordinador, que confirmará el pago y asignará al repartidor.
          </p>
        </form>
      </div>
    </div>
  );
}
