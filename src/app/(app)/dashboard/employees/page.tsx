import { Suspense } from "react";
import { DashboardRedirect } from "@/components/dashboard/DashboardRedirect";

function Fallback() {
  return (
    <div className="py-12 text-center text-sm text-app-fg/55">Переход на дашборд…</div>
  );
}

export default function DashboardEmployeesRedirectPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <DashboardRedirect section="employees" />
    </Suspense>
  );
}
