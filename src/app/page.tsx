"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { defaultAuthenticatedPath } from "@/lib/panel-auth-utils";

export default function HomePage() {
  const { hydrated, isAuthenticated, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(isAuthenticated ? defaultAuthenticatedPath(role) : "/login");
  }, [hydrated, isAuthenticated, role, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white/55">
      Загрузка…
    </div>
  );
}
