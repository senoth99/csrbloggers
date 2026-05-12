import { IntegrationDetailScreen } from "@/screens/IntegrationDetailScreen";

export default function IntegrationDetailPage({
  params,
}: {
  params: { integrationId: string };
}) {
  return <IntegrationDetailScreen integrationId={params.integrationId} />;
}
