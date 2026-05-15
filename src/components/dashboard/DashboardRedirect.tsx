"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function DashboardRedirect({ section }: { section?: string }) {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const m = search?.get("m");
    const q = m ? `?m=${encodeURIComponent(m)}` : "";
    const hash = section ? `#${section}` : "";
    router.replace(`/dashboard${q}${hash}`);
  }, [router, section, search]);

  return (
    <p className="py-12 text-center text-sm text-app-fg/55">Переход на дашборд…</p>
  );
}
