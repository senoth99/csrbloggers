import { DeliveryDetailScreen } from "@/screens/DeliveryDetailScreen";

export default function DeliveryDetailPage({
  params,
}: {
  params: { deliveryId: string };
}) {
  return <DeliveryDetailScreen deliveryId={params.deliveryId} />;
}
