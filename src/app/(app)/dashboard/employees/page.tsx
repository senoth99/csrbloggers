import { Suspense } from "react";
import { EmployeesDashboardScreen } from "@/screens/EmployeesDashboardScreen";

function Fallback() {
  return (
    <div className="py-12 text-center text-sm text-app-fg/55">Загрузка…</div>
  );
}

export default function DashboardEmployeesPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <EmployeesDashboardScreen />
    </Suspense>
  );
}
