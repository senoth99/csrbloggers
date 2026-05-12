"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-app-bg px-4 py-16 text-app-fg">
      <h1 className="text-lg font-semibold uppercase tracking-wide">Что-то пошло не так</h1>
      <p className="max-w-md text-center text-sm text-app-fg/55">
        {error.message || "Произошла ошибка при загрузке страницы."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="border border-app-fg/20 bg-app-accent px-6 py-2.5 text-sm font-medium uppercase tracking-wide text-app-fg transition hover:brightness-125"
      >
        Попробовать снова
      </button>
    </div>
  );
}
