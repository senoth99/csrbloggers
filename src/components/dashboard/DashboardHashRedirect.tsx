"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const HASH_TO_PATH: Record<string, string> = {
  integrations: "/dashboard/integrations",
  deliveries: "/dashboard/deliveries",
  employees: "/dashboard/employees",
  overview: "/dashboard",
  kpi: "/dashboard",
  reach: "/dashboard",
  bloggers: "/dashboard",
  promocodes: "/dashboard",
  report: "/dashboard",
};

/** Старые ссылки /dashboard#… → отдельные страницы */
export function DashboardHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    const target = HASH_TO_PATH[id];
    if (!target) return;
    const search = window.location.search;
    router.replace(`${target}${search}`);
  }, [router]);

  return null;
}
