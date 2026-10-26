export default async function PublicBranchMenuPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = await params;
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Carta Digital — Sucursal {branchSlug}</h1>
      <p className="mt-1 text-sm text-slate-600">
        Precios expresados en Soles (S/). Compra rápida como invitado.
      </p>
    </main>
  );
}
