export default async function PublicOrderTrackingPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Estado de tu Pedido</h1>
      <p className="mt-1 text-xs text-slate-500">Código de seguimiento: {publicToken.slice(0, 10)}…</p>
    </main>
  );
}
