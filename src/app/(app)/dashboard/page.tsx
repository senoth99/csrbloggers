import { Suspense } from "react";
import { DashboardScreen } from "@/screens/DashboardScreen";

function Fallback() {
  return (
    <div className="py-12 text-center text-sm text-app-fg/55">Загрузка дашборда…</div>
  );
}

export default function DashboardRoute() {
  return (
    <Suspense fallback={<Fallback />}>
      <DashboardScreen />
    </Suspense>
  );
}
