"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { hydrated, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(isAuthenticated ? "/dashboard" : "/login");
  }, [hydrated, isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white/55">
      Загрузка…
    </div>
  );
}
