import { AdminRouteGuard } from "@/components/AdminRouteGuard";
import { ReportsScreen } from "@/screens/ReportsScreen";

export default function ReportsRoute() {
  return (
    <AdminRouteGuard>
      <ReportsScreen />
    </AdminRouteGuard>
  );
}
