import { Suspense } from "react";
import { DashboardIntegrationsScreen } from "@/screens/DashboardIntegrationsScreen";

function Fallback() {
  return (
    <div className="py-12 text-center text-sm text-app-fg/55">Загрузка…</div>
  );
}

export default function DashboardIntegrationsPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <DashboardIntegrationsScreen />
    </Suspense>
  );
}
