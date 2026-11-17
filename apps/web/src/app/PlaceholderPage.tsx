type PlaceholderPageProps = {
  title: string;
  phase: string;
  description: string;
};

export function PlaceholderPage({ title, phase, description }: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col px-4 pt-4">
      <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Sistema Mariel</p>
      <h1 className="text-2xl font-bold text-ink-900">{title}</h1>

      <div className="mt-6 rounded-3xl border border-dashed border-ink-300 bg-white/60 px-5 py-8 text-center">
        <p className="text-sm font-semibold text-ink-700">Pendiente · {phase}</p>
        <p className="mt-2 text-sm text-ink-500">{description}</p>
      </div>
    </div>
  );
}
