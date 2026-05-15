import { Suspense } from "react";
import { DashboardDeliveriesPageScreen } from "@/screens/DashboardDeliveriesPageScreen";

function Fallback() {
  return (
    <div className="py-12 text-center text-sm text-app-fg/55">Загрузка…</div>
  );
}

export default function DashboardDeliveriesPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <DashboardDeliveriesPageScreen />
    </Suspense>
  );
}
