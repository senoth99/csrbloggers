import { Suspense } from "react";
import { IntegrationsScreen } from "@/screens/IntegrationsScreen";

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-app-fg/55">Загрузка…</p>}>
      <IntegrationsScreen />
    </Suspense>
  );
}
