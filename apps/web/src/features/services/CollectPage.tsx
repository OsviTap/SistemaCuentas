import { Link } from 'react-router-dom';

const SERVICES = ['Luz', 'Agua', 'Recargas', 'Otros servicios'];

export function CollectPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4 pt-4 pb-2">
        <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Mostrador</p>
        <h1 className="text-2xl font-bold text-ink-900">Cobrar servicios</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="rounded-3xl bg-white p-4">
          <p className="text-sm font-semibold text-ink-700">Próxima fase</p>
          <p className="mt-1 text-sm text-ink-500">
            Aquí se cobrarán servicios como luz, agua o recargas, separando la comisión
            del negocio del monto que pertenece a la empresa.
          </p>
        </div>

        <ul className="mt-3 grid grid-cols-2 gap-2">
          {SERVICES.map((service) => (
            <li
              key={service}
              className="flex min-h-20 items-center justify-center rounded-2xl bg-white/60 px-3 text-center text-sm font-semibold text-ink-400"
            >
              {service}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-center text-xs text-ink-500">
          Mientras tanto, los productos de tienda se cobran desde Vender.
        </p>

        <Link
          to="/"
          className="mt-4 flex h-14 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white active:bg-brand-700"
        >
          Ir a vender
        </Link>
      </div>
    </div>
  );
}
