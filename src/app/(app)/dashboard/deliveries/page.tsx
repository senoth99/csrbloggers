import { Suspense } from "react";
import { DashboardDeliveriesScreen } from "@/screens/DashboardDeliveriesScreen";

function Fallback() {
  return (
    <div className="py-12 text-center text-sm text-app-fg/55">Загрузка дашборда…</div>
  );
}

export default function DashboardDeliveriesPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <DashboardDeliveriesScreen />
    </Suspense>
  );
}
