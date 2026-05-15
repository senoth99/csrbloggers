"use client";

import { useParams } from "next/navigation";
import { IntegrationDetailScreen } from "@/screens/IntegrationDetailScreen";

export default function IntegrationDetailPage() {
  const params = useParams();
  const integrationId =
    typeof params.integrationId === "string" ? params.integrationId : "";
  return <IntegrationDetailScreen integrationId={integrationId} variant="page" />;
}
