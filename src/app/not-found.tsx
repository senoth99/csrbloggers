import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app-bg px-4 text-app-fg">
      <p className="text-sm uppercase tracking-widest text-app-fg/55">404</p>
      <h1 className="text-xl font-semibold">Страница не найдена</h1>
      <Link
        href="/dashboard"
        className="border border-app-fg/20 px-5 py-2.5 text-sm text-app-fg transition hover:border-app-accent"
      >
        На дашборд
      </Link>
    </div>
  );
}
