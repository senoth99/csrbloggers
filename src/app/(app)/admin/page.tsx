import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-session-prisma";
import { AdminScreen } from "@/screens/AdminScreen";

export default async function AdminRoute() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=%2Fadmin");
  }
  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect("/dashboard");
  }
  return <AdminScreen />;
}
